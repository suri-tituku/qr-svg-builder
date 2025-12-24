import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Loader2,
} from "lucide-react";

import { loadVideoWithCache, revokeVideoUrl } from "../utils/videoCache";

type Props = {
  src: string;
  ttlMs?: number; // optional, default 30 mins
  encrypt?: boolean;
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

export default function CustomVideoPlayerUltra({
  src,
  ttlMs = 30 * 60 * 1000,
  encrypt = true,
  remainingPlays,
  onBlocked,
  onFullEnded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef<string>("");

  const rafRef = useRef<number | null>(null);
  const lastTouchRef = useRef<number>(0);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const [volume, setVolume] = useState(0.9);
  const [showControls, setShowControls] = useState(true);

  const disabled = remainingPlays <= 0;

  const progress = useMemo(() => {
    if (!duration) return 0;
    return clamp(current / duration, 0, 1);
  }, [current, duration]);

  const stopRAF = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const startRAF = () => {
    stopRAF();
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;

      setCurrent(v.currentTime || 0);

      if (!v.paused) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const cleanup = () => {
    stopRAF();
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
      v.removeAttribute("src");
      try {
        v.load();
      } catch {}
    }
    if (objectUrlRef.current) {
      revokeVideoUrl(objectUrlRef.current);
      objectUrlRef.current = "";
    }
  };

  // Load video (cache + encryption)
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
        const { url, source } = await loadVideoWithCache({
          url: src,
          ttlMs,
          encrypt,
          mime: "video/mp4",
        });

        if (cancelled) {
          revokeVideoUrl(url);
          return;
        }

        objectUrlRef.current = url;

        const v = videoRef.current;
        if (v) {
          v.src = url;
          v.volume = volume;
          v.muted = muted;
        }

        console.log(
          source === "cache"
            ? "🎬 Ultra video source: LOCAL CACHE"
            : "🌐 Ultra video source: NETWORK"
        );
      } catch (e) {
        console.error(e);
        if (!cancelled) onBlocked("⚠️ Failed to load video.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Apply volume/mute
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = clamp(volume, 0, 1);
  }, [volume]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
  }, [muted]);

  const ensureReadyOrBlock = () => {
    if (disabled) {
      onBlocked("🔒 Your video play limit reached. Try again tomorrow.");
      return false;
    }
    if (!ready) {
      onBlocked("Video still loading…");
      return false;
    }
    return true;
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (!ensureReadyOrBlock()) return;

    try {
      if (v.paused) {
        await v.play();
      } else {
        v.pause();
      }
    } catch (e) {
      console.error(e);
      onBlocked("Browser blocked video autoplay. Tap Play again.");
    }
  };

  const restart = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (!ensureReadyOrBlock()) return;

    try {
      v.pause();
      v.currentTime = 0;
      setCurrent(0);
      await v.play();
    } catch (e) {
      console.error(e);
      onBlocked("Cannot restart video. Tap Play again.");
    }
  };

  const toggleMute = () => setMuted((m) => !m);

  const goFullscreen = async () => {
    const v = videoRef.current;
    if (!v) return;

    // only block play, not fullscreen
    try {
      if (v.requestFullscreen) await v.requestFullscreen();
      // @ts-ignore
      else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
    } catch {}
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    setReady(true);
  };

  const onPlay = () => {
    setPlaying(true);
    startRAF();

    // hide controls after a bit
    setShowControls(true);
    window.setTimeout(() => {
      const now = Date.now();
      if (now - lastTouchRef.current > 1200) setShowControls(false);
    }, 1600);
  };

  const onPause = () => {
    setPlaying(false);
    stopRAF();
    setShowControls(true);
  };

  const onEnded = () => {
    setPlaying(false);
    stopRAF();

    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
    setCurrent(0);

    // ✅ count ONLY here
    onFullEnded();
    setShowControls(true);
  };

  const onPointerMove = () => {
    lastTouchRef.current = Date.now();
    setShowControls(true);
    if (playing) {
      window.setTimeout(() => {
        const now = Date.now();
        if (now - lastTouchRef.current > 1200) setShowControls(false);
      }, 1600);
    }
  };

  return (
    <div style={wrap}>
      <div style={topRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={iconBadge}>🎬</div>
          <div>
            <div style={heading}>Video Player</div>
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

      <div style={stage} onMouseMove={onPointerMove} onTouchStart={onPointerMove}>
        <video
          ref={videoRef}
          playsInline
          preload="metadata"
          controls={false}
          style={video}
          onLoadedMetadata={onLoadedMetadata}
          onPlay={onPlay}
          onPause={onPause}
          onEnded={onEnded}
          onClick={togglePlay}
        />

        {/* Gradient overlay */}
        <div style={overlayGradient} />

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              style={loadingOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Loader2 size={20} className="spin" />
              <span style={{ fontWeight: 800 }}>Loading…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Play button */}
        <AnimatePresence>
          {!playing && showControls && !loading && (
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              style={{
                ...centerBtn,
                opacity: disabled ? 0.55 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
            >
              <Play size={22} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Bottom controls */}
        <AnimatePresence>
          {showControls && !loading && (
            <motion.div
              style={controls}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                disabled={disabled || !ready}
                style={{
                  ...pillBtn,
                  opacity: disabled || !ready ? 0.5 : 1,
                  cursor: disabled || !ready ? "not-allowed" : "pointer",
                }}
                title={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
                <span style={{ fontWeight: 900 }}>{playing ? "Pause" : "Play"}</span>
              </button>

              <div style={timePill} title="Time">
                <span style={mono}>{formatTime(current)}</span>
                <span style={{ opacity: 0.55 }}>/</span>
                <span style={mono}>{formatTime(duration)}</span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                style={iconBtn}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (val > 0 && muted) setMuted(false);
                }}
                style={vol}
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goFullscreen();
                }}
                style={iconBtn}
                title="Fullscreen"
              >
                <Maximize size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div style={progressWrap}>
          <div style={{ ...progressFill, width: `${progress * 100}%` }} />
        </div>
      </div>

      {disabled && (
        <div style={lock}>
          🔒 Video play limit reached. Please try again tomorrow.
        </div>
      )}

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
  marginTop: 16,
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
  background: "linear-gradient(135deg, #111827 0%, #374151 100%)",
  color: "#fff",
  boxShadow: "0 12px 25px rgba(17, 24, 39, 0.25)",
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

const stage: React.CSSProperties = {
  position: "relative",
  borderRadius: 16,
  overflow: "hidden",
  background: "#000",
  border: "1px solid #e5e7eb",
};

const video: React.CSSProperties = {
  width: "100%",
  display: "block",
  background: "#000",
};

const overlayGradient: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 70%)",
};

const loadingOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  color: "#fff",
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(6px)",
  pointerEvents: "none",
};

const centerBtn: React.CSSProperties = {
  position: "absolute",
  top: "30%",
  left: "45%",
  transform: "translate(-50%, -50%)",
  width: 62,
  height: 62,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.35)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
};

const controls: React.CSSProperties = {
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 12,
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(17,24,39,0.55)",
  backdropFilter: "blur(10px)",
};

const pillBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "10px 12px",
  background: "linear-gradient(135deg, #ffffff 0%, #e5e7eb 100%)",
  color: "#111827",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const iconBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  borderRadius: 14,
  padding: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const timePill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const mono: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const vol: React.CSSProperties = {
  width: 110,
};

const progressWrap: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 4,
  background: "rgba(255,255,255,0.18)",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #a78bfa 0%, #22c55e 100%)",
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
