import type { CardDefinition, CardInstance } from "./types.ts";

let instanceCounter = 0;
function nextInstanceId(): string {
  instanceCounter += 1;
  return `card_${instanceCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function instantiateDeck(definitions: CardDefinition[]): CardInstance[] {
  return definitions.map((def) => ({ instanceId: nextInstanceId(), defId: def.defId }));
}

/**
 * Fisher-Yates shuffle. Must run server-side only — never expose draw pile
 * order or use client-controllable randomness for it.
 */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
