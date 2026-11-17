import { useEffect, useState } from "react";
import {
  castVote,
  createGame,
  getLegalTargets,
  resolveNight,
  resolveVote,
  submitNightAction,
} from "../engine";
import type { GameEvent, GameState, Role } from "../engine";
import { pickBotNames } from "../ai/names";
import { autoBotVotes, autoNightActions } from "../ai/runner";
import {
  generateDiscussion,
  suspicionFrom,
  type ChatLine,
} from "../ai/discussion";
import { narrate, ROLE_NAME } from "../ui/narration";
import { sfx } from "../ui/sfx";
import type { GameConfig } from "./SetupScreen";
import "./GameScreen.css";
import { music } from "../ui/music";

const HUMAN_ID = "human";

type Stage = "reveal" | "night" | "dawn" | "day" | "result" | "gameover";

const ROLE_INFO: Record<Role, string> = {
  villager:
    "You have no powers, only your wits. Find the Mafia before they find you.",
  doctor: "Each night, choose one person to protect from the Mafia.",
  detective: "Each night, investigate one person and learn if they are Mafia.",
  mafia: "Each night, choose a victim. By day, blend in and survive.",
};

const NIGHT_PROMPT: Partial<Record<Role, string>> = {
  mafia: "Choose who disappears tonight.",
  doctor: "Choose who you will protect tonight.",
  detective: "Choose who you will investigate tonight.",
};

function deal(config: GameConfig): GameState {
  const botNames = pickBotNames(config.playerCount - 1, [config.playerName]);
  return createGame(
    [
      { id: HUMAN_ID, name: config.playerName, isBot: false },
      ...botNames.map((name, i) => ({ id: `bot${i}`, name, isBot: true })),
    ],
    config.settings,
  );
}

/** The set of humans who are still alive (bots act for everyone else). */
function humansOf(g: GameState): Set<string> {
  return new Set(
    g.players.filter((p) => p.id === HUMAN_ID && p.alive).map((p) => p.id),
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

// ------------------------------------------------------------ player grid

interface GridProps {
  game: GameState;
  selectable?: string[];
  selected: string | null;
  onSelect?: (id: string) => void;
  showAllRoles?: boolean;
}

function PlayerGrid({
  game,
  selectable = [],
  selected,
  onSelect,
  showAllRoles = false,
}: GridProps) {
  const me = game.players.find((p) => p.id === HUMAN_ID)!;
  return (
    <ul className="grid">
      {game.players.map((p) => {
        const canPick = selectable.includes(p.id);
        const roleKnown =
          showAllRoles ||
          (!p.alive && game.settings.revealRoleOnDeath) ||
          (me.role === "mafia" && p.role === "mafia");
        const cls = [
          "tile",
          !p.alive && "tile-dead",
          p.id === HUMAN_ID && "tile-me",
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
                {p.id === HUMAN_ID && " (you)"}
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

// --------------------------------------------------------------- screen

interface Props {
  config: GameConfig;
  onExit: () => void;
}

export default function GameScreen({ config, onExit }: Props) {
  const [game, setGame] = useState(() => deal(config));
  const [stage, setStage] = useState<Stage>("reveal");
  const [selected, setSelected] = useState<string | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [shown, setShown] = useState(0);
  const [accused, setAccused] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());

  const me = game.players.find((p) => p.id === HUMAN_ID)!;
  const nameOf = (id: string) =>
    game.players.find((p) => p.id === id)?.name ?? "?";

  // Reveal discussion lines one at a time
  useEffect(() => {
    if (stage !== "day" || shown >= chat.length) return;
    const t = window.setTimeout(() => setShown((s) => s + 1), 1200);
    return () => window.clearTimeout(t);
  }, [stage, shown, chat.length]);

  useEffect(() => () => music.stop(), []);

  // ---------- transitions

  function pickTile(id: string) {
    sfx.click();
    setSelected(id);
  }

  function toggleMute() {
    sfx.setMuted(!muted);
    setMuted(!muted);
    music.refresh();
  }

  function startNight(g: GameState) {
    music.start();
    setGame(autoNightActions(g, humansOf(g)));
    setSelected(null);
    setStage("night");
    sfx.night();
  }

  function confirmNightAction() {
    if (!selected) return;
    sfx.click();
    let g = submitNightAction(game, HUMAN_ID, selected);
    g = autoNightActions(g, humansOf(g));
    setGame(g);
    setSelected(null);
  }

  function wakeUp() {
    if (sleeping) return;
    setSleeping(true);
    window.setTimeout(() => {
      const g = resolveNight(game);
      setGame(g);
      setSleeping(false);
      setStage("dawn");
      sfx.dawn();
      if (sinceLastNightFall(g.log).some((e) => e.type === "morning_death")) {
        window.setTimeout(sfx.death, 700);
      }
    }, 1800);
  }

  function playEnd(g: GameState) {
    const won = g.winner === (me.role === "mafia" ? "mafia" : "village");
    if (won) sfx.win();
    else sfx.lose();
  }

  function afterDawn() {
    if (game.phase === "gameover") {
      setStage("gameover");
      playEnd(game);
      return;
    }
    setChat(generateDiscussion(game, humansOf(game)));
    setShown(0);
    setAccused(false);
    setSelected(null);
    setStage("day");
  }

  function accuse() {
    if (!selected || accused) return;
    sfx.click();
    const line: ChatLine = {
      speakerId: HUMAN_ID,
      kind: "accuse",
      targetId: selected,
      text: `I'm pointing at ${nameOf(selected)}. Think about it.`,
      weight: 1.5,
    };
    setChat((c) => [...c, line]);
    setShown((s) => s + 1);
    setAccused(true);
  }

  function submitVote(target: string | null) {
    sfx.click();
    let g = game;
    if (me.alive) g = castVote(g, HUMAN_ID, target);
    g = autoBotVotes(g, humansOf(g), Math.random, suspicionFrom(chat));
    g = resolveVote(g);
    setGame(g);
    setSelected(null);
    setStage("result");
    if (lastVote(g.log)?.type === "vote_elimination") sfx.death();
  }

  function afterResult() {
    if (game.phase === "gameover") {
      setStage("gameover");
      playEnd(game);
    } else {
      startNight(game);
    }
  }

  function playAgain() {
    setGame(deal(config));
    setSelected(null);
    setChat([]);
    setShown(0);
    setStage("reveal");
  }

  // ---------- derived night state

  const hasNightPower =
    me.alive && ["mafia", "doctor", "detective"].includes(me.role);
  const actedTonight =
    me.role === "mafia"
      ? game.nightActions.mafiaTarget !== null
      : me.role === "doctor"
        ? game.nightActions.doctorTarget !== null
        : game.nightActions.detectiveTarget !== null;
  const needsToAct = stage === "night" && hasNightPower && !actedTonight;

  const investigation = game.investigations.find(
    (i) => i.detectiveId === HUMAN_ID && i.day === game.day,
  );

  const isNight = stage === "reveal" || stage === "night";
  useEffect(() => {
    music.setMood(isNight ? "night" : "day");
  }, [isNight]);
  const themeClass = isNight ? "game game-night" : "game game-day";
  const votingReady = shown >= chat.length;

  // ---------- render

  return (
    <div className={themeClass}>
      <div className={isNight ? "moon" : "sun"} />

      <header className="hud">
        <span className="hud-phase">
          {stage === "reveal"
            ? "The Deal"
            : `${isNight ? "Night" : "Day"} ${game.day}`}
        </span>
        <div className="hud-right">
          <span
            className={`hud-role ${me.role === "mafia" ? "hud-mafia" : ""}`}
          >
            {ROLE_NAME[me.role]}
            {!me.alive && " (dead)"}
          </span>
          <button
            className="mute"
            onClick={toggleMute}
            aria-label="Toggle sound"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      <main className="stage" key={stage}>
        {/* ------------------------------------------------ REVEAL */}
        {stage === "reveal" && (
          <>
            <p className="tag">YOUR ROLE</p>
            <div
              className={`role-card reveal ${me.role === "mafia" ? "role-mafia" : ""}`}
            >
              <h2>{ROLE_NAME[me.role]}</h2>
              <p>{ROLE_INFO[me.role]}</p>
              {me.role === "mafia" &&
                game.players.filter((p) => p.role === "mafia" && p.id !== me.id)
                  .length > 0 && (
                  <p className="role-team">
                    Your family:{" "}
                    {game.players
                      .filter((p) => p.role === "mafia" && p.id !== me.id)
                      .map((p) => p.name)
                      .join(", ")}
                  </p>
                )}
            </div>
            <PlayerGrid game={game} selected={null} />
            <button className="btn" onClick={() => startNight(game)}>
              Night falls
            </button>
          </>
        )}

        {/* ------------------------------------------------ NIGHT */}
        {stage === "night" && (
          <>
            <p className="narration">
              The city sleeps. Somewhere in the dark, a door creaks...
            </p>

            {needsToAct && (
              <>
                <p className="tag">{NIGHT_PROMPT[me.role]}</p>
                <PlayerGrid
                  game={game}
                  selectable={getLegalTargets(game, HUMAN_ID)}
                  selected={selected}
                  onSelect={pickTile}
                />
                <button
                  className="btn"
                  disabled={!selected}
                  onClick={confirmNightAction}
                >
                  Confirm
                </button>
              </>
            )}

            {!needsToAct && (
              <>
                {me.role === "detective" && investigation && (
                  <div className="notice">
                    <b>{nameOf(investigation.targetId)}</b>{" "}
                    {investigation.isMafia ? "is MAFIA." : "is NOT Mafia."}
                  </div>
                )}
                {hasNightPower && actedTonight && me.role !== "detective" && (
                  <div className="notice">
                    Your choice is made. Now wait for dawn.
                  </div>
                )}
                {!me.alive && (
                  <div className="notice">You watch from beyond the grave.</div>
                )}
                <PlayerGrid game={game} selected={null} />
                <button className="btn" disabled={sleeping} onClick={wakeUp}>
                  {sleeping
                    ? "The night passes..."
                    : hasNightPower
                      ? "Wait for dawn"
                      : "Sleep until dawn"}
                </button>
              </>
            )}
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
            <PlayerGrid game={game} selected={null} />
            <button className="btn" onClick={afterDawn}>
              {game.phase === "gameover"
                ? "See the outcome"
                : "Begin the discussion"}
            </button>
          </>
        )}

        {/* ------------------------------------------------ DAY */}
        {stage === "day" && (
          <>
            <p className="tag">THE TABLE TALKS</p>
            <ul className="chat">
              {chat.length === 0 && (
                <li className="typing">
                  The table is silent. Nobody dares speak.
                </li>
              )}
              {chat.slice(0, shown).map((l, i) => (
                <li
                  key={i}
                  className={`bubble ${l.speakerId === HUMAN_ID ? "bubble-me" : ""}`}
                >
                  <b>{nameOf(l.speakerId)}</b>
                  <span>{l.text}</span>
                </li>
              ))}
              {!votingReady && (
                <li className="typing">
                  {nameOf(chat[shown].speakerId)} is speaking...{" "}
                  <button
                    className="link"
                    onClick={() => setShown(chat.length)}
                  >
                    skip
                  </button>
                </li>
              )}
            </ul>

            {votingReady && (
              <>
                <p className="narration">
                  {me.alive ? "Who gets your vote?" : "You can only watch."}
                </p>
                <PlayerGrid
                  game={game}
                  selectable={me.alive ? getLegalTargets(game, HUMAN_ID) : []}
                  selected={selected}
                  onSelect={pickTile}
                />
                {me.alive ? (
                  <>
                    <button
                      className="btn btn-ghost"
                      disabled={!selected || accused}
                      onClick={accuse}
                    >
                      {accused ? "You have spoken" : "Accuse them aloud"}
                    </button>
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
                ) : (
                  <button className="btn" onClick={() => submitVote(null)}>
                    Watch the vote
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ------------------------------------------------ RESULT */}
        {stage === "result" &&
          (() => {
            const v = lastVote(game.log);
            return (
              <>
                <p className="tag">THE VERDICT</p>
                {v && (
                  <>
                    <div className="announce">
                      <p className="fade-line">{narrate(v, nameOf)}</p>
                    </div>
                    <ul className="votes">
                      {Object.entries(v.votes).map(([voter, target]) => (
                        <li key={voter}>
                          <b>{nameOf(voter)}</b> →{" "}
                          {target ? nameOf(target) : "abstained"}
                        </li>
                      ))}
                    </ul>
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
              <p className="outcome">
                {game.winner === (me.role === "mafia" ? "mafia" : "village")
                  ? "You win."
                  : "You lose."}
              </p>
            </div>
            <PlayerGrid game={game} selected={null} showAllRoles />
            <div className="row">
              <button className="btn btn-ghost" onClick={onExit}>
                Main menu
              </button>
              <button className="btn" onClick={playAgain}>
                Play again
              </button>
            </div>
          </>
        )}

        {import.meta.env.DEV && stage !== "gameover" && (
          <details className="debug">
            <summary>Debug: reveal all roles</summary>
            <ul>
              {game.players.map((p) => (
                <li key={p.id}>
                  {p.name}: {p.role} {p.alive ? "" : "(dead)"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
    </div>
  );
}
