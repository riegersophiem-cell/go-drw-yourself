import type { CSSProperties } from "react";
import type { CardDefinition } from "../../game/types";
import { Card } from "../Card/Card";
import "./PlayerHand.css";

export interface HandCard {
  instanceId: string;
  def: CardDefinition;
}

export interface PlayerHandProps {
  cards: HandCard[];
  legalInstanceIds: string[];
  selectedInstanceId: string | null;
  disabled?: boolean;
  onSelect: (instanceId: string) => void;
}

const MAX_ROTATION_DEG = 22;
const MAX_RISE_PX = 26;

/**
 * How much vertical space below the fan's own (untransformed) layout box the
 * outermost card's `rotate()+translateY()` can visually reach. CSS
 * transforms don't contribute to layout size, so without this the container
 * doesn't know to reserve room for it and an ancestor `overflow: hidden`
 * (see `.player-game` in PlayerGame.css) clips the card.
 *
 * The outermost card's rise maxes out at `MAX_RISE_PX` for any hand of 2-7
 * cards (the `spread` factor in `fanStyle` only shrinks it for larger
 * hands), and rotating around the below-card `transformOrigin` swings its
 * bottom corner a bit further still — this constant covers both with a
 * margin, independent of hand size or viewport.
 */
const FAN_BOTTOM_RESERVE_PX = 48;

/** A real fanned hand: cards rotate outward from center and dip down toward the edges. */
function fanStyle(index: number, count: number): CSSProperties {
  if (count <= 1) return {};
  const mid = (count - 1) / 2;
  const offset = index - mid;
  const spread = Math.min(1, 7 / count); // denser hands fan less per-card so they don't over-rotate
  const rotate = offset * (MAX_ROTATION_DEG / Math.max(mid, 1)) * spread;
  const rise = Math.abs(offset) * (MAX_RISE_PX / Math.max(mid, 1)) * spread;
  return {
    transform: `rotate(${rotate}deg) translateY(${rise}px)`,
    transformOrigin: "50% 120%",
    zIndex: index,
  };
}

export function PlayerHand({ cards, legalInstanceIds, selectedInstanceId, disabled, onSelect }: PlayerHandProps) {
  return (
    <div
      className="player-hand"
      role="list"
      aria-label="Deine Handkarten"
      style={{ ["--fan-bottom-reserve" as string]: `${FAN_BOTTOM_RESERVE_PX}px` }}
    >
      <div className="player-hand__fan">
        {cards.map((c, i) => (
          <div className="player-hand__slot" key={c.instanceId} role="listitem" style={fanStyle(i, cards.length)}>
            <Card
              def={c.def}
              playable={!disabled && legalInstanceIds.includes(c.instanceId)}
              selected={selectedInstanceId === c.instanceId}
              onClick={() => onSelect(c.instanceId)}
            />
          </div>
        ))}
      </div>
      {cards.length === 0 && <p className="player-hand__empty">Keine Karten mehr.</p>}
    </div>
  );
}
