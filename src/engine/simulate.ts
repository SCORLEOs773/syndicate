import {
  castVote,
  createGame,
  getLegalTargets,
  resolveNight,
  resolveVote,
  submitNightAction,
} from "./game";
import type { GameState } from "./types";

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function playRandomGame(playerCount: number): GameState {
  let state = createGame(
    Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i}`,
      name: `Player ${i + 1}`,
      isBot: true,
    })),
  );

  let rounds = 0;
  while (state.phase !== "gameover") {
    if (++rounds > 100) throw new Error("Game never ended!");

    if (state.phase === "night") {
      for (const p of state.players) {
        if (!p.alive) continue;
        if (p.role === "mafia" && state.nightActions.mafiaTarget) continue;
        const targets = getLegalTargets(state, p.id);
        if (targets.length === 0) continue;
        state = submitNightAction(state, p.id, pick(targets));
      }
      state = resolveNight(state);
    } else {
      for (const p of state.players) {
        if (!p.alive) continue;
        const targets = getLegalTargets(state, p.id);
        state = castVote(
          state,
          p.id,
          Math.random() < 0.1 ? null : pick(targets),
        );
      }
      state = resolveVote(state);
    }
  }
  return state;
}

const GAMES = 1000;
console.log(`Simulating ${GAMES} random games per player count...\n`);

for (let n = 5; n <= 12; n++) {
  let village = 0;
  let mafia = 0;
  let totalDays = 0;
  for (let g = 0; g < GAMES; g++) {
    const result = playRandomGame(n);
    if (result.winner === "village") village++;
    else mafia++;
    totalDays += result.day;
  }
  console.log(
    `${String(n).padStart(2)} players | village ${String(village).padStart(4)} | mafia ${String(mafia).padStart(4)} | avg days ${(totalDays / GAMES).toFixed(1)}`,
  );
}

console.log("\nNo crashes. Engine is solid.");
