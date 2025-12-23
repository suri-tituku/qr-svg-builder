import React, { useEffect, useMemo, useRef, useState } from "react";
import { Howl } from "howler";

type Props = {
  src: string;
  remainingPlays: number;
  onBlocked: (msg: string) => void;
  onFullEnded: () => void; // ✅ count ONLY when ended
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
/* 🎧 Readonly Waveform (no animation, deterministic)                          */
/* -------------------------------------------------------------------------- */
function hash(seed: string, index: number) {
  let h = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000; // 0..1
}

function WaveformReadonly({
  seed,
  progress,
}: {
  seed: string;
  progress: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bars = useMemo(() => {
    const count = 56;
    return Array.from({ length: count }, (_, i) => 0.18 + hash(seed, i) * 0.82);
  }, [seed]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = c.clientWidth;
    const height = c.clientHeight;

    c.width = Math.floor(width * dpr);
    c.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    const gap = 3;
    const barW = Math.floor((width - gap * (bars.length - 1)) / bars.length);
    const mid = height / 2;

    const activeBars = Math.floor(clamp(progress, 0, 1) * bars.length);

    for (let i = 0; i < bars.length; i++) {
      const amp = bars[i];
      const barH = Math.max(4, amp * height);
      const x = i * (barW + gap);
      const y = mid - barH / 2;

      ctx.fillStyle = i <= activeBars ? "#111827" : "#d1d5db";
      ctx.fillRect(x, y, barW, barH);
    }
  }, [bars, progress]);

  return (
    <div style={waveWrap}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎵 Howler Player                                                             */
/* -------------------------------------------------------------------------- */

export default function CustomAudioPlayer({
  src,
  remainingPlays,
  onBlocked,
  onFullEnded,
}: Props) {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0); // seconds
  const [current, setCurrent] = useState(0); // seconds
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

  // Build Howl once per src
  useEffect(() => {
    stopRAF();
    setIsReady(false);
    setIsPlaying(false);
    setDuration(0);
    setCurrent(0);

    // cleanup old
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    const h = new Howl({
      src: [src],
      html5: true, // ✅ better mobile reliability + larger files
      volume,
      preload: true,
      onload: () => {
        const d = h.duration() || 0;
        setDuration(d);
        setIsReady(true);
      },
      onplay: () => {
        setIsPlaying(true);
        startRAF();
      },
      onpause: () => {
        setIsPlaying(false);
        stopRAF();
      },
      onstop: () => {
        setIsPlaying(false);
        stopRAF();
      },
      onend: () => {
        // ✅ COUNT ONLY HERE
        setIsPlaying(false);
        stopRAF();
        setCurrent(duration || h.duration() || 0);

        onFullEnded();

        // ✅ make replay always work
        h.stop();
        h.seek(0);
        setCurrent(0);
      },
      onloaderror: () => {
        setIsReady(false);
        onBlocked("Audio failed to load. Check file path / GitHub Pages base URL.");
      },
      onplayerror: () => {
        setIsPlaying(false);
        onBlocked("Browser blocked audio. Tap Play again.");
        h.once("unlock", () => {
          // user gesture unlock
        });
      },
    });

    howlRef.current = h;

    return () => {
      stopRAF();
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Volume updates
  useEffect(() => {
    const h = howlRef.current;
    if (h) h.volume(volume);
  }, [volume]);

  const togglePlay = async () => {
    const h = howlRef.current;
    if (!h) return;

    if (disabled) {
      onBlocked("Your limit reached. Try it tomorrow.");
      return;
    }

    if (!isReady) {
      onBlocked("Audio is still loading… try again.");
      return;
    }

    // ✅ if ended or near end, reset before play
    const d = h.duration() || duration;
    const pos = Number(h.seek()) || 0;
    if (d > 0 && pos >= d - 0.05) {
      h.stop();
      h.seek(0);
      setCurrent(0);
    }

    if (h.playing()) {
      h.pause();
    } else {
      h.play(); // ✅ user click gesture triggers play
    }
  };

  const restart = () => {
    const h = howlRef.current;
    if (!h) return;

    if (disabled) {
      onBlocked("Your limit reached. Try it tomorrow.");
      return;
    }

    h.stop();
    h.seek(0);
    setCurrent(0);
    h.play();
  };

  return (
    <div style={card}>
      <div style={headerRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={badge}>🎵</div>
          <div>
            <div style={title}>Audio Player</div>
            <div style={sub}>
              Remaining full plays: <strong>{remainingPlays}</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={restart}
          disabled={disabled || !isReady}
          style={{
            ...iconBtn,
            opacity: disabled || !isReady ? 0.45 : 1,
            cursor: disabled || !isReady ? "not-allowed" : "pointer",
          }}
          title="Restart"
        >
          ⟲
        </button>
      </div>

      {/* readonly waveform */}
      <WaveformReadonly seed={src} progress={progress} />

      <div style={controlsRow}>
        <button
          type="button"
          onClick={togglePlay}
          disabled={disabled || !isReady}
          style={{
            ...playBtn,
            opacity: disabled || !isReady ? 0.55 : 1,
            cursor: disabled || !isReady ? "not-allowed" : "pointer",
          }}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        <div style={timeBox}>
          <span style={time}>{formatTime(current)}</span>
          <span style={{ opacity: 0.5 }}>/</span>
          <span style={time}>{formatTime(duration)}</span>
        </div>

        <div style={volBox}>
          🔊
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

      {disabled && <div style={lockNote}>🔒 Limit reached. Please try again tomorrow.</div>}
      {!disabled && (
        <div style={hintNote}>
          ✅ Counts only when the song finishes • 🔒 Seeking disabled (no scrub UI)
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles                                                                   */
/* -------------------------------------------------------------------------- */

const waveWrap: React.CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 12,
  background: "#f3f4f6",
  padding: 10,
};

const card: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(17, 24, 39, 0.06)",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const badge: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: "#111827",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const title: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  color: "#111827",
};

const sub: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
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
  fontWeight: 800,
  background: "#111827",
  color: "#fff",
};

const iconBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
};

const timeBox: React.CSSProperties = {
  display: "flex",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#111827",
  padding: "8px 10px",
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const time: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const volBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const lockNote: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: "#fff1f2",
  border: "1px solid #fecdd3",
  color: "#9f1239",
  fontWeight: 700,
  fontSize: 13,
};

const hintNote: React.CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  background: "#f3f4f6",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontWeight: 700,
  fontSize: 12,
};
