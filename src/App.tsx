import { useEffect, useState, type ReactNode } from "react";
import Splash from "./screens/Splash";
import MainMenu from "./screens/MainMenu";
import SetupScreen from "./screens/SetupScreen";
import type { GameConfig } from "./screens/SetupScreen";
import GameScreen from "./screens/GameScreen";
import PassPlaySetup from "./screens/PassPlaySetup";
import type { PassPlayConfig } from "./screens/PassPlaySetup";
import PassPlayScreen from "./screens/PassPlayScreen";
import SoundToggle from "./ui/SoundToggle";
import { music } from "./ui/music";

type Screen = "splash" | "menu" | "setup" | "ppSetup" | "game" | "passplay";

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [ppConfig, setPpConfig] = useState<PassPlayConfig | null>(null);

  // Menu music whenever we're outside a game
  useEffect(() => {
    if (screen === "menu" || screen === "setup" || screen === "ppSetup") {
      music.setMood("menu");
    }
  }, [screen]);

  let view: ReactNode;
  switch (screen) {
    case "splash":
      view = <Splash onEnter={() => setScreen("menu")} />;
      break;
    case "setup":
      view = (
        <SetupScreen
          onBack={() => setScreen("menu")}
          onStart={(c) => {
            setConfig(c);
            setScreen("game");
          }}
        />
      );
      break;
    case "ppSetup":
      view = (
        <PassPlaySetup
          onBack={() => setScreen("menu")}
          onStart={(c) => {
            setPpConfig(c);
            setScreen("passplay");
          }}
        />
      );
      break;
    case "game":
      view = config ? (
        <GameScreen config={config} onExit={() => setScreen("menu")} />
      ) : null;
      break;
    case "passplay":
      view = ppConfig ? (
        <PassPlayScreen config={ppConfig} onExit={() => setScreen("menu")} />
      ) : null;
      break;
    default:
      view = (
        <MainMenu
          onSelect={(mode) => {
            if (mode === "single") setScreen("setup");
            if (mode === "passplay") setScreen("ppSetup");
          }}
        />
      );
  }

  const showToggle =
    screen === "menu" || screen === "setup" || screen === "ppSetup";

  return (
    <>
      {view}
      {showToggle && <SoundToggle className="sound-fixed" />}
    </>
  );
}
