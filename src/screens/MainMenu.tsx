import { useEffect, useState } from "react";
import "./MainMenu.css";

export type Mode = "single" | "passplay" | "online";

interface Props {
  onSelect: (mode: Mode) => void;
}

const OPTIONS: {
  mode: Mode;
  title: string;
  desc: string;
  available: boolean;
}[] = [
  {
    mode: "single",
    title: "Single Player",
    desc: "Take a seat at the table with AI players.",
    available: true,
  },
  {
    mode: "passplay",
    title: "Pass & Play",
    desc: "One device, passed hand to hand.",
    available: true,
  },
  {
    mode: "online",
    title: "Online Rooms",
    desc: "Every player on their own device.",
    available: false,
  },
];

const QUOTES = [
  "The city sleeps. The family does not.",
  "Trust no one. Not even yourself.",
  "Everyone has a secret. Some have a gun.",
  "The doctor is in. The detective is watching.",
  "One of you is lying.",
];

export default function MainMenu({ onSelect }: Props) {
  const [q, setQ] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setQ((i) => (i + 1) % QUOTES.length),
      4500,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="menu">
      <div className="menu-fog" />
      <header className="menu-header">
        <p className="menu-tag">A GAME OF DECEIT</p>
        <h1 className="menu-title">SYNDICATE</h1>
        <div className="menu-rule" />
        <p className="menu-sub menu-quote" key={q}>
          {QUOTES[q]}
        </p>
      </header>

      <nav className="menu-options">
        {OPTIONS.map((o) => (
          <button
            key={o.mode}
            className="menu-card"
            disabled={!o.available}
            onClick={() => onSelect(o.mode)}
          >
            <span className="menu-card-title">{o.title}</span>
            <span className="menu-card-desc">{o.desc}</span>
            {!o.available && (
              <span className="menu-card-soon">COMING SOON</span>
            )}
          </button>
        ))}
      </nav>

      <details className="howto">
        <summary>How to play</summary>
        <ul>
          <li>
            <b>Night:</b> the Mafia choose a victim, the Doctor protects one
            person, and the Detective investigates one person.
          </li>
          <li>
            <b>Dawn:</b> the town learns who died. If the Doctor guessed right,
            nobody did.
          </li>
          <li>
            <b>Day:</b> everyone discusses, then votes. The most-voted player is
            eliminated. A tie eliminates nobody.
          </li>
          <li>
            <b>Winning:</b> the village wins when every Mafia member is gone.
            The Mafia wins when they equal everyone else.
          </li>
        </ul>
      </details>
    </div>
  );
}
