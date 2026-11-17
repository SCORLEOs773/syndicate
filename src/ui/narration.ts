import type { GameEvent, Role } from "../engine";

export const ROLE_NAME: Record<Role, string> = {
  villager: "Villager",
  doctor: "Doctor",
  detective: "Detective",
  mafia: "Mafia",
};

export function narrate(e: GameEvent, nameOf: (id: string) => string): string {
  switch (e.type) {
    case "night_fall":
      return `Night ${e.day}. The city goes quiet...`;
    case "morning_death":
      return (
        `${nameOf(e.playerId)} was found dead at dawn.` +
        (e.role
          ? ` They were ${e.role === "mafia" ? "Mafia" : `a ${ROLE_NAME[e.role]}`}.`
          : "")
      );
    case "morning_peaceful":
      return "The sun rises over a quiet street. Nobody was killed last night.";
    case "vote_elimination":
      return (
        `The table has spoken. ${nameOf(e.playerId)} is dragged out into the street.` +
        (e.role
          ? ` They were ${e.role === "mafia" ? "Mafia" : `a ${ROLE_NAME[e.role]}`}.`
          : "")
      );
    case "vote_tie":
      return "The vote is split. Nobody is eliminated, and the Mafia smiles.";
    case "game_over":
      return e.winner === "village"
        ? "The Syndicate is broken. The village wins!"
        : "The Syndicate takes the city. The Mafia wins!";
  }
}
