import { shuffle } from "../engine";
import type { GameState } from "../engine";
import { findings, reputation, weightedPick } from "./bots";

type Rng = () => number;

export interface ChatLine {
  speakerId: string;
  kind: "accuse" | "defend";
  targetId: string;
  text: string;
  /** How much this line shifts suspicion on targetId (negative shields them) */
  weight: number;
}

const ACCUSE = [
  "I don't like how quiet {t} has been.",
  "Something's off about {t}. Just saying.",
  "{t} is hiding something. I can feel it.",
  "Watch {t}. Nobody's that calm.",
  "My gut says {t}.",
  "Why is nobody looking at {t}?",
];
const SURE = [
  "I'm telling you, it's {t}. Trust me on this.",
  "It's {t}. I'd stake my life on it.",
  "Vote {t}. I have my reasons.",
];
const DEFEND_SELF = [
  "Me? Look elsewhere. I'm on your side.",
  "That's a cheap shot. I'm no killer.",
  "You're wasting a vote on me, and the Mafia loves it.",
  "I have got nothing to hide.",
];
const DEFEND_OTHER = [
  "{t} is innocent. Leave them alone.",
  "Easy on {t}. I don't buy it.",
];

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

export function generateDiscussion(
  state: GameState,
  humanIds: ReadonlySet<string>,
  rng: Rng = Math.random,
): ChatLine[] {
  const lines: ChatLine[] = [];
  const heat: Record<string, number> = {};
  const alive = state.players.filter((p) => p.alive);
  const nameOf = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? "?";
  const rep = reputation(state);
  const speakers = shuffle(
    alive.filter((p) => !humanIds.has(p.id)),
    rng,
  );

  const say = (
    speakerId: string,
    kind: ChatLine["kind"],
    targetId: string,
    template: string,
    weight: number,
  ) => {
    lines.push({
      speakerId,
      kind,
      targetId,
      text: template.replace("{t}", nameOf(targetId)),
      weight,
    });
    if (weight > 0) heat[targetId] = (heat[targetId] ?? 0) + weight;
  };

  for (const bot of speakers) {
    if (rng() > 0.7) continue; // not everyone speaks every day

    const found = findings(state, bot);
    const others = alive.filter((p) => p.id !== bot.id);

    // Accused earlier today? Defend yourself.
    if ((heat[bot.id] ?? 0) > 0 && rng() < 0.6) {
      say(bot.id, "defend", bot.id, pick(DEFEND_SELF, rng), 0);
      continue;
    }

    // A detective who caught a mafia speaks up.
    if (bot.role === "detective") {
      const known = others.filter((p) => found.mafia.has(p.id));
      if (known.length > 0 && rng() < 0.7) {
        say(bot.id, "accuse", pick(known, rng).id, pick(SURE, rng), 3);
        continue;
      }
    }

    // Mafia protect a teammate under fire.
    if (bot.role === "mafia") {
      const hot = others.find(
        (p) => p.role === "mafia" && (heat[p.id] ?? 0) > 0,
      );
      if (hot && rng() < 0.5) {
        say(bot.id, "defend", hot.id, pick(DEFEND_OTHER, rng), -1);
        continue;
      }
    }

    // Otherwise accuse someone.
    let pool = others;
    if (bot.role === "mafia") pool = others.filter((p) => p.role !== "mafia");
    if (bot.role === "detective")
      pool = others.filter((p) => !found.innocent.has(p.id));
    if (pool.length === 0) continue;

    const targetId = weightedPick(
      pool.map((p) => p.id),
      (id) => 1 + (rep[id] ?? 0) + 0.5 * (heat[id] ?? 0),
      rng,
    );
    say(bot.id, "accuse", targetId, pick(ACCUSE, rng), 1);
  }

  return lines;
}

/** Sum of everything said about each player. */
export function suspicionFrom(lines: ChatLine[]): Record<string, number> {
  const s: Record<string, number> = {};
  for (const l of lines) s[l.targetId] = (s[l.targetId] ?? 0) + l.weight;
  return s;
}
