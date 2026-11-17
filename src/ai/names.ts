import { shuffle } from "../engine";

const BOT_NAMES = [
  "Vinnie",
  "Lucky",
  "Rosa",
  "Marco",
  "Sal",
  "Gina",
  "Tony",
  "Bianca",
  "Enzo",
  "Carla",
  "Luca",
  "Mimi",
  "Dante",
  "Sofia",
  "Rocco",
  "Nico",
];

/** Pick `count` bot names that don't clash with names in `exclude`. */
export function pickBotNames(
  count: number,
  exclude: string[] = [],
  rng: () => number = Math.random,
): string[] {
  const taken = new Set(exclude.map((n) => n.trim().toLowerCase()));
  const pool = BOT_NAMES.filter((n) => !taken.has(n.toLowerCase()));
  return shuffle(pool, rng).slice(0, count);
}
