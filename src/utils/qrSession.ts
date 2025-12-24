// src/utils/qrSession.ts
const SESSION_MS = 10 * 60 * 1000; // 10 minutes total session
const IDLE_MS = 5 * 60 * 1000;         // 5 minutes idle

const KEY = "qr-session-v1";

type Session = {
  sessionStart: number;
  lastActivity: number;
};

function now() {
  return Date.now();
}

function read(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.sessionStart || !s?.lastActivity) return null;
    return s;
  } catch {
    return null;
  }
}

function write(s: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function startSession(): void {
  const t = now();
  write({ sessionStart: t, lastActivity: t });
}

export function updateActivity(): void {
  const s = read();
  if (!s) return;
  write({ ...s, lastActivity: now() });
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY);
}

export function isSessionValid(): boolean {
  const s = read();
  if (!s) return false;

  const t = now();
  const sessionRemaining = SESSION_MS - (t - s.sessionStart);
  const idleRemaining = IDLE_MS - (t - s.lastActivity);

  return sessionRemaining > 0 && idleRemaining > 0;
}

export function getRemainingTimes(): { sessionRemaining: number; idleRemaining: number } | null {
  const s = read();
  if (!s) return null;

  const t = now();
  return {
    sessionRemaining: Math.max(0, SESSION_MS - (t - s.sessionStart)),
    idleRemaining: Math.max(0, IDLE_MS - (t - s.lastActivity)),
  };
}
