import React, { useEffect, useMemo, useRef, useState } from "react";
import { Howl } from "howler";
import { loadAudioWithCache } from "../utils/audioCache"; // ✅ NEW

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
/* 🎧 Readonly Waveform (deterministic)                                        */
/* -------------------------------------------------------------------------- */

function hash(seed: string, index: number) {
  let h = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
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
/* 🎵 Howler Player (CACHE + ENCRYPTION SAFE)                                  */
/* -------------------------------------------------------------------------- */

export default function CustomAudioPlayer({
  src,
  remainingPlays,
  onBlocked,
  onFullEnded,
}: Props) {
  const howlRef = useRef<Howl | null>(null);
  const rafRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
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
      setCurrent(Number(h.seek()) || 0);
      if (h.playing()) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  /* ------------------------------------------------------------------------ */
  /* 🔊 Build Howl (CACHED SOURCE)                                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsReady(false);
      setIsPlaying(false);
      setCurrent(0);
      setDuration(0);

      // cleanup previous
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      try {
        const blob = await loadAudioWithCache(src); // 🔥 SERVER or LOCAL
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        const h = new Howl({
          src: [objectUrl],
          html5: true,
          preload: true,
          volume,
          pool: 1, // ✅ FIX pool exhaustion
          onload: () => {
            setDuration(h.duration() || 0);
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
            setIsPlaying(false);
            stopRAF();
            setCurrent(h.duration() || 0);

            onFullEnded(); // ✅ COUNT ONLY HERE

            h.stop();
            h.seek(0);
            setCurrent(0);
          },
          onplayerror: () => {
            onBlocked("Browser blocked audio. Tap Play again.");
          },
        });

        howlRef.current = h;
      } catch {
        onBlocked("Failed to load audio.");
      }
    }

    init();

    return () => {
      cancelled = true;
      stopRAF();
      if (howlRef.current) howlRef.current.unload();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [src]);

  /* ------------------------------------------------------------------------ */
  /* 🎛 Controls                                                               */
  /* ------------------------------------------------------------------------ */

  const togglePlay = () => {
    const h = howlRef.current;
    if (!h) return;

    if (disabled) {
      onBlocked("Your limit reached. Try it tomorrow.");
      return;
    }

    if (!isReady) {
      onBlocked("Audio still loading…");
      return;
    }

    if (h.playing()) h.pause();
    else h.play();
  };

  const restart = () => {
    const h = howlRef.current;
    if (!h || disabled) return;
    h.stop();
    h.seek(0);
    setCurrent(0);
    h.play();
  };

  useEffect(() => {
    const h = howlRef.current;
    if (h) h.volume(volume);
  }, [volume]);

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
          }}
        >
          ⟲
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
          }}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>

        <div style={timeBox}>
          <span style={time}>{formatTime(current)}</span>
          <span>/</span>
          <span style={time}>{formatTime(duration)}</span>
        </div>

        <div style={volBox}>
          🔊
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

      {disabled && (
        <div style={lockNote}>🔒 Limit reached. Please try again tomorrow.</div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles (UNCHANGED)                                                       */
/* -------------------------------------------------------------------------- */

const waveWrap = { width: "100%", height: 56, borderRadius: 12, background: "#f3f4f6", padding: 10 };
const card = { marginTop: 12, padding: 16, borderRadius: 16, border: "1px solid #e5e7eb", background: "#fff" };
const headerRow = { display: "flex", justifyContent: "space-between", marginBottom: 12 };
const badge = { width: 38, height: 38, borderRadius: 12, background: "#111827", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" };
const title = { fontWeight: 800, fontSize: 14 };
const sub = { fontSize: 12, color: "#6b7280" };
const controlsRow = { display: "flex", gap: 10, marginTop: 12 };
const playBtn = { borderRadius: 14, padding: "10px 14px", background: "#111827", color: "#fff", fontWeight: 800 };
const iconBtn = { border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 12px" };
const timeBox = { display: "flex", gap: 8, fontSize: 13, fontWeight: 700 };
const time = { fontVariantNumeric: "tabular-nums" };
const volBox = { display: "flex", gap: 8 };
const lockNote = { marginTop: 10, padding: 10, borderRadius: 12, background: "#fff1f2", color: "#9f1239", fontWeight: 700 };
