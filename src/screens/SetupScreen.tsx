import { useState } from "react";
import {
  buildRoleList,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from "../engine";
import type { Role, Settings } from "../engine";
import "./SetupScreen.css";

export interface GameConfig {
  playerName: string;
  playerCount: number;
  settings: Settings;
}

interface Props {
  onStart: (config: GameConfig) => void;
  onBack: () => void;
}

const ROLE_ORDER: Role[] = ["mafia", "doctor", "detective", "villager"];
const ROLE_LABEL: Record<Role, string> = {
  mafia: "Mafia",
  doctor: "Doctor",
  detective: "Detective",
  villager: "Villagers",
};

export default function SetupScreen({ onStart, onBack }: Props) {
  const [name, setName] = useState("");
  const [count, setCount] = useState(8);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const counts = buildRoleList(count).reduce<Record<string, number>>(
    (acc, role) => {
      acc[role] = (acc[role] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const toggle = (key: keyof Settings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({
      playerName: name.trim() || "Stranger",
      playerCount: count,
      settings,
    });
  };

  return (
    <div className="setup">
      <form className="setup-panel" onSubmit={submit}>
        <h2 className="setup-title">Take Your Seat</h2>
        <div className="menu-rule" />

        <label className="field">
          <span className="field-label">Your name</span>
          <input
            className="field-input"
            value={name}
            maxLength={14}
            placeholder="Stranger"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">
            Players at the table: <b>{count}</b>
          </span>
          <input
            type="range"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <span className="field-hint">You + {count - 1} AI players</span>
        </label>

        <div className="chips">
          {ROLE_ORDER.map((role) => (
            <div key={role} className={`chip chip-${role}`}>
              <span className="chip-count">{counts[role] ?? 0}</span>
              <span className="chip-name">{ROLE_LABEL[role]}</span>
            </div>
          ))}
        </div>

        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.revealRoleOnDeath}
              onChange={() => toggle("revealRoleOnDeath")}
            />
            Reveal a player's role when they die
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.doctorCanSelfProtect}
              onChange={() => toggle("doctorCanSelfProtect")}
            />
            Doctor may protect themselves
          </label>
        </div>

        <div className="setup-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn">
            Deal the cards
          </button>
        </div>
      </form>
    </div>
  );
}
