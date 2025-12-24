// src/utils/audioLimit.ts
const MAX_PLAYS = 5;
const SALT = "bfouru-audio-limit-v2"; // change occasionally if needed

type LimitState = {
  dateKey: string; // YYYY-MM-DD
  used: number;
  sig: string; // integrity hash
};

function dateKeyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function storageKey() {
  return "bfouru_audio_limit_state";
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(state: { dateKey: string; used: number }) {
  return sha256(`${state.dateKey}|${state.used}|${SALT}`);
}

async function readState(): Promise<LimitState> {
  const raw = localStorage.getItem(storageKey());
  const today = dateKeyLocal();

  if (!raw) {
    const sig = await sign({ dateKey: today, used: 0 });
    return { dateKey: today, used: 0, sig };
  }

  try {
    const parsed = JSON.parse(raw) as LimitState;

    // new day -> reset
    if (parsed.dateKey !== today) {
      const sig = await sign({ dateKey: today, used: 0 });
      return { dateKey: today, used: 0, sig };
    }

    // verify signature
    const expected = await sign({ dateKey: parsed.dateKey, used: parsed.used });
    if (expected !== parsed.sig) {
      // tampered -> reset
      const sig = await sign({ dateKey: today, used: 0 });
      return { dateKey: today, used: 0, sig };
    }

    // clamp
    const used = Math.max(0, Math.min(MAX_PLAYS, Number(parsed.used) || 0));
    const sig = await sign({ dateKey: today, used });
    return { dateKey: today, used, sig };
  } catch {
    const sig = await sign({ dateKey: today, used: 0 });
    return { dateKey: today, used: 0, sig };
  }
}

async function writeState(state: { dateKey: string; used: number }) {
  const sig = await sign(state);
  const payload: LimitState = { ...state, sig };
  localStorage.setItem(storageKey(), JSON.stringify(payload));
}

export async function getRemainingPlays(): Promise<number> {
  const st = await readState();
  return Math.max(0, MAX_PLAYS - st.used);
}

export async function canPlayAudio(): Promise<boolean> {
  return (await getRemainingPlays()) > 0;
}

// ✅ call ONLY when audio fully ended
export async function incrementAudioPlay(): Promise<void> {
  const st = await readState();
  const used = Math.min(MAX_PLAYS, st.used + 1);
  await writeState({ dateKey: st.dateKey, used });
}
