import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";

/* -------------------------------------------------------------------------- */
/* 🧩 Types                                                                    */
/* -------------------------------------------------------------------------- */

type Props = {
  src: string;
  remainingPlays: number;
  onBlocked: (msg: string) => void;
  onFullEnded: () => void; // ✅ count ONLY when ended
};

/* -------------------------------------------------------------------------- */
/* 🧩 Helpers                                                                  */
/* -------------------------------------------------------------------------- */

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
/* 🎧 Readonly Waveform (PURE, NO MUTATION)                                   */
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
    return Array.from({ length: count }, (_, i) => {
      return 0.18 + hash(seed, i) * 0.82;
    });
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

    const activeBars = Math.floor(
      clamp(progress, 0, 1) * bars.length
    );

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
/* 🎵 Custom Audio Player                                                      */
/* -------------------------------------------------------------------------- */

export default function CustomAudioPlayer({
  src,
  remainingPlays,
  onBlocked,
  onFullEnded,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(0.9);

  const disabled = remainingPlays <= 0;
  const progress = duration > 0 ? current / duration : 0;

  /* ------------------------------------------------------------------------ */
  /* 🔁 Safe restart handling (fixes 2nd play issue)                           */
  /* ------------------------------------------------------------------------ */

  const ensureRestartable = (a: HTMLAudioElement) => {
    if (a.ended || (a.duration && a.currentTime >= a.duration - 0.05)) {
      a.pause();
      a.currentTime = 0;
      a.load();
      setCurrent(0);
      setIsPlaying(false);
    }
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (disabled) {
      onBlocked("Your limit reached. Try it tomorrow.");
      return;
    }

    ensureRestartable(a);

    try {
      if (a.paused) {
        await a.play();
        setIsPlaying(true);
      } else {
        a.pause();
        setIsPlaying(false);
      }
    } catch {
      onBlocked("Unable to play audio. Please tap again.");
      setIsPlaying(false);
    }
  };

  const restart = async () => {
    const a = audioRef.current;
    if (!a) return;

    if (disabled) {
      onBlocked("Your limit reached. Try it tomorrow.");
      return;
    }

    a.pause();
    a.currentTime = 0;
    a.load();
    setCurrent(0);

    try {
      await a.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      onBlocked("Unable to play audio. Please tap Play.");
    }
  };

  /* ------------------------------------------------------------------------ */
  /* 🎧 Native audio events                                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    a.volume = volume;

    const onLoaded = () => {
      setDuration(a.duration || 0);
      setIsReady(true);
    };

    const onTime = () => setCurrent(a.currentTime || 0);

    const onPlayEvt = () => {
      if (disabled) {
        a.pause();
        setIsPlaying(false);
        onBlocked("Your limit reached. Try it tomorrow.");
        return;
      }
      setIsPlaying(true);
    };

    const onPauseEvt = () => setIsPlaying(false);

    const onEndedEvt = () => {
      setIsPlaying(false);
      setCurrent(a.duration || 0);
      onFullEnded();

      a.currentTime = 0;
      a.load();
      setCurrent(0);
    };

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlayEvt);
    a.addEventListener("pause", onPauseEvt);
    a.addEventListener("ended", onEndedEvt);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlayEvt);
      a.removeEventListener("pause", onPauseEvt);
      a.removeEventListener("ended", onEndedEvt);
    };
  }, [disabled, onBlocked, onFullEnded, volume]);

  /* ------------------------------------------------------------------------ */
  /* 🧾 UI                                                                     */
  /* ------------------------------------------------------------------------ */

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
          <RotateCcw size={18} />
        </button>
      </div>

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
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div style={timeBox}>
          <span style={time}>{formatTime(current)}</span>
          <span>/</span>
          <span style={time}>{formatTime(duration)}</span>
        </div>

        <div style={volBox}>
          <Volume2 size={18} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
      </div>

      <audio ref={audioRef} preload="metadata">
        <source src={src} type="audio/mpeg" />
      </audio>

      {disabled && (
        <div style={lockNote}>
          🔒 Limit reached. Please try again tomorrow.
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
  padding: 10,
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
