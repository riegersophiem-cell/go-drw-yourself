# CARD_LOGIC

Card **logic** (effect, targeting, color behavior, deck counts) lives here — never in the PNG art itself. This document was written by reading the actual rule engine (`src/game/rulesEngine.ts`, `src/game/cards.ts`, `src/game/types.ts`) as it exists today; nothing here was guessed, and **no rule/effect/count was changed** to produce this document (see `CARD_ASSET_UPDATE_REPORT.md` — this phase was assets-and-mapping only).

Internal `id` below is the `CardType` string used throughout the codebase (`src/game/types.ts`). "Display name" is what `src/components/Card/cardArt.ts` currently shows on the card (the in-game UI text — see the note on `TARGET_SKIP` below, where this differs from the new asset's own file-naming).

---

## CORE family

Pure matching cards — play only, no special effect (`DIAMOND`'s effect is explicitly undefined pending a rule decision, see below).

| id | display name | color behavior | effect | target rule | chosen-color | copies in deck |
|---|---|---|---|---|---|---|
| `TRIANGLE` | PASS | colored (5 colors) | none — matches by color or symbol | none | n/a | 4 per color × 5 = **20**, **80 total** with SQUARE/CIRCLE/SEMICIRCLE |
| `SQUARE` | LINK | colored | none | none | n/a | 4 per color = 20 |
| `CIRCLE` | PULSE | colored | none | none | n/a | 4 per color = 20 |
| `SEMICIRCLE` | ARC | colored | none | none | n/a | 4 per color = 20 |
| `DIAMOND` | SHOVE | colored | **`TODO_DEFINE_SHOVE_EFFECT`** — no effect is currently implemented; behaves exactly like a plain matching card (see `rulesEngine.ts`'s `applyImmediateEffectsAndAdvance` default branch) | none | n/a | 2 per color × 5 = **10** |

## ACTION family (colored)

| id | display name | color behavior | effect | target rule | chosen-color | copies in deck |
|---|---|---|---|---|---|---|
| `TARGET_SKIP` | **TARGET** (new asset file says "TIMEOUT" — see naming note below) | colored | marks a chosen player's *next own turn* to be skipped — the mark persists until it would actually become their turn (not necessarily the very next player), then is consumed (`turnManager.advanceTurnConsumingSkips`) | player chooses any other non-eliminated active player via a follow-up `CHOOSE_SKIP_TARGET` action (`WAITING_FOR_SKIP_TARGET` phase) | n/a | 2 per color = **10** |
| `GIVE_TWO_TO_LOWEST` | LOWEST | colored | immediately (not stacked) makes the active player with the *fewest* cards draw 2 | automatic — no player choice; ties broken by seat order (`TODO_DEFINE_LOWEST_HAND_TIE_RULE` — explicitly a placeholder, not a finalized rule, see `rulesEngine.ts` comment) | n/a | 2 per color = 10 |
| `DISCARD_ONE_EXTRA` | DITCH (new asset file says "ONE MORE") | colored | after playing, the player must immediately discard one additional card from hand via a follow-up `DISCARD_EXTRA_CARD` action; the extra card never becomes the visible top card — the triggering action card stays on top | the extra-discard card is the player's own free choice from their hand | n/a | 2 per color = 10 |
| `DRAW_1` | DRAW 1 | colored | next player draws 1 (stackable draw effect, `applyDrawEffect`) | automatic (next player in turn order) | n/a | 2 per color = 10 |
| `DRAW_2` | DRAW 2 | colored | next player draws 2 (stackable) | automatic | n/a | 2 per color = 10 |
| `DRAW_4` | DRAW 4 | colored — distinct from the colorless `WILD_DRAW_4` chaos card | next player draws 4 (stackable) | automatic | n/a | 1 per color = **5** |
| `SKIP` | SKIP | colored | skips the immediately next player | automatic | n/a | 2 per color = 10 |
| `REVERSE` | REVERSE | colored | flips turn direction | automatic | n/a | 2 per color = 10 |
| `DISCARD_ALL` | DROP ALL | colored | discards every card of the currently active color from the player's own hand (`applyDiscardAll`) | automatic, self-targeting | n/a | 1 per color = **5** |

## CHAOS family (colorless — `color: "WILD"`)

Always playable regardless of the active color; resolving one always requires a fresh color choice first (`WAITING_FOR_COLOR` phase, `isWildDefinition()`).

| id | display name | effect | target rule | chosen-color behavior | copies in deck |
|---|---|---|---|---|---|
| `SWAP_HAND` | SWAP | swaps the player's entire hand with a chosen player's, immediately | player chooses any other active player via `CHOOSE_SWAP_TARGET` (`WAITING_FOR_SWAP_TARGET` phase) | mandatory color choice on play | **10** |
| `ROTATE_HANDS` | ROTATE | every active player's hand passes along in the current turn direction, immediately, before the turn advances | automatic, affects everyone | mandatory | **5** |
| `SKIP_EVERYONE` | SKIP ALL | skips every other active player once; play returns to the same player | automatic | mandatory | 2 |
| `WILD_REVERSE_DRAW_4` | REVERSE +4 | flips direction *and* the next player draws 4 (stackable) | automatic | mandatory | 2 |
| `WILD_DRAW_6` | WILD DRAW 6 | next player draws 6 (stackable) | automatic | mandatory | 2 |
| `WILD_DRAW_10` | WILD DRAW 10 | next player draws 10 (stackable) | automatic | mandatory | 1 |
| `WILD_COLOR_ROULETTE` | COLOR ROULETTE | (see `rulesEngine.ts`/`botStrategy.ts` for exact resolution — not touched or re-audited this phase beyond confirming its art mapping) | — | mandatory | 2 |
| `WILD` | WILD | plain color-only wild, no other effect | n/a | mandatory | 4 |
| `WILD_DRAW_4` | WILD DRAW 4 | next player draws 4 (stackable) — colorless, distinct from the colored `DRAW_4` action card | automatic | mandatory | 4 |

## BACK

| id | file |
|---|---|
| card back (face-down) | `backcover.png` |

---

## Naming note: asset family names vs. in-game display names

The new final art's own filenames introduce family/type names that don't always match the text this app currently shows in the UI. Documented here, **not** silently changed in the running UI (renaming a card's displayed name is a UX/copy decision, not an asset-mapping one — out of this phase's scope):

- `TARGET_SKIP` — new asset file is `action_{color}_timeout.png`, but the app's UI still displays "TARGET" (card caption, Action Focus headline). 
- `DISCARD_ONE_EXTRA` — new asset file is `action_{color}_one_more.png`, UI still displays "DITCH".
- Colors: the new asset files spell yellow as `gold` (`core_gold_triangle.png`, etc.) — this is asset-naming only; the `CardColor` type itself is untouched (`"YELLOW"`).
- `WILD_REVERSE_DRAW_4` — new asset file is `chaos_reverse_plus_4.png` (not `..._draw_4`).
- `SEMICIRCLE` ("ARC") — new asset file uses `half_circle`, not `arc`, despite the brief's own family list saying "arc".

## Gap closed

`DRAW_1` and `WILD_DRAW_4` initially had no final asset (see `CARD_ASSET_UPDATE_REPORT.md` §2 for how this was found and flagged). Both are now fully covered by a follow-up asset delivery — see `CARD_ASSET_UPDATE_REPORT.md` §9 for exactly how (`DRAW_1`: a full 5-color pixel-matched set delivered directly; the redesigned `DRAW_2`/`DRAW_4` families and `WILD_DRAW_4` similarly). No card in this game renders anything outside `/public/assets/cards/final/png/` anymore.
