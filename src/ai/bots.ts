import { getLegalTargets } from "../engine";
import type { GameState, Player, Vote } from "../engine";

type Rng = () => number;

function getPlayer(state: GameState, id: string): Player {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

function weightedPick(
  ids: string[],
  weightOf: (id: string) => number,
  rng: Rng,
): string {
  const weights = ids.map((id) => Math.max(0.05, weightOf(id)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < ids.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

/** What this bot personally knows for certain. */
function findings(state: GameState, bot: Player) {
  const mafia = new Set<string>();
  const innocent = new Set<string>();

  if (bot.role === "mafia") {
    for (const p of state.players) if (p.role === "mafia") mafia.add(p.id);
  }
  if (bot.role === "detective") {
    for (const inv of state.investigations) {
      if (inv.detectiveId !== bot.id) continue;
      (inv.isMafia ? mafia : innocent).add(inv.targetId);
    }
  }
  return { mafia, innocent };
}

/**
 * Public reputation from past votes (needs revealed roles).
 * Voting out an innocent is suspicious (+1); voting out a mafia is trusted (-0.6).
 */
function reputation(state: GameState): Record<string, number> {
  const rep: Record<string, number> = {};
  for (const e of state.log) {
    if (e.type !== "vote_elimination" || e.role === null) continue;
    for (const [voter, target] of Object.entries(e.votes)) {
      if (target !== e.playerId) continue;
      rep[voter] = (rep[voter] ?? 0) + (e.role === "mafia" ? -0.6 : 1);
    }
  }
  return rep;
}

// ------------------------------------------------------------- night

export function chooseNightTarget(
  state: GameState,
  botId: string,
  rng: Rng = Math.random,
): string | null {
  const bot = getPlayer(state, botId);
  const legal = getLegalTargets(state, botId);
  if (legal.length === 0) return null;

  const rep = reputation(state);

  switch (bot.role) {
    case "mafia":
      // Prefer people who helped vote out a mafia member: they're dangerous.
      return weightedPick(
        legal,
        (id) => 1 + 1.5 * Math.max(0, -(rep[id] ?? 0)),
        rng,
      );

    case "doctor": {
      if (legal.includes(bot.id) && rng() < 0.25) return bot.id;
      const others = legal.filter((id) => id !== bot.id);
      const pool = others.length > 0 ? others : legal;
      return pool[Math.floor(rng() * pool.length)];
    }

    case "detective": {
      const found = findings(state, bot);
      const fresh = legal.filter(
        (id) => !found.mafia.has(id) && !found.innocent.has(id),
      );
      const pool = fresh.length > 0 ? fresh : legal;
      // Investigate the people who look suspicious first.
      return weightedPick(pool, (id) => 1 + Math.max(0, rep[id] ?? 0), rng);
    }

    default:
      return null;
  }
}

// --------------------------------------------------------------- day

export function chooseVote(
  state: GameState,
  botId: string,
  rng: Rng = Math.random,
): Vote {
  const bot = getPlayer(state, botId);
  const legal = getLegalTargets(state, botId);
  if (legal.length === 0) return null;

  const found = findings(state, bot);
  const rep = reputation(state);

  // A detective who caught a living mafia always votes for them.
  if (bot.role === "detective") {
    const known = legal.filter((id) => found.mafia.has(id));
    if (known.length > 0) return known[Math.floor(rng() * known.length)];
  }

  let candidates = legal;
  if (bot.role === "mafia") {
    candidates = legal.filter((id) => !found.mafia.has(id)); // never vote a teammate
  } else if (bot.role === "detective") {
    candidates = legal.filter((id) => !found.innocent.has(id)); // never vote a cleared player
  }
  if (candidates.length === 0) return null;

  if (rng() < 0.03) return null; // occasional abstain

  // Votes already cast today, so bots can jump on a bandwagon.
  const pile: Record<string, number> = {};
  for (const t of Object.values(state.votes)) {
    if (t) pile[t] = (pile[t] ?? 0) + 1;
  }

  return weightedPick(
    candidates,
    (id) => {
      const r = rep[id] ?? 0;
      if (bot.role === "mafia") {
        // Blend in with the crowd, and target anyone who hunted mafia before.
        return 1 + 1.5 * Math.max(0, -r) + 0.8 * (pile[id] ?? 0);
      }
      return 1 + r + 0.5 * (pile[id] ?? 0);
    },
    rng,
  );
}
