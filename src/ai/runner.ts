import { castVote, shuffle, submitNightAction } from "../engine";
import type { GameState } from "../engine";
import { chooseNightTarget, chooseVote } from "./bots";

const NIGHT_KEY = {
  mafia: "mafiaTarget",
  doctor: "doctorTarget",
  detective: "detectiveTarget",
} as const;

/**
 * Make bots perform night actions for every role that has NO living human.
 * Roles held by a living human are left for that human to act.
 */
export function autoNightActions(
  state: GameState,
  humanIds: ReadonlySet<string>,
  rng: () => number = Math.random,
): GameState {
  let s = state;
  const alive = s.players.filter((p) => p.alive);

  for (const role of ["mafia", "doctor", "detective"] as const) {
    const holders = alive.filter((p) => p.role === role);
    if (holders.length === 0) continue;
    if (holders.some((p) => humanIds.has(p.id))) continue; // a human decides
    if (s.nightActions[NIGHT_KEY[role]] !== null) continue; // already done

    const actor = holders[Math.floor(rng() * holders.length)];
    const target = chooseNightTarget(s, actor.id, rng);
    if (target) s = submitNightAction(s, actor.id, target);
  }
  return s;
}

/** Every living bot that hasn't voted yet votes, one at a time in random order. */
export function autoBotVotes(
  state: GameState,
  humanIds: ReadonlySet<string>,
  rng: () => number = Math.random,
): GameState {
  let s = state;
  const bots = shuffle(
    s.players.filter(
      (p) => p.alive && !humanIds.has(p.id) && !(p.id in s.votes),
    ),
    rng,
  );
  for (const bot of bots) {
    s = castVote(s, bot.id, chooseVote(s, bot.id, rng));
  }
  return s;
}
