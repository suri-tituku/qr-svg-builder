import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  isSessionValid,
  updateActivity,
  clearSession,
  getRemainingTimes,
} from "../utils/qrSession";

function format(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function QrProtectedPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [sessionLeft, setSessionLeft] = useState(0);
  const [idleLeft, setIdleLeft] = useState(0);

  useEffect(() => {
    // Initial guard
    if (!isSessionValid()) {
      clearSession();
      navigate(`/qr/${id}`);
      return;
    }

    // Tick every second
    const timer = setInterval(() => {
      const times = getRemainingTimes();

      if (!times || !isSessionValid()) {
        clearSession();
        navigate(`/qr/${id}`);
        return;
      }

      setSessionLeft(times.sessionRemaining);
      setIdleLeft(times.idleRemaining);
    }, 1000);

    // Activity listeners
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
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [navigate, id]);

  return (
    <div style={container}>
      <h2>🔓 Protected Content</h2>

      {/* ⏳ Timers */}
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

      <audio controls style={{ width: "100%", marginTop: 16 }}>
        <source src="Raa_Baa.mp3" type="audio/mpeg" />
      </audio>

      <p style={{ marginTop: 12, fontSize: 13, color: "#555" }}>
        This page auto-locks after inactivity or expiry.
      </p>
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
