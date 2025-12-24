import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  isSessionValid,
  updateActivity,
  clearSession,
  getRemainingTimes,
} from "../utils/qrSession";

import { incrementAudioPlay, getRemainingPlays } from "../utils/audioLimit";

import Toast from "../components/Toast";
import CustomAudioPlayer from "../components/CustomAudioPlayer";


import { getCachedAudioUrlOrFetch } from "../utils/audioCache";
import { clearExpiredAudioCache } from "../utils/audioCache";
import { clearAllAudioCache } from "../utils/audioCache";

/* -------------------------------------------------------------------------- */
/* 🧩 Helpers                                                                  */
/* -------------------------------------------------------------------------- */

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* 🧠 Page                                                                     */
/* -------------------------------------------------------------------------- */

export default function QrProtectedPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [sessionLeft, setSessionLeft] = useState(0);
  const [idleLeft, setIdleLeft] = useState(0);
  const [toast, setToast] = useState("");
  const [remainingPlays, setRemainingPlays] = useState(getRemainingPlays());

  // Object URL for Howler
  const [audioUrl, setAudioUrl] = useState<string>("");

  // GitHub Pages–safe public path
  const remoteAudioUrl =
    window.location.origin +
    import.meta.env.BASE_URL +
    "Raa_Baa_30s.mp3";


  /* ------------------------------------------------------------------------ */
  /* 🔐 Session Guard + cache lifecycle                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    clearExpiredAudioCache().catch(() => {});

    if (!isSessionValid()) {
      clearSession();
      clearAllAudioCache().catch(() => {});
      navigate(`/qr/${id}`);
      return;
    }

    const timer = setInterval(() => {
      const times = getRemainingTimes();
      if (!times || !isSessionValid()) {
        clearSession();
        clearAllAudioCache().catch(() => {});
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
    ] as const;

    const onActivity = () => updateActivity();
    events.forEach((e) => window.addEventListener(e, onActivity));

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [navigate, id]);

  /* ------------------------------------------------------------------------ */
  /* 📦 Preload audio into IndexedDB cache                                     */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { blob, source } = await getCachedAudioUrlOrFetch(
          remoteAudioUrl
        );

        if (cancelled) return;

        const objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);

        console.log(
          source === "cache"
            ? "✅ Audio loaded from LOCAL CACHE"
            : "🌐 Audio fetched from NETWORK"
        );
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setToast("⚠️ Failed to load audio.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteAudioUrl]);

  /* ------------------------------------------------------------------------ */
  /* 🎵 Play Count — ONLY ON FULL END                                          */
  /* ------------------------------------------------------------------------ */

  function handleFullEnded() {
    incrementAudioPlay();
    setRemainingPlays(getRemainingPlays());
  }

  /* ------------------------------------------------------------------------ */
  /* 🧾 UI                                                                     */
  /* ------------------------------------------------------------------------ */

  return (
    <div style={page}>
      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div style={badge}>🔓 Protected</div>
          <h2 style={title}>QR Protected Content</h2>
          <p style={subtitle}>
            Session + idle lock • Full-play limit enforced
          </p>
        </div>

        {/* Timers */}
        <div style={timers}>
          <div style={timerRow}>
            <span>⏳ Session expires in</span>
            <strong>{format(sessionLeft)}</strong>
          </div>
          <div style={timerRow}>
            <span>💤 Idle lock in</span>
            <strong>{format(idleLeft)}</strong>
          </div>
        </div>

        {/* Image */}
        <div style={imageWrap}>
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4"
            alt="Protected"
            style={image}
            draggable={false}
          />
        </div>

        {/* 🎵 Audio Player */}
        <CustomAudioPlayer
          src={audioUrl || remoteAudioUrl}
          remainingPlays={remainingPlays}
          onBlocked={(msg) => setToast(msg)}
          onFullEnded={handleFullEnded}
        />

        {toast && <Toast message={toast} onClose={() => setToast("")} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles (UNCHANGED)                                                      */
/* -------------------------------------------------------------------------- */

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(1200px 600px at 50% 0%, #000 0%, #292929 55%, #444 100%)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  padding: 24,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
};

const header: React.CSSProperties = { textAlign: "center" };

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#eef2ff",
  color: "#3730a3",
  marginBottom: 8,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: "#111827",
};

const subtitle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#6b7280",
};

const timers: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const timerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 14,
  marginBottom: 6,
};

const imageWrap: React.CSSProperties = {
  marginTop: 16,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const image: React.CSSProperties = {
  width: "100%",
  display: "block",
};
