import React, { useEffect, useMemo, useRef, useState } from "react";
import { Howl } from "howler";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, RotateCcw, Volume2, Loader2 } from "lucide-react";

import { loadAudioWithCache } from "../utils/audioCache";

type Props = {
  src: string; // remote URL (we cache + blob internally)
  remainingPlays: number;
  onBlocked: (msg: string) => void;
  onFullEnded: () => void; // count ONLY when ended
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* 🔊 Ultra animated bars (no seeking, just visual)                            */
/* -------------------------------------------------------------------------- */
function hash(seed: string, index: number) {
  let h = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function UltraBars({
  seed,
  progress,
  playing,
}: {
  seed: string;
  progress: number;
  playing: boolean;
}) {
  const bars = useMemo(() => {
    const count = 64;
    return Array.from({ length: count }, (_, i) => 0.15 + hash(seed, i) * 0.85);
  }, [seed]);

  const active = Math.floor(clamp(progress, 0, 1) * bars.length);

  return (
    <div style={barsWrap}>
      <div style={barsRow}>
        {bars.map((v, i) => {
          const isActive = i <= active;
          return (
            <motion.div
              key={i}
              style={{
                ...bar,
                opacity: isActive ? 1 : 0.35,
                background: isActive
                  ? "linear-gradient(180deg, #111827 0%, #6d28d9 100%)"
                  : "rgba(17,24,39,0.15)",
              }}
              animate={{
                height: playing
                  ? Math.max(8, v * 44 + (i % 5) * 2)
                  : Math.max(8, v * 28),
              }}
              transition={{
                duration: playing ? 0.25 : 0.4,
                ease: "easeOut",
              }}
            />
          );
        })}
      </div>
      <div style={glow} />
    </div>
  );
}

export default function CustomAudioPlayerUltra({
  src,
  remainingPlays,
  onBlocked,
  onFullEnded,
}: Props) {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string>("");

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const [volume, setVolume] = useState(0.9);

  const disabled = remainingPlays <= 0;
  const progress = duration > 0 ? current / duration : 0;

  const stopRAF = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const startRAF = () => {
    stopRAF();
    const tick = () => {
      const h = howlRef.current;
      if (!h) return;
      const pos = Number(h.seek()) || 0;
      setCurrent(pos);
      if (h.playing()) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const cleanup = () => {
    stopRAF();
    if (howlRef.current) {
      try {
        howlRef.current.stop();
      } catch {}
      howlRef.current.unload();
      howlRef.current = null;
    }
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {}
      objectUrlRef.current = "";
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      cleanup();
      setReady(false);
      setLoading(true);
      setPlaying(false);
      setDuration(0);
      setCurrent(0);

      try {
        const { objectUrl, source } = await loadAudioWithCache({
          url: src,
          ttlMs: 30 * 60 * 1000,
          encrypt: true,
        });

        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        objectUrlRef.current = objectUrl;

        const h = new Howl({
          src: [objectUrl],
          format: ["mp3"],
          html5: true,
          preload: true,
          volume,
          pool: 1,
          onload: () => {
            if (cancelled) return;
            setDuration(h.duration() || 0);
            setReady(true);
            setLoading(false);

            console.log(
              source === "cache"
                ? "✅ Ultra audio source: LOCAL CACHE"
                : "⬇️ Ultra audio source: SERVER"
            );
          },
          onplay: () => {
            if (cancelled) return;
            setPlaying(true);
            startRAF();
          },
          onpause: () => {
            if (cancelled) return;
            setPlaying(false);
            stopRAF();
          },
          onstop: () => {
            if (cancelled) return;
            setPlaying(false);
            stopRAF();
          },
          onend: () => {
            if (cancelled) return;
            setPlaying(false);
            stopRAF();
            setCurrent(duration || h.duration() || 0);

            // ✅ count ONLY here
            onFullEnded();

            // reset for replay
            h.stop();
            h.seek(0);
            setCurrent(0);
          },
          onloaderror: (_id, err) => {
            console.error("Howler load error:", err);
            if (!cancelled) {
              setReady(false);
              setLoading(false);
              onBlocked("Audio failed to load. Check BASE_URL/file path.");
            }
          },
          onplayerror: (_id, err) => {
            console.error("Howler play error:", err);
            if (!cancelled) {
              setPlaying(false);
              onBlocked("Browser blocked audio. Tap Play again.");
              h.once("unlock", () => {});
            }
          },
        });

        howlRef.current = h;
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setReady(false);
          setLoading(false);
          onBlocked("⚠️ Failed to load audio.");
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const h = howlRef.current;
    if (h) h.volume(clamp(volume, 0, 1));
  }, [volume]);

  const ensureReadyOrBlock = () => {
    if (disabled) {
      onBlocked("🔒 Your limit reached. Try it tomorrow.");
      return false;
    }
    if (!ready) {
      onBlocked("Audio is still loading… try again.");
      return false;
    }
    return true;
  };

  const togglePlay = () => {
    const h = howlRef.current;
    if (!h) return;

    if (!ensureReadyOrBlock()) return;

    const d = h.duration() || duration;
    const pos = Number(h.seek()) || 0;
    if (d > 0 && pos >= d - 0.05) {
      h.stop();
      h.seek(0);
      setCurrent(0);
    }

    if (h.playing()) h.pause();
    else h.play();
  };

  const restart = () => {
    const h = howlRef.current;
    if (!h) return;

    if (!ensureReadyOrBlock()) return;

    h.stop();
    h.seek(0);
    setCurrent(0);
    h.play();
  };

  return (
    <div style={wrap}>
      <div style={topRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={iconBadge}>🎵</div>
          <div>
            <div style={heading}>Audio Player</div>
            <div style={sub}>
              Remaining full plays: <strong>{remainingPlays}</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={restart}
          disabled={disabled || !ready}
          style={{
            ...miniBtn,
            opacity: disabled || !ready ? 0.45 : 1,
            cursor: disabled || !ready ? "not-allowed" : "pointer",
          }}
          title="Restart"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <UltraBars seed={src} progress={progress} playing={playing} />

      <div style={controlsRow}>
        <button
          type="button"
          onClick={togglePlay}
          disabled={disabled || !ready}
          style={{
            ...playBtn,
            opacity: disabled || !ready ? 0.55 : 1,
            cursor: disabled || !ready ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="spin" />
              Loading…
            </>
          ) : playing ? (
            <>
              <Pause size={18} />
              Pause
            </>
          ) : (
            <>
              <Play size={18} />
              Play
            </>
          )}
        </button>

        <div style={timePill}>
          <span style={mono}>{formatTime(current)}</span>
          <span style={{ opacity: 0.55 }}>/</span>
          <span style={mono}>{formatTime(duration)}</span>
        </div>

        <div style={volPill}>
          <Volume2 size={16} />
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ width: 120 }}
          />
        </div>
      </div>

      <AnimatePresence>
        {disabled ? (
          <motion.div
            style={lock}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            🔒 Limit reached. Please try again tomorrow.
          </motion.div>
        ) : (
          <motion.div
            style={hint}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            ✅ Counts only when the song finishes • 🔒 Seeking disabled (no scrub UI)
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles (Ultra Modern, safe)                                             */
/* -------------------------------------------------------------------------- */
const wrap: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 16px 45px rgba(17, 24, 39, 0.08)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 12,
};

const iconBadge: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #111827 0%, #6d28d9 100%)",
  color: "#fff",
  boxShadow: "0 12px 25px rgba(17, 24, 39, 0.22)",
};

const heading: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 14,
  color: "#111827",
};

const sub: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const miniBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 14,
  padding: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const barsWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 66,
  borderRadius: 16,
  background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
  border: "1px solid #e5e7eb",
  overflow: "hidden",
  padding: 12,
};

const glow: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "radial-gradient(400px 120px at 30% 30%, rgba(109,40,217,0.18), transparent 65%)",
};

const barsRow: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  gap: 3,
};

const bar: React.CSSProperties = {
  width: 6,
  borderRadius: 999,
};

const controlsRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 12,
  flexWrap: "wrap",
};

const playBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "10px 14px",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 900,
  background: "linear-gradient(135deg, #111827 0%, #6d28d9 100%)",
  color: "#fff",
  boxShadow: "0 12px 25px rgba(17,24,39,0.18)",
};

const timePill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  fontWeight: 900,
  color: "#111827",
  padding: "10px 12px",
  borderRadius: 14,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const mono: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const volPill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontWeight: 800,
};

const lock: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#9f1239",
  fontWeight: 800,
  fontSize: 13,
};

const hint: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontWeight: 800,
  fontSize: 12,
};
