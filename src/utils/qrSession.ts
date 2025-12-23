/* -------------------------------------------------------------------------- */
/* ⏱️ Session Configuration                                                   */
/* -------------------------------------------------------------------------- */

export const IDLE_LIMIT = 1 * 60 * 1000; // 2 minutes (idle)
export const MAX_SESSION = 2 * 60 * 1000; // 5 minutes (absolute)

/* -------------------------------------------------------------------------- */
/* 🧠 Types                                                                   */
/* -------------------------------------------------------------------------- */

export interface QrSession {
  unlockedAt: number;
  lastActivityAt: number;
}

/* -------------------------------------------------------------------------- */
/* 🔐 Session Validation                                                      */
/* -------------------------------------------------------------------------- */

export function isSessionValid(): boolean {
  const raw = sessionStorage.getItem("qrSession");
  if (!raw) return false;

  try {
    const { unlockedAt, lastActivityAt }: QrSession = JSON.parse(raw);
    const now = Date.now();

    // Absolute expiry (even if user is active)
    if (now - unlockedAt > MAX_SESSION) {
      return false;
    }

    // Idle expiry (no activity)
    if (now - lastActivityAt > IDLE_LIMIT) {
      return false;
    }

    return true;
  } catch {
    // Corrupted session
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* 🔄 Activity Tracking                                                       */
/* -------------------------------------------------------------------------- */

export function updateActivity(): void {
  const raw = sessionStorage.getItem("qrSession");
  if (!raw) return;

  try {
    const data: QrSession = JSON.parse(raw);

    sessionStorage.setItem(
      "qrSession",
      JSON.stringify({
        ...data,
        lastActivityAt: Date.now(),
      })
    );
  } catch {
    // Ignore invalid session data
  }
}

/* -------------------------------------------------------------------------- */
/* 🧹 Clear Session                                                           */
/* -------------------------------------------------------------------------- */

export function clearSession(): void {
  sessionStorage.removeItem("qrSession");
}

/* -------------------------------------------------------------------------- */
/* ⏳ Countdown Helpers (UX timers)                                            */
/* -------------------------------------------------------------------------- */

export function getRemainingTimes(): {
  sessionRemaining: number;
  idleRemaining: number;
} | null {
  const raw = sessionStorage.getItem("qrSession");
  if (!raw) return null;

  try {
    const { unlockedAt, lastActivityAt }: QrSession = JSON.parse(raw);
    const now = Date.now();

    return {
      sessionRemaining: Math.max(
        0,
        MAX_SESSION - (now - unlockedAt)
      ),
      idleRemaining: Math.max(
        0,
        IDLE_LIMIT - (now - lastActivityAt)
      ),
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* 🆕 Initialize Session (on password success)                                */
/* -------------------------------------------------------------------------- */

export function startSession(): void {
  const now = Date.now();

  const session: QrSession = {
    unlockedAt: now,
    lastActivityAt: now,
  };

  sessionStorage.setItem("qrSession", JSON.stringify(session));
}
