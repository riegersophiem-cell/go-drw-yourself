import type { CardColor, CardDefinition, PublicGameState } from "./types.ts";

/**
 * What a bot is allowed to see when deciding a move. Deliberately excludes
 * any other player's hand — bots must play by the same information rules as
 * humans, never with hidden-state advantage (see section 35 of the spec).
 */
export interface BotDecisionContext {
  ownHand: { instanceId: string; def: CardDefinition }[];
  legalInstanceIds: string[];
  publicState: PublicGameState;
}

export type BotAction =
  | { type: "PLAY_CARD"; instanceId: string; chosenColor?: CardColor }
  | { type: "DRAW" };

export type BotStrategyLevel = "EASY" | "NORMAL";

export function chooseBotAction(context: BotDecisionContext, level: BotStrategyLevel): BotAction {
  const playable = context.ownHand.filter((c) => context.legalInstanceIds.includes(c.instanceId));
  if (playable.length === 0) return { type: "DRAW" };

  if (level === "EASY") {
    const pick = playable[Math.floor(Math.random() * playable.length)];
    return { type: "PLAY_CARD", instanceId: pick.instanceId, chosenColor: chosenColorFor(pick.def, context) };
  }

  // NORMAL: prefer reducing hand size with strong cards first, keep own
  // color diversity in mind when choosing a wild color.
  const priority = (def: CardDefinition): number => {
    switch (def.type) {
      case "WILD_DRAW_10":
        return 100;
      case "WILD_DRAW_6":
        return 90;
      case "WILD_DRAW_4":
      case "WILD_REVERSE_DRAW_4":
        return 80;
      case "SKIP_EVERYONE":
        return 70;
      case "DRAW_2":
        return 60;
      case "SKIP":
      case "REVERSE":
        return 50;
      case "DISCARD_ALL":
        return 40;
      case "WILD_COLOR_ROULETTE":
      case "WILD":
        return 20;
      default:
        return 10;
    }
  };

  const best = playable.slice().sort((a, b) => priority(b.def) - priority(a.def))[0];
  return { type: "PLAY_CARD", instanceId: best.instanceId, chosenColor: chosenColorFor(best.def, context) };
}

function chosenColorFor(def: CardDefinition, context: BotDecisionContext): CardColor | undefined {
  if (def.color !== "WILD") return undefined;
  const counts: Record<Exclude<CardColor, "WILD">, number> = { RED: 0, BLUE: 0, GREEN: 0, YELLOW: 0 };
  for (const { def: cardDef } of context.ownHand) {
    if (cardDef.color !== "WILD") counts[cardDef.color] += 1;
  }
  const best = (Object.entries(counts) as [Exclude<CardColor, "WILD">, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : "RED";
}
