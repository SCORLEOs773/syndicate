import { music } from "../ui/music";
import { sfx } from "../ui/sfx";
import "./Splash.css";

export default function Splash({ onEnter }: { onEnter: () => void }) {
  function enter() {
    music.setMood("menu");
    music.start();
    sfx.knock();
    onEnter();
  }

  return (
    <button className="splash" onClick={enter}>
      <span className="splash-title">SYNDICATE</span>
      <span className="splash-sub">A GAME OF DECEIT</span>
      <span className="splash-tap">Tap to enter</span>
      <span className="splash-hint">Best with sound on</span>
    </button>
  );
}
