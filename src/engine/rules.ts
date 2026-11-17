import type { Player, Role, Team } from "./types";

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 12;

/** 5-6 players: 1 mafia, 7-9: 2 mafia, 10-12: 3 mafia */
export function mafiaCount(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 3));
}

export function buildRoleList(playerCount: number): Role[] {
  const mafia = mafiaCount(playerCount);
  const roles: Role[] = [];
  for (let i = 0; i < mafia; i++) roles.push("mafia");
  roles.push("doctor", "detective");
  while (roles.length < playerCount) roles.push("villager");
  return roles;
}

export function teamOf(role: Role): Team {
  return role === "mafia" ? "mafia" : "village";
}

/** Fisher-Yates shuffle. Takes an rng so games can be made deterministic later. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Village wins when no mafia remain.
 * Mafia wins when they equal or outnumber everyone else.
 */
export function checkWinner(players: Player[]): Team | null {
  const alive = players.filter((p) => p.alive);
  const mafia = alive.filter((p) => p.role === "mafia").length;
  const others = alive.length - mafia;
  if (mafia === 0) return "village";
  if (mafia >= others) return "mafia";
  return null;
}
