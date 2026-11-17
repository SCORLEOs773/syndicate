import { createGame, resolveNight, resolveVote } from "../engine";
import type { GameState } from "../engine";
import { autoBotVotes, autoNightActions } from "./runner";

const NO_HUMANS = new Set<string>();

function playBotGame(playerCount: number): GameState {
  let state = createGame(
    Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i}`,
      name: `Bot ${i + 1}`,
      isBot: true,
    })),
  );

  let guard = 0;
  while (state.phase !== "gameover") {
    if (++guard > 100) throw new Error("Game never ended!");
    if (state.phase === "night") {
      state = resolveNight(autoNightActions(state, NO_HUMANS));
    } else {
      state = resolveVote(autoBotVotes(state, NO_HUMANS));
    }
  }
  return state;
}

const GAMES = 2000;
console.log(`Bots playing ${GAMES} games per player count...\n`);

for (let n = 5; n <= 12; n++) {
  let village = 0;
  let totalDays = 0;
  for (let g = 0; g < GAMES; g++) {
    const result = playBotGame(n);
    if (result.winner === "village") village++;
    totalDays += result.day;
  }
  console.log(
    `${String(n).padStart(2)} players | village ${((village / GAMES) * 100).toFixed(0).padStart(3)}% | mafia ${(((GAMES - village) / GAMES) * 100).toFixed(0).padStart(3)}% | avg days ${(totalDays / GAMES).toFixed(1)}`,
  );
}
