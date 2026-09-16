import { useEffect, useState, type CSSProperties } from "react";
import type { PublicPlayerView } from "../../game/types";
import { AVATAR_IMAGE } from "../../game/avatarImages";
import { playbackBeatText, type PlaybackBeat } from "../../multiplayer/playbackBeats";
import { classifyBeatSeverity } from "../../game/actionSeverity";
import { Card } from "../Card/Card";
import "./ActionFocus.css";

export interface ActionFocusProps {
  beat: PlaybackBeat;
  players: PublicPlayerView[];
  position: number;
  total: number;
  canSkip: boolean;
  onSkip: () => void;
  active?: boolean;
  /** TABLE_DEVICE only: suppresses the generic floating draw-cards flourish, since ActionChoreography already flies real card-backs to the affected Player Unit there. */
  tableDevice?: boolean;
}

const COLOR_HEX: Record<string, string> = { RED: "#e5484d", BLUE: "#3b82f6", GREEN: "#22c55e", YELLOW: "#eab308", VIOLET: "#7047eb" };

function actionTitle(beat: PlaybackBeat): string {
  if (beat.kind === "SWAP" || beat.card?.type === "SWAP_HAND") return "SWAP";
  if (beat.kind === "ROTATE" || beat.card?.type === "ROTATE_HANDS") return "ROTATE";
  if (beat.card?.type === "SKIP_EVERYONE") return "SKIP ALL";
  if (beat.card?.type === "WILD_COLOR_ROULETTE") return "COLOR ROULETTE";
  if (beat.card?.type === "WILD_DRAW_10") return "DRAW 10";
  if (beat.card?.type === "WILD_REVERSE_DRAW_4") return "REVERSE +4";
  if (beat.kind === "SKIP") return "TARGET";
  if (beat.card?.type === "GIVE_TWO_TO_LOWEST") return "LOWEST";
  if (beat.card?.type === "DRAW_2") return "DRAW 2";
  if (beat.card?.type === "DRAW_4" || beat.card?.type === "WILD_DRAW_4") return "DRAW 4";
  if (beat.card?.type === "SKIP") return "SKIP";
  if (beat.card?.type === "REVERSE") return "REVERSE";
  if (beat.kind === "STACK") return "STACK";
  // A plain "DRAW" beat (the moment ActionChoreography actually flies the
  // cards) never carries the triggering card — only its resolved count —
  // so it needs its own title independent of the `beat.card?.type` checks
  // above, which only fire for the earlier "PLAY" beat of that same card.
  if (beat.kind === "DRAW" && beat.totalAmount) return `+${beat.totalAmount}`;
  return "";
}

/**
 * The Action Presentation System: exactly two visual stages (Standard /
 * Major, see actionSeverity.ts), driven entirely by an already-resolved
 * PlaybackBeat — this never decides game behavior, it only presents an
 * outcome the server already committed (brief section 65/16 of
 * ACTION_FOCUS_FIX_REPORT.md). On TABLE_DEVICE, motion (ActionChoreography,
 * rendered alongside this by GameTable) explains the action; this component
 * only adds a compact title, a light dim (no blur — the table stays the
 * stage), and colour response. Text never replaces the movement.
 */
export function ActionFocus({ beat, players, position, total, canSkip, onSkip, active = true, tableDevice = false }: ActionFocusProps) {
  const severity = classifyBeatSeverity(beat);
  const player = players.find((candidate) => candidate.playerId === beat.actorPlayerId);
  const isThinkingBot = active && player?.type === "BOT";
  const [revealedBotBeatId, setRevealedBotBeatId] = useState<string | null>(null);
  const botActionVisible = !isThinkingBot || revealedBotBeatId === beat.id;

  useEffect(() => {
    if (!isThinkingBot) return;
    const timeout = window.setTimeout(() => setRevealedBotBeatId(beat.id), 3900);
    return () => window.clearTimeout(timeout);
  }, [beat.id, isThinkingBot]);

  const name = (id: string | null | undefined) => players.find((candidate) => candidate.playerId === id)?.displayName ?? "Unbekannt";
  const text = playbackBeatText(beat, name);
  const accentColor = beat.chosenColor ? COLOR_HEX[beat.chosenColor] : beat.card && beat.card.color !== "WILD" ? COLOR_HEX[beat.card.color] : null;

  // Standard/Major beats get their own compact headline (below) — the
  // narrator/"bot denkt nach" bar is reserved for plain (NONE-severity)
  // plays so it never sits as a second status message over an Action Focus
  // (brief section 10/11).
  const showNarrator = severity === "NONE";
  const title = actionTitle(beat);

  return (
    <div
      className={[
        "action-focus",
        tableDevice && "action-focus--table",
        active ? `action-focus--active action-focus--${beat.kind.toLowerCase()} action-focus--${severity.toLowerCase()}` : "action-focus--persistent",
      ].filter(Boolean).join(" ")}
      data-beat-id={beat.id}
      style={accentColor ? ({ ["--action-accent" as string]: accentColor } as CSSProperties) : undefined}
    >
      {active && severity === "MAJOR" && <div className="action-focus__scrim" aria-hidden="true" />}
      {active && botActionVisible && beat.card && (
        <div className="action-focus__motion" aria-hidden="true">
          <Card def={{ defId: `playback-${beat.id}`, color: beat.card.color, type: beat.card.type }} size={severity === "MAJOR" ? "normal" : "small"} display />
        </div>
      )}

      {active && severity !== "NONE" && title && (
        <div className="action-focus__headline" aria-hidden="true">
          <span className="action-focus__title">{title}</span>
          {beat.kind === "SWAP" && beat.targetPlayerId && <span className="action-focus__subtitle">{name(beat.actorPlayerId)} ⇄ {name(beat.targetPlayerId)}</span>}
          {beat.kind === "ROTATE" && <span className="action-focus__subtitle">Hands move</span>}
          {beat.kind === "SKIP" && beat.targetPlayerId && <span className="action-focus__subtitle">{name(beat.actorPlayerId)} → {name(beat.targetPlayerId)}</span>}
          {beat.kind === "DRAW" && beat.totalAmount && <span className="action-focus__subtitle">{name(beat.actorPlayerId)}</span>}
          {beat.chosenColor && beat.kind !== "ROTATE" && beat.kind !== "SKIP" && beat.kind !== "SWAP" && <span className="action-focus__subtitle">{beat.chosenColor}</span>}
        </div>
      )}

      {showNarrator && (
        <div className="action-focus__narrator" role="status" aria-live="polite" aria-atomic="true">
          <div className="action-focus__avatar">{player && AVATAR_IMAGE[player.avatar] ? <img src={AVATAR_IMAGE[player.avatar]} alt="" /> : <span>{player?.type === "BOT" ? "🤖" : "●"}</span>}</div>
          <div className="action-focus__copy"><small>{position} / {total}</small><strong>{isThinkingBot && !botActionVisible ? `${player.displayName} überlegt …` : text}</strong></div>
          {active && canSkip && <button type="button" onClick={onSkip}>Überspringen</button>}
        </div>
      )}
      {!showNarrator && active && canSkip && (
        <button type="button" className="action-focus__skip" onClick={onSkip} aria-label="Aktion überspringen">»</button>
      )}
    </div>
  );
}
