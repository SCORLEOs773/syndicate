import { useState } from "react";
import MainMenu from "./screens/MainMenu";
import SetupScreen from "./screens/SetupScreen";
import type { GameConfig } from "./screens/SetupScreen";
import GameScreen from "./screens/GameScreen";

type Screen = "menu" | "setup" | "game";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [config, setConfig] = useState<GameConfig | null>(null);

  if (screen === "setup") {
    return (
      <SetupScreen
        onBack={() => setScreen("menu")}
        onStart={(c) => {
          setConfig(c);
          setScreen("game");
        }}
      />
    );
  }

  if (screen === "game" && config) {
    return <GameScreen config={config} onExit={() => setScreen("menu")} />;
  }

  return (
    <MainMenu
      onSelect={(mode) => {
        if (mode === "single") setScreen("setup");
      }}
    />
  );
}
