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
    <div className="player-hand" role="list" aria-label="Deine Handkarten">
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
