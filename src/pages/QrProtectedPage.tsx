import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  isSessionValid,
  updateActivity,
  clearSession,
  getRemainingTimes,
} from "../utils/qrSession";
import {
  canPlayAudio,
  incrementAudioPlay,
  getRemainingPlays,
} from "../utils/audioLimit";
import Toast from "../components/Toast";

function format(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function QrProtectedPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [sessionLeft, setSessionLeft] = useState(0);
  const [idleLeft, setIdleLeft] = useState(0);
  const [toast, setToast] = useState("");
  const [remainingPlays, setRemainingPlays] = useState(
    getRemainingPlays()
  );

  useEffect(() => {
    if (!isSessionValid()) {
      clearSession();
      navigate(`/qr/${id}`);
      return;
    }

    const timer = setInterval(() => {
      const times = getRemainingTimes();

      if (!times || !isSessionValid()) {
        clearSession();
        navigate(`/qr/${id}`);
        return;
      }

      setSessionLeft(times.sessionRemaining);
      setIdleLeft(times.idleRemaining);
      setRemainingPlays(getRemainingPlays());
    }, 1000);

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "touchmove",
    ];

    const onActivity = () => updateActivity();
    events.forEach((e) => window.addEventListener(e, onActivity));

    return () => {
      clearInterval(timer);
      events.forEach((e) =>
        window.removeEventListener(e, onActivity)
      );
    };
  }, [navigate, id]);

  function handlePlay(
    e: React.SyntheticEvent<HTMLAudioElement>
  ) {
    if (!canPlayAudio()) {
      e.preventDefault();
      e.currentTarget.pause();
      setToast("Your limit reached. Try it tomorrow.");
      return;
    }

    incrementAudioPlay();
    setRemainingPlays(getRemainingPlays());
  }

  const audioDisabled = remainingPlays === 0;

  const lockOverlay = {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    color: "#991b1b",
  };

  return (
    <div style={container}>
      <h2>🔓 Protected Content</h2>

      {/* Timers */}
      <div style={timerBox}>
        <div>
          ⌛ Session expires in:{" "}
          <strong>{format(sessionLeft)}</strong>
        </div>
        <div>
          💤 Idle lock in:{" "}
          <strong>{format(idleLeft)}</strong>
        </div>
      </div>

      <img
        src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4"
        alt="Protected"
        style={{ width: "100%", borderRadius: 12 }}
      />

      {/* Remaining Plays */}
      <div style={playCounter}>
        🎵 Remaining plays today:{" "}
        <strong>{remainingPlays}</strong>
      </div>

      <div style={{ position: "relative", marginTop: 10 }}>
        <audio
          ref={audioRef}
          controls
          style={{
            width: "100%",
            opacity: audioDisabled ? 0.5 : 1,
            pointerEvents: audioDisabled ? "none" : "auto",
          }}
          onPlay={handlePlay}
        >
          <source src="Raa_Baa.mp3" type="audio/mpeg" />
        </audio>

        {audioDisabled && (
          <div style={lockOverlay}>
            🔒 Limit reached
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast("")}
        />
      )}
    </div>
  );
}

const container = {
  maxWidth: 480,
  margin: "60px auto",
  padding: 24,
  textAlign: "center" as const,
};

const timerBox = {
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  marginBottom: 16,
  fontSize: 14,
};

const playCounter = {
  marginTop: 14,
  fontSize: 14,
  fontWeight: 600,
};
