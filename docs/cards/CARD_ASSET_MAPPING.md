# CARD_ASSET_MAPPING

Maps every `(color, CardType)` combination to its exact final PNG file. The **code** mapping lives in `src/components/Card/cardArt.ts` (`getCardArt()`) — this document mirrors it for reference; if the two ever disagree, `cardArt.ts` is authoritative (it's what actually renders).

Base path for all "final" entries: `/public/assets/cards/final/png/`

## CORE (colored, 5 shapes × 5 colors = 25 files)

| CardType | red | blue | green | gold (=YELLOW) | violet |
|---|---|---|---|---|---|
| `TRIANGLE` | `core_red_triangle.png` | `core_blue_triangle.png` | `core_green_triangle.png` | `core_gold_triangle.png` | `core_violet_triangle.png` |
| `SQUARE` | `core_red_square.png` | `core_blue_square.png` | `core_green_square.png` | `core_gold_square.png` | `core_violet_square.png` |
| `CIRCLE` | `core_red_circle.png` | `core_blue_circle.png` | `core_green_circle.png` | `core_gold_circle.png` | `core_violet_circle.png` |
| `SEMICIRCLE` | `core_red_half_circle.png` | `core_blue_half_circle.png` | `core_green_half_circle.png` | `core_gold_half_circle.png` | `core_violet_half_circle.png` |
| `DIAMOND` | `core_red_diamond.png` | `core_blue_diamond.png` | `core_green_diamond.png` | `core_gold_diamond.png` | `core_violet_diamond.png` |

## ACTION (colored, 8 types × 5 colors = 40 files)

| CardType | red | blue | green | gold | violet |
|---|---|---|---|---|---|
| `TARGET_SKIP` | `action_red_timeout.png` | `action_blue_timeout.png` | `action_green_timeout.png` | `action_gold_timeout.png` | `action_violet_timeout.png` |
| `GIVE_TWO_TO_LOWEST` | `action_red_lowest.png` | `action_blue_lowest.png` | `action_green_lowest.png` | `action_gold_lowest.png` | `action_violet_lowest.png` |
| `DISCARD_ONE_EXTRA` | `action_red_one_more.png` | `action_blue_one_more.png` | `action_green_one_more.png` | `action_gold_one_more.png` | `action_violet_one_more.png` |
| `DRAW_2` | `action_red_draw_2.png` | `action_blue_draw_2.png` | `action_green_draw_2.png` | `action_gold_draw_2.png` | `action_violet_draw_2.png` |
| `DRAW_4` | `action_red_draw_4.png` | `action_blue_draw_4.png` | `action_green_draw_4.png` | `action_gold_draw_4.png` | `action_violet_draw_4.png` |
| `SKIP` | `action_red_skip.png` | `action_blue_skip.png` | `action_green_skip.png` | `action_gold_skip.png` | `action_violet_skip.png` |
| `REVERSE` | `action_red_reverse.png` | `action_blue_reverse.png` | `action_green_reverse.png` | `action_gold_reverse.png` | `action_violet_reverse.png` |
| `DISCARD_ALL` | `action_red_drop_all.png` | `action_blue_drop_all.png` | `action_green_drop_all.png` | `action_gold_drop_all.png` | `action_violet_drop_all.png` |
| `DRAW_1` | `action_red_draw_1.png` | `action_blue_draw_1.png` | `action_green_draw_1.png` | `action_gold_draw_1.png` | `action_violet_draw_1.png` |

`DRAW_1` was a follow-up delivery — a complete, already pixel-matched 5-color set (no local regeneration needed, only renamed from `DRAW_1_{RED,BLUE,GREEN,YELLOW,PURPLE}.png`). `DRAW_2`/`DRAW_4` were also replaced by a follow-up **redesign**, delivered in one color each (gold/violet) — the other 4 colors for both were generated locally from that master via an HSV hue-shift (see `CARD_ASSET_UPDATE_REPORT.md` §9 for the exact method and verification).

## CHAOS (colorless — one file per type, no color axis)

| CardType | file |
|---|---|
| `SWAP_HAND` | `chaos_swap.png` |
| `ROTATE_HANDS` | `chaos_rotate.png` |
| `SKIP_EVERYONE` | `chaos_skip_all.png` |
| `WILD_REVERSE_DRAW_4` | `chaos_reverse_plus_4.png` |
| `WILD_DRAW_6` | `chaos_wild_draw_6.png` |
| `WILD_DRAW_10` | `chaos_wild_draw_10.png` |
| `WILD_COLOR_ROULETTE` | `chaos_color_roulette.png` |
| `WILD` | `chaos_wild_wish.png` |
| `WILD_DRAW_4` | `chaos_wild_draw_4.png` |

`WILD_DRAW_4` was a follow-up delivery — colorless, single file, no regeneration needed.

## BACK

| | file |
|---|---|
| card back | `backcover.png` |

## Example lookups (as requested)

- `action_timeout + red` → `TARGET_SKIP` + `RED` → `/assets/cards/final/png/action_red_timeout.png`
- `chaos_swap` → `SWAP_HAND` (any color, since colorless) → `/assets/cards/final/png/chaos_swap.png`

## Full asset inventory under `/public/assets/cards/final/png/` (80 files, current)

Every file present was checked against the official family list in the brief and against the CardType system actually used by the rule engine. **No duplicates found.** One naming variance from the brief's own spec (not a defect, just noted): the brief lists the CORE family's fifth shape as "arc", the delivered files use `half_circle`.

| Family | Count | Colors | Notes |
|---|---|---|---|
| `core_*` | 25 | 5 shapes × 5 colors | Complete |
| `action_*` | 45 | 9 types × 5 colors | Complete — `draw_1` added, `draw_2`/`draw_4` redesigned, in a follow-up delivery (see `CARD_ASSET_UPDATE_REPORT.md` §9) |
| `chaos_*` | 9 | colorless | Complete — `wild_draw_4` added in the same follow-up |
| `backcover.png` | 1 | — | Present |
| **Total** | **80** | | |

**Every `CardType` now has a final asset — no gaps remain, no card renders anything outside this folder.**
