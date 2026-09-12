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

export function PlayerHand({ cards, legalInstanceIds, selectedInstanceId, disabled, onSelect }: PlayerHandProps) {
  return (
    <div className="player-hand" role="list" aria-label="Deine Handkarten">
      {cards.map((c) => (
        <div className="player-hand__slot" key={c.instanceId} role="listitem">
          <Card
            def={c.def}
            playable={!disabled && legalInstanceIds.includes(c.instanceId)}
            selected={selectedInstanceId === c.instanceId}
            onClick={() => onSelect(c.instanceId)}
          />
        </div>
      ))}
      {cards.length === 0 && <p className="player-hand__empty">Keine Karten mehr.</p>}
    </div>
  );
}
