export type Role = "villager" | "doctor" | "mafia" | "detective";
export type Team = "village" | "mafia";
export type Phase = "night" | "day" | "gameover";

export interface Player {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
  isBot: boolean;
}

export interface Settings {
  /** Show a player's role when they die or are voted out */
  revealRoleOnDeath: boolean;
  /** Can the Doctor protect themselves? */
  doctorCanSelfProtect: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  revealRoleOnDeath: true,
  doctorCanSelfProtect: true,
};

export interface NightActions {
  mafiaTarget: string | null;
  doctorTarget: string | null;
  detectiveTarget: string | null;
}

export interface Investigation {
  detectiveId: string;
  targetId: string;
  isMafia: boolean;
  day: number;
}

/** A vote is a player id, or null for "abstain" */
export type Vote = string | null;

/** Everything the UI needs to announce. `role` is null when roles are hidden. */
export type GameEvent =
  | { type: "night_fall"; day: number }
  | { type: "morning_death"; day: number; playerId: string; role: Role | null }
  | { type: "morning_peaceful"; day: number }
  | {
      type: "vote_elimination";
      day: number;
      playerId: string;
      role: Role | null;
      tally: Record<string, number>;
      votes: Record<string, Vote>;
    }
  | {
      type: "vote_tie";
      day: number;
      tally: Record<string, number>;
      votes: Record<string, Vote>;
    }
  | { type: "game_over"; winner: Team };

export interface GameState {
  players: Player[];
  phase: Phase;
  /** Day counter. Night 1 and Day 1 share the number 1. */
  day: number;
  settings: Settings;
  nightActions: NightActions;
  votes: Record<string, Vote>;
  investigations: Investigation[];
  log: GameEvent[];
  winner: Team | null;
}
