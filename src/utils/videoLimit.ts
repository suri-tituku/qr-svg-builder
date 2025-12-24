// src/utils/videoLimit.ts
const MAX_VIDEO_PLAYS = 5;

function todayKey() {
  const d = new Date();
  return `video-plays-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function getRemainingVideoPlays(): number {
  const used = Number(localStorage.getItem(todayKey()) || "0");
  return Math.max(0, MAX_VIDEO_PLAYS - used);
}

export function incrementVideoPlay(): void {
  const key = todayKey();
  const used = Number(localStorage.getItem(key) || "0");
  localStorage.setItem(key, String(used + 1));
}

export function canPlayVideo(): boolean {
  return getRemainingVideoPlays() > 0;
}
