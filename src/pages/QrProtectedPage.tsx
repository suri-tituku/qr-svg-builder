import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import CustomVideoPlayerUltra from "../components/CustomVideoPlayerUltra";
import CustomAudioPlayerUltra from "../components/CustomAudioPlayerUltra";
import HeartParticleOverlay from "../components/HeartParticleOverlay";




import {
  isSessionValid,
  updateActivity,
  clearSession,
  getRemainingTimes,
} from "../utils/qrSession";

import {
  incrementAudioPlay,
  getRemainingPlays,
} from "../utils/audioLimit";

import {
  getRemainingVideoPlays,
  incrementVideoPlay,
} from "../utils/videoLimit";

import {
  clearAllAudioCache,
  clearExpiredAudioCache,
} from "../utils/audioCache";

import {
  clearAllVideoCache,
  clearExpiredVideoCache,
} from "../utils/videoCache";

import Toast from "../components/Toast";

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

  const [audioRemaining, setAudioRemaining] = useState(0);
  const [videoRemaining, setVideoRemaining] = useState(0);

  const [limitReady, setLimitReady] = useState(false);

  const [showParticles, setShowParticles] = useState(true);

  /* ------------------------------------------------------------------------ */
  /* ✅ Remote media URLs (GitHub Pages safe)                                  */
  /* ------------------------------------------------------------------------ */
  const remoteAudioUrl =
    window.location.origin +
    import.meta.env.BASE_URL +
    "Raa_Baa_30s.mp3";

  const remoteVideoUrl =
    window.location.origin +
    import.meta.env.BASE_URL +
    "Sample_720p_30s.mp4";

  /* ------------------------------------------------------------------------ */
  /* 🎯 Load limits once                                                       */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    let dead = false;
    (async () => {
      const a = await getRemainingPlays();
      const v = await getRemainingVideoPlays();
      if (!dead) {
        setAudioRemaining(a);
        setVideoRemaining(v);
        setLimitReady(true);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* 🔐 Session Guard + cache lifecycle                                        */
  /* ------------------------------------------------------------------------ */
  useEffect(() => {
    clearExpiredAudioCache().catch(() => {});
    clearExpiredVideoCache().catch(() => {});

    if (!isSessionValid()) {
      clearSession();
      clearAllAudioCache().catch(() => {});
      clearAllVideoCache().catch(() => {});
      navigate(`/qr/${id}`);
      return;
    }

    const timer = setInterval(async () => {
      const times = getRemainingTimes();
      if (!times || !isSessionValid()) {
        clearSession();
        clearAllAudioCache().catch(() => {});
        clearAllVideoCache().catch(() => {});
        navigate(`/qr/${id}`);
        return;
      }

      setSessionLeft(times.sessionRemaining);
      setIdleLeft(times.idleRemaining);

      setAudioRemaining(await getRemainingPlays());
      setVideoRemaining(await getRemainingVideoPlays());
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
      events.forEach((e) =>
        window.removeEventListener(e, onActivity)
      );
    };
  }, [navigate, id]);

  /* ------------------------------------------------------------------------ */
  /* 🎵 Count ONLY on full end                                                 */
  /* ------------------------------------------------------------------------ */
  async function handleAudioEnded() {
    await incrementAudioPlay();
    setAudioRemaining(await getRemainingPlays());
  }

  async function handleVideoEnded() {
    await incrementVideoPlay();
    setVideoRemaining(await getRemainingVideoPlays());
  }

  /* ------------------------------------------------------------------------ */
  /* 🧾 UI                                                                     */
  /* ------------------------------------------------------------------------ */
return (
    <>
    {/* ❤️ Heart particles OVER the page */}
    {showParticles && (
      <HeartParticleOverlay
        onFinish={() => setShowParticles(false)}
      />
    )}

    {/* 🧠 Page is ALWAYS rendered */}
  <motion.div
    style={page}
    initial={{ opacity: 0, scale: 0.96 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{
      duration: 1,
      ease: [0.22, 1, 0.36, 1], // smooth premium easing
    }}
  >
    <div style={page}>
      <div style={card}>
        <div style={header}>
          <div style={badge}>🔓 Protected</div>
          <h2 style={title}>QR Protected Content</h2>
          <p style={subtitle}>
            Session + idle lock • Play limits enforced
          </p>
        </div>

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

        <div style={imageWrap}>
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4"
            alt="Protected"
            style={image}
            draggable={false}
          />
        </div>

        {/* 🎧 AUDIO */}
        <CustomAudioPlayerUltra
          src={remoteAudioUrl}
          remainingPlays={audioRemaining}
          onBlocked={setToast}
          onFullEnded={handleAudioEnded}
        />

        {/* 🎬 VIDEO */}
        <CustomVideoPlayerUltra
            src={remoteVideoUrl}
            remainingPlays={videoRemaining}
            onBlocked={setToast}
            onFullEnded={handleVideoEnded}
          />



        {toast && (
          <Toast message={toast} onClose={() => setToast("")} />
        )}
      </div>
    </div>
   </motion.div>
  
  </>
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
