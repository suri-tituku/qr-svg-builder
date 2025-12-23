import { useEffect, useRef, useState } from "react";
import {
  canPlayAudio,
  incrementAudioPlay,
  getRemainingPlays,
} from "../utils/audioLimit";

type Props = {
  src: string;
  onLimitReached: () => void;
};

export default function CustomAudioPlayer({
  src,
  onLimitReached,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const allowedTime = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [remainingPlays, setRemainingPlays] = useState(
    getRemainingPlays()
  );

  /* -------------------------------------------------------------------------- */
  /* 🔐 Guard Play                                                              */
  /* -------------------------------------------------------------------------- */

  function play() {
    if (!canPlayAudio()) {
      onLimitReached();
      return;
    }
    audioRef.current?.play();
  }

  function pause() {
    audioRef.current?.pause();
  }

  /* -------------------------------------------------------------------------- */
  /* 🎵 Audio Events                                                            */
  /* -------------------------------------------------------------------------- */

  function onLoaded() {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;

    // Block seeking
    if (audio.currentTime > allowedTime.current + 0.3) {
      audio.currentTime = allowedTime.current;
      return;
    }

    allowedTime.current = audio.currentTime;
    setProgress(audio.currentTime);
  }

  function onEnded() {
    incrementAudioPlay();
    setRemainingPlays(getRemainingPlays());
    setIsPlaying(false);
    allowedTime.current = 0;
    setProgress(0);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      audio.removeEventListener("play", () => setIsPlaying(true));
      audio.removeEventListener("pause", () => setIsPlaying(false));
    };
  }, []);

  const disabled = remainingPlays === 0;

  return (
    <div style={wrapper}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />

      {/* Controls */}
      <button
        onClick={isPlaying ? pause : play}
        disabled={disabled}
        style={{
          ...btn,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {isPlaying ? "⏸ Pause" : "▶️ Play"}
      </button>

      {/* Progress (read-only) */}
      <div style={progressBar}>
        <div
          style={{
            ...progressFill,
            width:
              duration > 0
                ? `${(progress / duration) * 100}%`
                : "0%",
          }}
        />
      </div>

      <div style={meta}>
        ⏱ {Math.floor(progress)} / {Math.floor(duration)} sec  
        <br />
        🎵 Remaining plays: <strong>{remainingPlays}</strong>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles                                                                   */
/* -------------------------------------------------------------------------- */

const wrapper = {
  marginTop: 16,
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 10,
};

const btn = {
  padding: "8px 14px",
  fontSize: 14,
  cursor: "pointer",
};

const progressBar = {
  marginTop: 10,
  height: 6,
  background: "#e5e7eb",
  borderRadius: 4,
  overflow: "hidden",
};

const progressFill = {
  height: "100%",
  background: "#2563eb",
};

const meta = {
  marginTop: 8,
  fontSize: 12,
};
