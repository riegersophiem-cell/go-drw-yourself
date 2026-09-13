import type { PublicPlayerView } from "../../game/types";
import { AVATAR_IMAGE } from "../../game/avatarImages";
import { playbackBeatText, type PlaybackBeat } from "../../multiplayer/playbackBeats";
import { Card } from "../Card/Card";
import "./TurnPlayback.css";

export interface TurnPlaybackProps {
  beat: PlaybackBeat;
  players: PublicPlayerView[];
  position: number;
  total: number;
  canSkip: boolean;
  onSkip: () => void;
  active?: boolean;
}

export function TurnPlayback({ beat, players, position, total, canSkip, onSkip, active = true }: TurnPlaybackProps) {
  const player = players.find((candidate) => candidate.playerId === beat.actorPlayerId);
  const name = (id: string | null | undefined) => players.find((candidate) => candidate.playerId === id)?.displayName ?? "Unbekannt";
  const text = playbackBeatText(beat, name);
  const drawCards = Math.min(3, beat.count ?? 1);

  return (
    <div className={`turn-playback ${active ? `turn-playback--active turn-playback--${beat.kind.toLowerCase()}` : "turn-playback--persistent"}`} data-beat-id={beat.id}>
      {active && <div className="turn-playback__motion" aria-hidden="true">
        {beat.card && <Card def={{ defId: `playback-${beat.id}`, color: beat.card.color, type: beat.card.type }} size="small" display />}
        {beat.kind === "DRAW" && <div className="turn-playback__draw-cards">{Array.from({ length: drawCards }, (_, index) => <Card key={index} def={{ defId: "back", color: "WILD", type: "WILD" }} faceDown size="small" />)}{(beat.count ?? 0) > 3 && <strong>+{(beat.count ?? 0) - 3}</strong>}</div>}
      </div>}
      <div className="turn-playback__narrator" role="status" aria-live="polite" aria-atomic="true">
        <div className="turn-playback__avatar">{player && AVATAR_IMAGE[player.avatar] ? <img src={AVATAR_IMAGE[player.avatar]} alt="" /> : <span>{player?.type === "BOT" ? "🤖" : "●"}</span>}</div>
        <div className="turn-playback__copy"><small>{position} / {total}</small><strong>{text}</strong></div>
        {active && canSkip && <button type="button" onClick={onSkip}>Überspringen</button>}
      </div>
    </div>
  );
}
