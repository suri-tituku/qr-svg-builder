import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* -------------------------------------------------------------------------- */
/* 🧩 Helpers                                                                  */
/* -------------------------------------------------------------------------- */

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* -------------------------------------------------------------------------- */
/* 🧠 Page                                                                     */
/* -------------------------------------------------------------------------- */

export default function QrProtectedPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🔒 Seeking prevention
  const lastAllowedTime = useRef(0);
  const seekingGuard = useRef(false);

  // ✅ Play-count logic
  const startedThisRun = useRef(false); // becomes true when user truly starts playing
  const countedThisRun = useRef(false); // becomes true when ended triggers increment
  const userInitiated = useRef(false); // set on Play button click (our button)

  const [sessionLeft, setSessionLeft] = useState(0);
  const [idleLeft, setIdleLeft] = useState(0);
  const [toast, setToast] = useState("");

  const [remainingPlays, setRemainingPlays] = useState(getRemainingPlays());

  const audioDisabled = remainingPlays === 0;

  // Custom player UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const progressPct = useMemo(() => {
    if (!duration) return 0;
    return clamp((current / duration) * 100, 0, 100);
  }, [current, duration]);

  /* -------------------------------------------------------------------------- */
  /* 🔐 Session Guard                                                           */
  /* -------------------------------------------------------------------------- */
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
    ] as const;

    const onActivity = () => updateActivity();
    events.forEach((e) => window.addEventListener(e, onActivity));

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [navigate, id]);

  /* -------------------------------------------------------------------------- */
  /* 🎵 Audio: strict rules (no seek, count on ended)                           */
  /* -------------------------------------------------------------------------- */


  function hardLockAndRedirect() {
    clearSession();
    navigate(`/qr/${id}`);
  }

  function handleLoadedMetadata() {
    const a = audioRef.current;
    if (!a) return;
    setDuration(Number.isFinite(a.duration) ? a.duration : 0);
  }

  function handleTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;

    setCurrent(a.currentTime || 0);

    // Update last allowed time only when NOT seeking (and not our correction jump)
    if (!a.seeking && !seekingGuard.current) {
      lastAllowedTime.current = a.currentTime;
    }
  }

  function handleSeeking() {
    const a = audioRef.current;
    if (!a) return;

    // If user tries to seek, force back to lastAllowedTime
    seekingGuard.current = true;
    try {
      a.currentTime = lastAllowedTime.current;
    } finally {
      // release guard after a tick
      window.setTimeout(() => {
        seekingGuard.current = false;
      }, 0);
    }
  }

function handleEnded() {
  if (countedThisRun.current) return;

  countedThisRun.current = true;
  startedThisRun.current = false;
  userInitiated.current = false;

  incrementAudioPlay();

  const updated = getRemainingPlays();
  setRemainingPlays(updated);

  const a = audioRef.current;
  if (a) {
    a.pause();
    a.currentTime = 0;
  }

  lastAllowedTime.current = 0;
  setIsPlaying(false);
  setCurrent(0);
}



  function handlePause() {
    setIsPlaying(false);
  }

  function handlePlayNativeEvent(e: React.SyntheticEvent<HTMLAudioElement>) {
    // Safety: if limit reached, block play even if something triggers audio.play()
    if (!canPlayAudio()) {
      e.preventDefault();
      e.currentTarget.pause();
      setIsPlaying(false);
      setToast("Your limit reached. Try it tomorrow.");
      return;
    }

    // Prevent autoplay / weird triggers: require our button click to set userInitiated
    // If you want to allow direct play by clicking audio element, remove this block.
    if (!userInitiated.current) {
      e.preventDefault();
      e.currentTarget.pause();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    // Mark this "run" started
    if (!startedThisRun.current) {
      startedThisRun.current = true;
      countedThisRun.current = false;
    }
  }

  // If session becomes invalid while on page (timers), lock immediately
  useEffect(() => {
    if (!isSessionValid()) {
      hardLockAndRedirect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLeft, idleLeft]);

  /* -------------------------------------------------------------------------- */
  /* 🎛️ Custom Controls                                                         */
  /* -------------------------------------------------------------------------- */

  async function togglePlay() {
    const a = audioRef.current;
    if (!a) return;

    if (!isSessionValid()) {
      clearSession();
      navigate(`/qr/${id}`);
      return;
    }

    if (!canPlayAudio() || audioDisabled) {
      setToast("Your limit reached. Try it tomorrow.");
      return;
    }

    try {
      if (a.paused) {
        userInitiated.current = true;

        // 🔥 If audio is at end, reset before play
        if (a.currentTime >= a.duration && a.duration > 0) {
          a.currentTime = 0;
          lastAllowedTime.current = 0;
          setCurrent(0);
        }

        await a.play();
      } else {
        a.pause();
      }
    } catch {
      setToast("Tap Play again (browser blocked playback).");
    }
  }


  function restartAudio() {
    const a = audioRef.current;
    if (!a) return;

    if (!canPlayAudio() || audioDisabled) {
      setToast("Your limit reached. Try it tomorrow.");
      return;
    }

    // Restart is allowed but still within same run, counts only at ended
    seekingGuard.current = true;
    a.currentTime = 0;
    lastAllowedTime.current = 0;
    setCurrent(0);
    window.setTimeout(() => {
      seekingGuard.current = false;
    }, 0);
  }

  /* -------------------------------------------------------------------------- */
  /* 🧾 UI                                                                      */
  /* -------------------------------------------------------------------------- */

  return (
    <div style={page}>
      <div style={card} className="fadeInUp">
        <div style={header}>
          <div style={badge}>🔓 Protected</div>
          <h2 style={title}>QR Protected Page</h2>
          <p style={subtitle}>
            Session + idle lock enabled • Full-play limit enabled
          </p>
        </div>

        {/* Timers */}
        <div style={timers} className="softPop">
          <div style={timerRow}>
            <span style={timerIcon}>⏳</span>
            <span>Session expires in</span>
            <strong style={timerStrong}>{format(sessionLeft)}</strong>
          </div>
          <div style={timerRow}>
            <span style={timerIcon}>💤</span>
            <span>Idle lock in</span>
            <strong style={timerStrong}>{format(idleLeft)}</strong>
          </div>
        </div>

        {/* Image */}
        <div style={imageWrap} className="softPop">
          <img
            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4"
            alt="Protected"
            style={image}
            draggable={false}
          />
        </div>

        {/* Remaining Plays */}
        <div style={playsBox} className="fadeIn">
          <div style={playsLine}>
            🎵 Remaining full plays today:{" "}
            <strong style={{ marginLeft: 6 }}>{remainingPlays}</strong>
          </div>
          <div style={playsHint}>
            Counts only when the audio finishes completely.
          </div>
        </div>

        {/* Custom Player */}
        <div style={playerCard} className="softPop">
          <div style={playerTop}>
            <div style={trackTitle}>
              <span style={{ marginRight: 8 }}>🎧</span> Raa_Baa
            </div>

            <button
              type="button"
              onClick={togglePlay}
              disabled={audioDisabled}
              style={{
                ...playBtn,
                ...(audioDisabled ? playBtnDisabled : null),
              }}
              className="press"
              aria-disabled={audioDisabled}
            >
              {audioDisabled ? "Locked" : isPlaying ? "Pause" : "Play"}
            </button>
          </div>

          {/* Progress (display only, no seeking) */}
          <div style={progressWrap}>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${progressPct}%` }} />
            </div>
            <div style={timeRow}>
              <span>{format(current * 1000)}</span>
              <span>{format(duration * 1000)}</span>
            </div>
          </div>

          <div style={playerActions}>
            <button
              type="button"
              onClick={restartAudio}
              disabled={audioDisabled}
              style={{
                ...smallBtn,
                ...(audioDisabled ? smallBtnDisabled : null),
              }}
              className="press"
            >
              ⟲ Restart
            </button>

            <div style={rules}>
              <span style={rulePill}>🔒 No seeking</span>
              <span style={rulePill}>✅ Counts on finish</span>
              <span style={rulePill}>⏱ Session lock</span>
            </div>
          </div>

          {/* Hidden native audio (we listen to events) */}
          <audio
            ref={audioRef}
            preload="metadata"
            controls={false}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onSeeking={handleSeeking}
            onEnded={handleEnded}
            onPlay={handlePlayNativeEvent}
            onPause={handlePause}
            style={{ display: "none" }}
          >
            {/* ✅ IMPORTANT for GitHub Pages:
               Use /qr-svg-builder/Raa_Baa.mp3 if your repo name is qr-svg-builder
               OR put mp3 in /public and reference with import.meta.env.BASE_URL + "Raa_Baa.mp3"
            */}
            <source src={`${import.meta.env.BASE_URL}Raa_Baa.mp3`} type="audio/mpeg" />
          </audio>

          {audioDisabled && (
            <div style={overlay} className="fadeIn">
              <div style={overlayBox}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>🔒 Limit reached</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Try again tomorrow.
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && <Toast message={toast} onClose={() => setToast("")} />}

        {/* Tiny CSS animations without libs */}
        <style>{css}</style>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles                                                                   */
/* -------------------------------------------------------------------------- */

const page: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "48px 16px",
  background:
    "radial-gradient(1200px 600px at 50% 0%, #000000ff 0%, #292929ff 55%, #444444ff 100%)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
};

const header: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: 10,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#eef2ff",
  color: "#3730a3",
  marginBottom: 10,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: 0.2,
  color: "#111827",
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 13,
  color: "#6b7280",
};

const timers: React.CSSProperties = {
  marginTop: 14,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
};

const timerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 14,
  color: "#111827",
  gap: 10,
  padding: "6px 2px",
};

const timerIcon: React.CSSProperties = {
  width: 26,
  textAlign: "center",
};

const timerStrong: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

const imageWrap: React.CSSProperties = {
  marginTop: 14,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const image: React.CSSProperties = {
  width: "100%",
  display: "block",
};

const playsBox: React.CSSProperties = {
  marginTop: 14,
  textAlign: "center",
};

const playsLine: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const playsHint: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#6b7280",
};

const playerCard: React.CSSProperties = {
  position: "relative",
  marginTop: 14,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fff",
  padding: 14,
};

const playerTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const trackTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
  display: "flex",
  alignItems: "center",
};

const playBtn: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 800,
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(17,24,39,0.18)",
};

const playBtnDisabled: React.CSSProperties = {
  background: "#9ca3af",
  cursor: "not-allowed",
  boxShadow: "none",
};

const progressWrap: React.CSSProperties = {
  marginTop: 12,
};

const progressTrack: React.CSSProperties = {
  width: "100%",
  height: 10,
  background: "#f3f4f6",
  borderRadius: 999,
  overflow: "hidden",
  border: "1px solid #e5e7eb",
};

const progressFill: React.CSSProperties = {
  height: "100%",
  background: "#111827",
  width: "0%",
  transition: "width 120ms linear",
};

const timeRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
  fontSize: 12,
  color: "#6b7280",
  fontVariantNumeric: "tabular-nums",
};

const playerActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 12,
  flexWrap: "wrap",
};

const smallBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "8px 10px",
  fontSize: 13,
  fontWeight: 700,
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const smallBtnDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const rules: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  flex: 1,
};

const rulePill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "6px 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#111827",
  border: "1px solid #e5e7eb",
};

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(6px)",
};

const overlayBox: React.CSSProperties = {
  textAlign: "center",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 800,
  boxShadow: "0 10px 25px rgba(153,27,27,0.12)",
};

const css = `
.fadeInUp{animation: fadeInUp .35s ease-out both;}
.fadeIn{animation: fadeIn .25s ease-out both;}
.softPop{animation: softPop .32s ease-out both;}
.press{transition: transform .12s ease, filter .12s ease;}
.press:active{transform: translateY(1px) scale(.99);}
@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes softPop{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}}
`;
