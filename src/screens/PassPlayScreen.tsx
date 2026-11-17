import { useEffect, useState } from "react";
import {
  castVote,
  createGame,
  getLegalTargets,
  resolveNight,
  resolveVote,
  submitNightAction,
} from "../engine";
import type { GameEvent, GameState, Player, Role } from "../engine";
import { narrate, ROLE_NAME } from "../ui/narration";
import { sfx } from "../ui/sfx";
import { music } from "../ui/music";
import SoundToggle from "../ui/SoundToggle";
import { useWakeLock } from "../ui/useWakeLock";
import type { PassPlayConfig } from "./PassPlaySetup";
import "./GameScreen.css";
import "./PassPlayScreen.css";

type Stage =
  | "reveal"
  | "nightIntro"
  | "night"
  | "nightEnd"
  | "dawn"
  | "discuss"
  | "vote"
  | "result"
  | "gameover";

const ROLE_INFO: Record<Role, string> = {
  villager:
    "You have no powers, only your wits. Find the Mafia before they find you.",
  doctor: "Each night, choose one person to protect from the Mafia.",
  detective: "Each night, investigate one person and learn if they are Mafia.",
  mafia: "Each night, choose a victim. By day, blend in and survive.",
};

const NIGHT_PROMPT: Record<Role, string> = {
  mafia: "Choose who disappears tonight.",
  doctor: "Choose who you will protect tonight.",
  detective: "Choose who you will investigate tonight.",
  villager:
    "You have no power tonight. Tap anyone and confirm, so every turn takes the same time.",
};

const TABLE_PROMPTS = [
  "Go around the table: where were you last night?",
  "Who has been suspiciously quiet?",
  "Does anybody’s story not add up?",
  "Who defended someone a little too fast?",
  "If your life depended on it, who is lying?",
  "Whoever speaks first is not always innocent.",
  "The Doctor and the Detective are tempted to speak up. Is it worth the risk?",
];

function deal(config: PassPlayConfig): GameState {
  return createGame(
    config.names.map((name, i) => ({ id: `p${i}`, name, isBot: false })),
    config.settings,
  );
}

function sinceLastNightFall(log: GameEvent[]): GameEvent[] {
  let i = log.length - 1;
  while (i >= 0 && log[i].type !== "night_fall") i--;
  return log.slice(i + 1);
}

function lastVote(log: GameEvent[]) {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e.type === "vote_elimination" || e.type === "vote_tie") return e;
  }
  return null;
}

function fmt(total: number): string {
  const s = Math.max(0, total);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ------------------------------------------------------------------ gate

interface GateProps {
  name: string;
  index: number;
  total: number;
  subtitle: string;
  onUnlock: () => void;
}

/** The cover screen shown between players. Reveals nothing. */
function Gate({ name, index, total, subtitle, onUnlock }: GateProps) {
  return (
    <div className="gate">
      <p className="gate-progress">
        {index + 1} OF {total}
      </p>
      <p className="tag">PASS THE PHONE TO</p>
      <h2 className="gate-name">{name}</h2>
      <p className="narration">{subtitle}</p>
      <button className="btn" onClick={onUnlock}>
        I am {name}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- roster

interface RosterProps {
  game: GameState;
  /** Whose secrets may be shown (mafia see their family) */
  viewer?: string;
  selectable?: string[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  showAllRoles?: boolean;
}

function Roster({
  game,
  viewer,
  selectable = [],
  selected = null,
  onSelect,
  showAllRoles = false,
}: RosterProps) {
  const viewerRole = game.players.find((p) => p.id === viewer)?.role;
  return (
    <ul className="grid">
      {game.players.map((p) => {
        const canPick = selectable.includes(p.id);
        const roleKnown =
          showAllRoles ||
          (!p.alive && game.settings.revealRoleOnDeath) ||
          (viewerRole === "mafia" && p.role === "mafia");
        const cls = [
          "tile",
          !p.alive && "tile-dead",
          p.id === viewer && "tile-me",
          canPick && "tile-pickable",
          selected === p.id && "tile-selected",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={p.id}>
            <button
              className={cls}
              disabled={!canPick}
              onClick={() => onSelect?.(p.id)}
            >
              <span className="tile-name">
                {!p.alive && "† "}
                {p.name}
                {p.id === viewer && " (you)"}
              </span>
              {roleKnown && (
                <span className="tile-role">{ROLE_NAME[p.role]}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- screen

interface Props {
  config: PassPlayConfig;
  onExit: () => void;
}

export default function PassPlayScreen({ config, onExit }: Props) {
  useWakeLock();

  const [game, setGame] = useState(() => deal(config));
  const [stage, setStage] = useState<Stage>("reveal");
  const [turn, setTurn] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [acted, setActed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [prompt, setPrompt] = useState(TABLE_PROMPTS[0]);

  const nameOf = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? "?";

  // Who takes a turn right now: everyone for the deal, living players otherwise.
  const queue =
    stage === "reveal" ? game.players : game.players.filter((p) => p.alive);
  const current = queue[turn] as Player | undefined;

  const familyOf = (p: Player) =>
    p.role === "mafia"
      ? game.players.filter((o) => o.role === "mafia" && o.id !== p.id)
      : [];

  const isNight =
    stage === "reveal" ||
    stage === "nightIntro" ||
    stage === "night" ||
    stage === "nightEnd";

  // ---------- music mood

  useEffect(() => {
    music.setMood(
      stage === "gameover"
        ? game.winner === "village"
          ? "victory"
          : "defeat"
        : stage === "discuss" || stage === "vote"
          ? "tense"
          : stage === "dawn" || stage === "result"
            ? "day"
            : "night",
    );
  }, [stage, game.winner]);

  // ---------- discussion timer

  useEffect(() => {
    if (stage !== "discuss" || !running) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [stage, running]);

  useEffect(() => {
    if (
      stage === "discuss" &&
      running &&
      config.discussionSeconds > 0 &&
      secondsLeft <= 0
    ) {
      setRunning(false);
      sfx.bell();
    }
  }, [stage, running, secondsLeft, config.discussionSeconds]);

  const timeUp = config.discussionSeconds > 0 && secondsLeft <= 0;

  // ---------- helpers

  function resetTurn() {
    setUnlocked(false);
    setSelected(null);
    setActed(false);
  }

  function pickTile(id: string) {
    sfx.click();
    setSelected(id);
  }

  function unlock() {
    sfx.click();
    setUnlocked(true);
    // A mafia member sees what their family already chose and can change it
    if (stage === "night" && current?.role === "mafia") {
      setSelected(game.nightActions.mafiaTarget);
    }
  }

  function advance() {
    sfx.click();
    resetTurn();
    if (turn + 1 < queue.length) {
      setTurn(turn + 1);
      return;
    }
    setTurn(0);
    setStage(stage === "reveal" ? "nightIntro" : "nightEnd");
  }

  function finish(g: GameState) {
    setStage("gameover");
    if (g.winner === "village") sfx.win();
    else sfx.lose();
  }

  // ---------- night

  function beginNight() {
    sfx.night();
    resetTurn();
    setTurn(0);
    setStage("night");
  }

  function confirmNight() {
    if (!current || !selected) return;
    sfx.click();
    // Villagers get a decoy screen: nothing is submitted to the engine
    if (current.role !== "villager") {
      setGame(submitNightAction(game, current.id, selected));
    }
    setActed(true);
  }

  function wake() {
    const g = resolveNight(game);
    setGame(g);
    setStage("dawn");
    sfx.dawn();
    if (sinceLastNightFall(g.log).some((e) => e.type === "morning_death")) {
      window.setTimeout(sfx.death, 700);
    }
  }

  // ---------- day

  function afterDawn() {
    sfx.click();
    if (game.phase === "gameover") {
      finish(game);
      return;
    }
    setPrompt(TABLE_PROMPTS[Math.floor(Math.random() * TABLE_PROMPTS.length)]);
    setSecondsLeft(config.discussionSeconds);
    setRunning(config.discussionSeconds > 0);
    setStage("discuss");
  }

  function toggleTimer() {
    sfx.click();
    setRunning((r) => !r);
  }

  function addTime() {
    sfx.click();
    setSecondsLeft((s) => Math.max(0, s) + 30);
    setRunning(true);
  }

  function startVote() {
    sfx.click();
    resetTurn();
    setTurn(0);
    setStage("vote");
  }

  function submitVote(target: string | null) {
    if (!current) return;
    sfx.click();
    const g = castVote(game, current.id, target);
    resetTurn();

    if (turn + 1 < queue.length) {
      setGame(g);
      setTurn(turn + 1);
      return;
    }

    const resolved = resolveVote(g);
    setGame(resolved);
    setTurn(0);
    setStage("result");
    if (lastVote(resolved.log)?.type === "vote_elimination") sfx.death();
  }

  function afterResult() {
    sfx.click();
    if (game.phase === "gameover") finish(game);
    else setStage("nightIntro");
  }

  function rematch() {
    sfx.click();
    setGame(deal(config));
    resetTurn();
    setTurn(0);
    setStage("reveal");
  }

  function leave() {
    if (window.confirm("Leave this game? Progress will be lost.")) onExit();
  }

  // ---------- derived labels

  const dayNumber =
    stage === "result" && game.phase === "night" ? game.day - 1 : game.day;
  const phaseLabel =
    stage === "reveal"
      ? "The Deal"
      : stage === "gameover"
        ? "Game Over"
        : `${isNight ? "Night" : "Day"} ${dayNumber}`;

  const nightTargets = (p: Player): string[] =>
    p.role === "villager"
      ? game.players.filter((o) => o.alive && o.id !== p.id).map((o) => o.id)
      : getLegalTargets(game, p.id);

  const lastBeat = turn + 1 >= queue.length;

  // ---------- render

  return (
    <div className={isNight ? "game game-night" : "game game-day"}>
      <div className={isNight ? "moon" : "sun"} />

      <header className="hud">
        <span className="hud-phase">{phaseLabel}</span>
        <div className="hud-right">
          <button className="leave" onClick={leave}>
            Leave
          </button>
          <SoundToggle />
        </div>
      </header>

      <main className="stage" key={`${stage}-${turn}-${unlocked}-${acted}`}>
        {/* ------------------------------------------------ REVEAL */}
        {stage === "reveal" &&
          current &&
          (!unlocked ? (
            <Gate
              name={current.name}
              index={turn}
              total={queue.length}
              subtitle="Only the player named above may look. Everyone else, look away."
              onUnlock={unlock}
            />
          ) : (
            <>
              <p className="tag">YOUR ROLE</p>
              <div
                className={`role-card reveal ${current.role === "mafia" ? "role-mafia" : ""}`}
              >
                <h2>{ROLE_NAME[current.role]}</h2>
                <p>{ROLE_INFO[current.role]}</p>
                {familyOf(current).length > 0 && (
                  <p className="role-team">
                    Your family:{" "}
                    {familyOf(current)
                      .map((p) => p.name)
                      .join(", ")}
                  </p>
                )}
              </div>
              <button className="btn" onClick={advance}>
                {lastBeat ? "Hide the screen" : "Hide & pass it on"}
              </button>
            </>
          ))}

        {/* ------------------------------------------------ NIGHT INTRO */}
        {stage === "nightIntro" && (
          <>
            <p className="tag">NIGHT {game.day}</p>
            <div className="announce">
              <p>The city falls asleep.</p>
              <p>
                Everyone close your eyes or look away. When the phone reaches
                you, look only at your own screen.
              </p>
            </div>
            <p className="narration">
              First up: <b>{queue[0]?.name}</b>. Hand them the phone.
            </p>
            <button className="btn" onClick={beginNight}>
              Begin the night
            </button>
          </>
        )}

        {/* ------------------------------------------------ NIGHT */}
        {stage === "night" &&
          current &&
          (!unlocked ? (
            <Gate
              name={current.name}
              index={turn}
              total={queue.length}
              subtitle={`Look only if you are ${current.name}. Everyone else, eyes closed.`}
              onUnlock={unlock}
            />
          ) : !acted ? (
            <>
              <p className="narration">{NIGHT_PROMPT[current.role]}</p>
              {familyOf(current).length > 0 && (
                <div className="notice">
                  Your family:{" "}
                  {familyOf(current)
                    .map((p) => p.name)
                    .join(", ")}
                </div>
              )}
              {current.role === "mafia" && game.nightActions.mafiaTarget && (
                <div className="notice">
                  Your family chose{" "}
                  <b>{nameOf(game.nightActions.mafiaTarget)}</b>. Confirm, or
                  pick someone else.
                </div>
              )}
              <Roster
                game={game}
                viewer={current.id}
                selectable={nightTargets(current)}
                selected={selected}
                onSelect={pickTile}
              />
              <button
                className="btn"
                disabled={!selected}
                onClick={confirmNight}
              >
                Confirm
              </button>
            </>
          ) : (
            <>
              {current.role === "detective" &&
                (() => {
                  const inv = game.investigations.find(
                    (i) => i.detectiveId === current.id && i.day === game.day,
                  );
                  return inv ? (
                    <div className="notice">
                      <b>{nameOf(inv.targetId)}</b>{" "}
                      {inv.isMafia ? "is MAFIA." : "is NOT Mafia."}
                    </div>
                  ) : null;
                })()}
              {current.role !== "detective" && (
                <div className="notice">
                  {current.role === "villager"
                    ? "Nothing happens. Sleep well."
                    : "Your choice is made."}
                </div>
              )}
              <button className="btn" onClick={advance}>
                {lastBeat ? "Hide the screen" : "Hide & pass it on"}
              </button>
            </>
          ))}

        {/* ------------------------------------------------ NIGHT END */}
        {stage === "nightEnd" && (
          <>
            <p className="tag">THE NIGHT ENDS</p>
            <div className="announce">
              <p>Everyone has acted.</p>
              <p>
                Put the phone in the middle of the table. Everyone open your
                eyes.
              </p>
            </div>
            <button className="btn" onClick={wake}>
              Wake the city
            </button>
          </>
        )}

        {/* ------------------------------------------------ DAWN */}
        {stage === "dawn" && (
          <>
            <p className="tag">MORNING</p>
            <div className="announce">
              {sinceLastNightFall(game.log)
                .filter((e) => e.type !== "game_over")
                .map((e, i) => (
                  <p
                    key={i}
                    className="fade-line"
                    style={{ animationDelay: `${i * 0.8}s` }}
                  >
                    {narrate(e, nameOf)}
                  </p>
                ))}
            </div>
            <Roster game={game} />
            <button className="btn" onClick={afterDawn}>
              {game.phase === "gameover"
                ? "See the outcome"
                : "Begin the discussion"}
            </button>
          </>
        )}

        {/* ------------------------------------------------ DISCUSS */}
        {stage === "discuss" && (
          <>
            <p className="tag">THE TABLE TALKS</p>
            <p className="narration">{prompt}</p>

            {config.discussionSeconds > 0 ? (
              <>
                <div
                  className={`timer ${timeUp ? "timer-up" : secondsLeft <= 15 ? "timer-low" : ""}`}
                >
                  {timeUp ? "TIME’S UP" : fmt(secondsLeft)}
                </div>
                <div className="timer-controls">
                  <button
                    className="btn btn-ghost btn-small"
                    onClick={toggleTimer}
                    disabled={timeUp}
                  >
                    {running ? "Pause" : "Resume"}
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={addTime}>
                    +30s
                  </button>
                </div>
              </>
            ) : (
              <div className="notice">
                No timer. Talk for as long as you like.
              </div>
            )}

            <Roster game={game} />
            <button className="btn" onClick={startVote}>
              {timeUp ? "Time to vote" : "Call the vote"}
            </button>
          </>
        )}

        {/* ------------------------------------------------ VOTE */}
        {stage === "vote" &&
          current &&
          (!unlocked ? (
            <Gate
              name={current.name}
              index={turn}
              total={queue.length}
              subtitle="Vote in secret. Everyone else, look away."
              onUnlock={unlock}
            />
          ) : (
            <>
              <p className="tag">CAST YOUR VOTE</p>
              <Roster
                game={game}
                viewer={current.id}
                selectable={getLegalTargets(game, current.id)}
                selected={selected}
                onSelect={pickTile}
              />
              <div className="row">
                <button
                  className="btn btn-ghost"
                  onClick={() => submitVote(null)}
                >
                  Abstain
                </button>
                <button
                  className="btn"
                  disabled={!selected}
                  onClick={() => submitVote(selected)}
                >
                  Cast vote
                </button>
              </div>
            </>
          ))}

        {/* ------------------------------------------------ RESULT */}
        {stage === "result" &&
          (() => {
            const v = lastVote(game.log);
            const rows = v
              ? Object.entries(v.tally).sort((a, b) => b[1] - a[1])
              : [];
            return (
              <>
                <p className="tag">THE VERDICT</p>
                {v && (
                  <>
                    <div className="announce">
                      <p className="fade-line">{narrate(v, nameOf)}</p>
                    </div>
                    <ul className="votes">
                      {rows.length === 0 && <li>Nobody received a vote.</li>}
                      {rows.map(([id, n]) => (
                        <li key={id}>
                          <b>{nameOf(id)}</b>: {n} vote{n === 1 ? "" : "s"}
                        </li>
                      ))}
                    </ul>
                    {config.showVotes && (
                      <ul className="votes">
                        {Object.entries(v.votes).map(([voter, target]) => (
                          <li key={voter}>
                            <b>{nameOf(voter)}</b> →{" "}
                            {target ? nameOf(target) : "abstained"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <button className="btn" onClick={afterResult}>
                  {game.phase === "gameover"
                    ? "See the outcome"
                    : "Night falls"}
                </button>
              </>
            );
          })()}

        {/* ------------------------------------------------ GAME OVER */}
        {stage === "gameover" && (
          <>
            <p className="tag">GAME OVER</p>
            <div className="announce big">
              <p>
                {game.winner
                  ? narrate({ type: "game_over", winner: game.winner }, nameOf)
                  : ""}
              </p>
            </div>
            <Roster game={game} showAllRoles />
            <div className="row">
              <button className="btn btn-ghost" onClick={onExit}>
                Main menu
              </button>
              <button className="btn" onClick={rematch}>
                Rematch
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
