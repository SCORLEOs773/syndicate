import { useState } from "react";
import {
  buildRoleList,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from "../engine";
import type { Role, Settings } from "../engine";
import "./SetupScreen.css";
import "./PassPlaySetup.css";

export interface PassPlayConfig {
  /** In seating order */
  names: string[];
  settings: Settings;
  /** 0 = no timer */
  discussionSeconds: number;
  /** Show who voted for whom after each vote */
  showVotes: boolean;
}

interface Props {
  onStart: (config: PassPlayConfig) => void;
  onBack: () => void;
}

const ROLE_ORDER: Role[] = ["mafia", "doctor", "detective", "villager"];
const ROLE_LABEL: Record<Role, string> = {
  mafia: "Mafia",
  doctor: "Doctor",
  detective: "Detective",
  villager: "Villagers",
};

const TIMER_OPTIONS = [
  { seconds: 0, label: "No timer" },
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
];

const STORAGE_KEY = "syndicate-pp-names";

function loadNames(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === "string")
      : [];
  } catch {
    return [];
  }
}

export default function PassPlaySetup({ onStart, onBack }: Props) {
  const [saved] = useState(loadNames);
  const [count, setCount] = useState(() =>
    Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, saved.length || 6)),
  );
  const [names, setNames] = useState<string[]>(() =>
    Array.from({ length: MAX_PLAYERS }, (_, i) => saved[i] ?? ""),
  );
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [discussionSeconds, setDiscussionSeconds] = useState(180);
  const [showVotes, setShowVotes] = useState(true);

  const finalNames = names
    .slice(0, count)
    .map((n, i) => n.trim() || `Player ${i + 1}`);
  const hasDupes =
    new Set(finalNames.map((n) => n.toLowerCase())).size !== finalNames.length;

  const roleCounts = buildRoleList(count).reduce<Record<string, number>>(
    (acc, role) => {
      acc[role] = (acc[role] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const setName = (i: number, value: string) =>
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));

  const toggle = (key: keyof Settings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasDupes) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(names.slice(0, count).map((n) => n.trim())),
      );
    } catch {
      /* storage unavailable, ignore */
    }
    onStart({ names: finalNames, settings, discussionSeconds, showVotes });
  };

  return (
    <div className="setup">
      <form className="setup-panel" onSubmit={submit}>
        <h2 className="setup-title">Gather Round</h2>
        <div className="menu-rule" />

        <label className="field">
          <span className="field-label">
            Players: <b>{count}</b>
          </span>
          <input
            type="range"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>

        <div className="field">
          <span className="field-label">Names, in seating order</span>
          <div className="name-grid">
            {Array.from({ length: count }, (_, i) => (
              <label key={i} className="name-field">
                <span className="name-num">{i + 1}</span>
                <input
                  className="field-input"
                  value={names[i]}
                  maxLength={14}
                  placeholder={`Player ${i + 1}`}
                  onChange={(e) => setName(i, e.target.value)}
                />
              </label>
            ))}
          </div>
          <span className="field-hint">
            Sit in a circle and pass the phone clockwise. It saves time.
          </span>
          {hasDupes && (
            <span className="field-error">
              Two players share a name. Make them different.
            </span>
          )}
        </div>

        <div className="chips">
          {ROLE_ORDER.map((role) => (
            <div key={role} className={`chip chip-${role}`}>
              <span className="chip-count">{roleCounts[role] ?? 0}</span>
              <span className="chip-name">{ROLE_LABEL[role]}</span>
            </div>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Discussion timer</span>
          <select
            className="field-input"
            value={discussionSeconds}
            onChange={(e) => setDiscussionSeconds(Number(e.target.value))}
          >
            {TIMER_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

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
          <label className="toggle">
            <input
              type="checkbox"
              checked={showVotes}
              onChange={() => setShowVotes((v) => !v)}
            />
            Reveal who voted for whom
          </label>
        </div>

        <div className="setup-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn" disabled={hasDupes}>
            Deal the cards
          </button>
        </div>
      </form>
    </div>
  );
}
