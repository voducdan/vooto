// SuperMemo-2. Ported from bot/sr.py — keep in sync.

export type Rating = "again" | "hard" | "good" | "easy";
export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"];

export interface Card {
  ef: number;
  interval: number;
  reps: number;
  due: string;
  last_rating?: Rating;
  last_reviewed?: string;
}

const round = (n: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

export function newCard(now: Date = new Date()): Card {
  return { ef: 2.5, interval: 0.0, reps: 0, due: now.toISOString() };
}

export function rate(card: Partial<Card> | undefined, rating: Rating, now: Date = new Date()): Card {
  let ef = card?.ef ?? 2.5;
  const interval = card?.interval ?? 0.0;
  let reps = card?.reps ?? 0;
  let intervalDays: number;

  if (rating === "again") {
    reps = 0;
    intervalDays = 10 / (60 * 24);
  } else {
    if (rating === "hard") {
      ef = Math.max(1.3, ef - 0.15);
      intervalDays = reps > 0 ? Math.max(1.0, interval * 1.2) : 1.0;
    } else if (rating === "good") {
      if (reps === 0) intervalDays = 1.0;
      else if (reps === 1) intervalDays = 6.0;
      else intervalDays = interval * ef;
    } else {
      ef = ef + 0.15;
      if (reps === 0) intervalDays = 1.3;
      else if (reps === 1) intervalDays = 6.0 * 1.3;
      else intervalDays = interval * ef * 1.3;
    }
    reps += 1;
  }

  const dueMs = now.getTime() + intervalDays * 86400 * 1000;
  return {
    ef: round(ef, 3),
    interval: round(intervalDays, 4),
    reps,
    due: new Date(dueMs).toISOString(),
    last_rating: rating,
    last_reviewed: now.toISOString(),
  };
}

export function humanizeInterval(days: number): string {
  if (days < 1 / 24) return `${Math.floor(days * 24 * 60)}m`;
  if (days < 1) return `${Math.floor(days * 24)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${(days / 30).toFixed(1)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}
