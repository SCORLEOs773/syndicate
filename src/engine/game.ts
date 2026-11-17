import type { GameState, Player, Settings, Vote } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import {
  buildRoleList,
  checkWinner,
  MAX_PLAYERS,
  MIN_PLAYERS,
  shuffle,
} from "./rules";

export interface PlayerInput {
  id: string;
  name: string;
  isBot: boolean;
}

const emptyNightActions = () => ({
  mafiaTarget: null,
  doctorTarget: null,
  detectiveTarget: null,
});

function mustGetPlayer(state: GameState, id: string): Player {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

// ---------------------------------------------------------------- setup

export function createGame(
  inputs: PlayerInput[],
  settings: Partial<Settings> = {},
  rng: () => number = Math.random,
): GameState {
  if (inputs.length < MIN_PLAYERS || inputs.length > MAX_PLAYERS) {
    throw new Error(`Syndicate needs ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }
  const roles = shuffle(buildRoleList(inputs.length), rng);
  const players: Player[] = inputs.map((p, i) => ({
    ...p,
    role: roles[i],
    alive: true,
  }));

  return {
    players,
    phase: "night",
    day: 1,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    nightActions: emptyNightActions(),
    votes: {},
    investigations: [],
    log: [{ type: "night_fall", day: 1 }],
    winner: null,
  };
}

// ------------------------------------------------------- legal targets

/** Who can this player act on / vote for right now? Used by both UI and bots. */
export function getLegalTargets(state: GameState, actorId: string): string[] {
  const actor = state.players.find((p) => p.id === actorId);
  if (!actor || !actor.alive || state.phase === "gameover") return [];

  const alive = state.players.filter((p) => p.alive);

  if (state.phase === "day") {
    return alive.filter((p) => p.id !== actor.id).map((p) => p.id);
  }

  // Night
  switch (actor.role) {
    case "mafia":
      return alive.filter((p) => p.role !== "mafia").map((p) => p.id);
    case "doctor":
      return alive
        .filter((p) => state.settings.doctorCanSelfProtect || p.id !== actor.id)
        .map((p) => p.id);
    case "detective":
      if (state.nightActions.detectiveTarget) return []; // already investigated
      return alive.filter((p) => p.id !== actor.id).map((p) => p.id);
    default:
      return [];
  }
}

// ----------------------------------------------------------- night

export function submitNightAction(
  state: GameState,
  actorId: string,
  targetId: string,
): GameState {
  if (state.phase !== "night") throw new Error("It is not night");
  const actor = mustGetPlayer(state, actorId);

  if (actor.role === "detective" && state.nightActions.detectiveTarget) {
    throw new Error("The detective already investigated tonight");
  }
  if (!getLegalTargets(state, actorId).includes(targetId)) {
    throw new Error("Illegal target");
  }

  const next = structuredClone(state);
  switch (actor.role) {
    case "mafia":
      next.nightActions.mafiaTarget = targetId; // the mafia team's shared choice
      break;
    case "doctor":
      next.nightActions.doctorTarget = targetId;
      break;
    case "detective": {
      next.nightActions.detectiveTarget = targetId;
      next.investigations.push({
        detectiveId: actorId,
        targetId,
        isMafia: mustGetPlayer(state, targetId).role === "mafia",
        day: state.day,
      });
      break;
    }
    default:
      throw new Error("This role has no night action");
  }
  return next;
}

/** True once every alive special role has acted. */
export function isNightComplete(state: GameState): boolean {
  const alive = state.players.filter((p) => p.alive);
  const has = (role: string) => alive.some((p) => p.role === role);
  const a = state.nightActions;
  return (
    (!has("mafia") || a.mafiaTarget !== null) &&
    (!has("doctor") || a.doctorTarget !== null) &&
    (!has("detective") || a.detectiveTarget !== null)
  );
}

export function resolveNight(state: GameState): GameState {
  if (state.phase !== "night") throw new Error("It is not night");
  if (!isNightComplete(state)) throw new Error("Night is not complete");

  const next = structuredClone(state);
  const { mafiaTarget, doctorTarget } = next.nightActions;
  const victim = next.players.find((p) => p.id === mafiaTarget);

  if (victim && mafiaTarget !== doctorTarget) {
    victim.alive = false;
    next.log.push({
      type: "morning_death",
      day: next.day,
      playerId: victim.id,
      role: next.settings.revealRoleOnDeath ? victim.role : null,
    });
  } else {
    // Either the doctor saved them or there was no kill.
    // We deliberately don't reveal which.
    next.log.push({ type: "morning_peaceful", day: next.day });
  }

  next.nightActions = emptyNightActions();
  next.votes = {};

  const winner = checkWinner(next.players);
  if (winner) {
    next.winner = winner;
    next.phase = "gameover";
    next.log.push({ type: "game_over", winner });
  } else {
    next.phase = "day";
  }
  return next;
}

// ------------------------------------------------------------- day

export function castVote(
  state: GameState,
  voterId: string,
  target: Vote,
): GameState {
  if (state.phase !== "day") throw new Error("It is not day");
  if (target !== null && !getLegalTargets(state, voterId).includes(target)) {
    throw new Error("Illegal vote");
  }
  if (!mustGetPlayer(state, voterId).alive)
    throw new Error("Dead players cannot vote");

  const next = structuredClone(state);
  next.votes[voterId] = target;
  return next;
}

export function isVotingComplete(state: GameState): boolean {
  return state.players.filter((p) => p.alive).every((p) => p.id in state.votes);
}

export function resolveVote(state: GameState): GameState {
  if (state.phase !== "day") throw new Error("It is not day");
  if (!isVotingComplete(state)) throw new Error("Voting is not complete");

  const next = structuredClone(state);

  // Tally (abstentions don't count)
  const tally: Record<string, number> = {};
  for (const target of Object.values(next.votes)) {
    if (target) tally[target] = (tally[target] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((id) => tally[id] === max);

  if (max > 0 && leaders.length === 1) {
    const eliminated = mustGetPlayer(next, leaders[0]);
    eliminated.alive = false;
    next.log.push({
      type: "vote_elimination",
      day: next.day,
      playerId: eliminated.id,
      role: next.settings.revealRoleOnDeath ? eliminated.role : null,
      tally,
    });
  } else {
    // No votes, or a tie: nobody is eliminated
    next.log.push({ type: "vote_tie", day: next.day, tally });
  }

  next.votes = {};

  const winner = checkWinner(next.players);
  if (winner) {
    next.winner = winner;
    next.phase = "gameover";
    next.log.push({ type: "game_over", winner });
  } else {
    next.day += 1;
    next.phase = "night";
    next.nightActions = emptyNightActions();
    next.log.push({ type: "night_fall", day: next.day });
  }
  return next;
}
