import { useState } from "react";
import { sfx } from "./sfx";
import { music } from "./music";

export default function SoundToggle({
  className = "",
}: {
  className?: string;
}) {
  const [muted, setMuted] = useState(sfx.isMuted());

  function toggle() {
    sfx.setMuted(!muted);
    setMuted(!muted);
    music.refresh();
  }

  return (
    <button
      className={`sound-toggle ${className}`}
      onClick={toggle}
      aria-label={muted ? "Unmute" : "Mute"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
