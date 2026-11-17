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
    available: false,
  },
  {
    mode: "online",
    title: "Online Rooms",
    desc: "Every player on their own device.",
    available: false,
  },
];

export default function MainMenu({ onSelect }: Props) {
  return (
    <div className="menu">
      <div className="menu-fog" />
      <header className="menu-header">
        <p className="menu-tag">A GAME OF DECEIT</p>
        <h1 className="menu-title">SYNDICATE</h1>
        <div className="menu-rule" />
        <p className="menu-sub">The city sleeps. The family does not.</p>
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
    </div>
  );
}
