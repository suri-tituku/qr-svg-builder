import React, { useEffect, useRef, useState } from "react";
import {
  loadVideoWithCache,
  revokeVideoUrl,
} from "../utils/videoCache";

type Props = {
  src: string;
  ttlMs: number;
  encrypt?: boolean;
  remainingPlays: number;
  onBlocked: (msg: string) => void;
  onFullEnded: () => void;
};

export default function CustomVideoPlayer({
  src,
  ttlMs,
  encrypt,
  remainingPlays,
  onBlocked,
  onFullEnded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const disabled = remainingPlays <= 0;

  /* ------------------------------------------------------------------------ */
  /* 📦 Load video (cache handled internally)                                 */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { url, source } = await loadVideoWithCache({
          url: src,
          ttlMs,
          encrypt,
        });

        if (cancelled) return;

        objectUrlRef.current = url;
        if (videoRef.current) {
          videoRef.current.src = url;
        }

        console.log(
          source === "cache"
            ? "🎬 Video loaded from LOCAL CACHE"
            : "🌐 Video fetched from NETWORK"
        );

        setIsReady(true);
      } catch (e) {
        console.error(e);
        onBlocked("⚠️ Failed to load video.");
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        revokeVideoUrl(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src, ttlMs, encrypt, onBlocked]);

  /* ------------------------------------------------------------------------ */
  /* ▶️ Controls                                                              */
  /* ------------------------------------------------------------------------ */
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;

    if (disabled) {
      onBlocked("Your video play limit reached.");
      return;
    }

    if (!isReady) {
      onBlocked("Video still loading…");
      return;
    }

    if (v.paused) {
      v.play();
    } else {
      v.pause();
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    onFullEnded();

    // reset for replay
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* 🧾 UI                                                                     */
  /* ------------------------------------------------------------------------ */
  return (
    <div style={card}>
      <div style={header}>
        <strong>🎬 Video Player</strong>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Remaining plays: {remainingPlays}
        </span>
      </div>

      <video
        ref={videoRef}
        controls={false}
        playsInline
        preload="metadata"
        style={video}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
      />

      <button
        onClick={togglePlay}
        disabled={disabled || !isReady}
        style={{
          ...btn,
          opacity: disabled || !isReady ? 0.5 : 1,
          cursor:
            disabled || !isReady ? "not-allowed" : "pointer",
        }}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play"}
      </button>

      {disabled && (
        <div style={lock}>
          🔒 Video play limit reached
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles                                                                  */
/* -------------------------------------------------------------------------- */
const card: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 8,
};

const video: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  background: "#000",
};

const btn: React.CSSProperties = {
  marginTop: 10,
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  fontWeight: 700,
  background: "#111827",
  color: "#fff",
};

const lock: React.CSSProperties = {
  marginTop: 8,
  padding: 8,
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 700,
  background: "#fff1f2",
  color: "#9f1239",
};
