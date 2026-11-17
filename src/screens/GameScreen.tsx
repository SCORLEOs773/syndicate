import { useState } from "react";
import { createGame } from "../engine";
import type { GameState, Role } from "../engine";
import { pickBotNames } from "../ai/names";
import type { GameConfig } from "./SetupScreen";
import "./GameScreen.css";

const HUMAN_ID = "human";

function deal(config: GameConfig): GameState {
  const botNames = pickBotNames(config.playerCount - 1, [config.playerName]);
  return createGame(
    [
      { id: HUMAN_ID, name: config.playerName, isBot: false },
      ...botNames.map((name, i) => ({ id: `bot${i}`, name, isBot: true })),
    ],
    config.settings,
  );
}

const ROLE_INFO: Record<Role, { title: string; blurb: string }> = {
  villager: {
    title: "Villager",
    blurb:
      "You have no powers, only your wits. Find the Mafia before they find you.",
  },
  doctor: {
    title: "Doctor",
    blurb: "Each night, choose one person to protect from the Mafia.",
  },
  detective: {
    title: "Detective",
    blurb: "Each night, investigate one person and learn if they are Mafia.",
  },
  mafia: {
    title: "Mafia",
    blurb: "Each night, choose a victim. By day, blend in and survive.",
  },
};

interface Props {
  config: GameConfig;
  onExit: () => void;
}

export default function GameScreen({ config, onExit }: Props) {
  const [game, setGame] = useState(() => deal(config));

  const me = game.players.find((p) => p.id === HUMAN_ID)!;
  const info = ROLE_INFO[me.role];
  const teammates = game.players.filter(
    (p) => p.role === "mafia" && p.id !== me.id,
  );

  return (
    <div className="game">
      <p className="game-tag">YOUR ROLE</p>
      <div className={`role-card role-${me.role}`}>
        <h2>{info.title}</h2>
        <p>{info.blurb}</p>
        {me.role === "mafia" && teammates.length > 0 && (
          <p className="role-team">
            Your family: {teammates.map((t) => t.name).join(", ")}
          </p>
        )}
      </div>

      <p className="game-tag">AT THE TABLE</p>
      <ul className="seats">
        {game.players.map((p) => (
          <li
            key={p.id}
            className={p.id === HUMAN_ID ? "seat seat-me" : "seat"}
          >
            {p.name}
            {p.id === HUMAN_ID && " (you)"}
          </li>
        ))}
      </ul>

      <details className="debug">
        <summary>Debug: reveal all roles</summary>
        <ul>
          {game.players.map((p) => (
            <li key={p.id}>
              {p.name}: {p.role}
            </li>
          ))}
        </ul>
      </details>

      <div className="game-actions">
        <button className="btn btn-ghost" onClick={onExit}>
          Leave table
        </button>
        <button className="btn" onClick={() => setGame(deal(config))}>
          Redeal
        </button>
      </div>
    </div>
  );
}
