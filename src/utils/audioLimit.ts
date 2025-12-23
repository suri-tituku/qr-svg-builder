const MAX_PLAYS_PER_DAY = 2;

function todayKey() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

export function getRemainingPlays(): number {
  const today = todayKey();
  const raw = localStorage.getItem("audioPlayLimit");

  if (!raw) return MAX_PLAYS_PER_DAY;

  try {
    const data = JSON.parse(raw);
    if (data.date !== today) return MAX_PLAYS_PER_DAY;

    return Math.max(0, MAX_PLAYS_PER_DAY - data.count);
  } catch {
    return MAX_PLAYS_PER_DAY;
  }
}

export function canPlayAudio(): boolean {
  return getRemainingPlays() > 0;
}

export function incrementAudioPlay(): void {
  const today = todayKey();
  const raw = localStorage.getItem("audioPlayLimit");

  if (!raw) {
    localStorage.setItem(
      "audioPlayLimit",
      JSON.stringify({ date: today, count: 1 })
    );
    return;
  }

  try {
    const data = JSON.parse(raw);

    if (data.date !== today) {
      localStorage.setItem(
        "audioPlayLimit",
        JSON.stringify({ date: today, count: 1 })
      );
    } else {
      localStorage.setItem(
        "audioPlayLimit",
        JSON.stringify({
          date: today,
          count: data.count + 1,
        })
      );
    }
  } catch {
    localStorage.removeItem("audioPlayLimit");
  }
}
