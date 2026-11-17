import { useState } from "react";
import MainMenu, { type Mode } from "./screens/MainMenu";

type Screen = "menu" | Mode;

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");

  if (screen === "menu") {
    return <MainMenu onSelect={(mode) => setScreen(mode)} />;
  }

  // Placeholder until we build the real game screen
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2 style={{ fontFamily: "var(--font-title)", color: "var(--gold)" }}>
        The game starts here: {screen}
      </h2>
      <button
        onClick={() => setScreen("menu")}
        style={{ marginTop: 24, padding: "10px 20px" }}
      >
        Back to menu
      </button>
    </div>
  );
}
