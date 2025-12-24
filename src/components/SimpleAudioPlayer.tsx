import React, { useRef, useState } from "react";
import {
  canPlayAudio,
  getRemainingPlays,
  incrementAudioPlay,
} from "../utils/audioLimit";

type Props = {
  src: string;
};

export default function SimpleAudioPlayer({ src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState(getRemainingPlays());
  const [toast, setToast] = useState("");

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;

    if (!canPlayAudio()) {
      setToast("Your limit reached. Try tomorrow.");
      return;
    }

    try {
      if (a.paused) {
        await a.play();
        setPlaying(true);
      } else {
        a.pause();
        setPlaying(false);
      }
    } catch {
      setToast("Playback blocked. Tap again.");
    }
  }

  function handleEnded() {
    incrementAudioPlay();
    setRemaining(getRemainingPlays());
    setPlaying(false);

    // reset for next allowed play
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
    }
  }

  const disabled = remaining === 0;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
      }}
    >
      <div style={{ marginBottom: 8, fontSize: 13 }}>
        🎵 Remaining full plays today: <strong>{remaining}</strong>
      </div>

      <button
        onClick={toggle}
        disabled={disabled}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "none",
          background: disabled ? "#9ca3af" : "#111827",
          color: "#fff",
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {disabled ? "Locked" : playing ? "Pause" : "Play"}
      </button>

      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={handleEnded}
        controls={false}
      >
        <source src={src} type="audio/mpeg" />
      </audio>

      {toast && (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#991b1b",
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
