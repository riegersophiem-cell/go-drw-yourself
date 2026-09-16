# CARD_ASSET_UPDATE_REPORT

Scope: replace all card art with the new final PNGs under `/public/assets/cards/final/png/` as the binding visual source of truth. **Not touched**: card effects, rule engine, deck logic, UI layout, action animations — confirmed by diff (only `src/components/Card/cardArt.ts`, `src/components/Card/Card.tsx`, `src/components/Card/Card.css` (one dead CSS rule removed), `tests/cardAssets.test.ts`, and file moves under `/public/assets/cards/` were touched).

## 1. New assets found (audited before any code change)

74 PNG files under `/public/assets/cards/final/png/`, fully catalogued:

| Family | Count | Structure |
|---|---|---|
| `core_*` | 25 | 5 shapes (`triangle`, `square`, `circle`, `half_circle`, `diamond`) × 5 colors (`red`, `blue`, `green`, `gold`, `violet`) |
| `action_*` | 40 | 8 types (`timeout`, `lowest`, `one_more`, `draw_2`, `draw_4`, `skip`, `reverse`, `drop_all`) × 5 colors |
| `chaos_*` | 8 | colorless — `swap`, `rotate`, `skip_all`, `reverse_plus_4`, `wild_draw_6`, `wild_draw_10`, `color_roulette`, `wild_wish` |
| `backcover.png` | 1 | card back |

**No duplicates, no unassignable files.** Full per-file mapping in `docs/cards/CARD_ASSET_MAPPING.md`.

Two naming variances from the brief's own family list (not defects — the brief's names vs. the delivered filenames):
- CORE's fifth shape: brief says "arc", files use `half_circle`.
- CHAOS's reverse+draw-4: brief says "reverse_draw_4", file is `chaos_reverse_plus_4.png`.
- Colors: files spell yellow as `gold` (asset-naming only — the `CardColor` type itself is still `"YELLOW"`).

## 2. Missing assets (confirmed against the real deck — not guessed)

Two `CardType`s are real, currently-dealt deck cards with **no PNG in the new set at all**:

| CardType | Real deck copies | Why it's real (not a leftover type) |
|---|---|---|
| `DRAW_1` | 2 × 5 colors = 10 | `cards.ts`'s `draw1PerColor: 2`, actually pushed into every fresh deck |
| `WILD_DRAW_4` | 4 | `cards.ts`'s `wildDraw4: 4`, actually pushed into every fresh deck |

I flagged this to you before making any further change (see the question I asked). **Your answer: you will supply the missing files.** Until then, per that decision, these two `CardType`s temporarily continue to render their old art (`/public/assets/cards/png/gdy_{color}_draw_1.png` and `gdy_black_wild_draw_4.png` respectively) — the only two places in the whole app still referencing anything outside `final/png/`, both explicitly commented as temporary in `cardArt.ts` (`legacyColored`/`legacyColorless`, with a comment telling the next person exactly what to delete once real art arrives).

**No other type is missing or a duplicate.**

## 3. Card logic documentation

`docs/cards/CARD_LOGIC.md` (new) — every `CardType`'s internal id, display name, color behavior, effect, target rule, chosen-color behavior, and deck copy count, written by reading the actual `rulesEngine.ts`/`cards.ts`/`types.ts` (not from memory or the old `cardArt.ts` comments). Also documents where the new asset's own naming diverges from the in-game display text (`TARGET_SKIP` card art now says "TIMEOUT", UI still says "TARGET"; `DISCARD_ONE_EXTRA` art says "ONE MORE", UI still says "DITCH") — **deliberately not changed**, since renaming in-game display text is a UX/copy decision outside this phase's "assets + mapping only" scope, not an asset-mapping question.

## 4. Asset mapping

- `docs/cards/CARD_ASSET_MAPPING.md` (new) — full lookup table + the two example lookups from the brief, verified against the actual code.
- **Code mapping**: `src/components/Card/cardArt.ts` — completely rewritten. `getCardArt(color, type)` now returns `{ url, displayName, subtitle }` where `url` points directly at the final PNG (or, for the two gaps above, the flagged temporary legacy path). No more SVG resolution, no more `resolveUrl(file, format)` indirection — the old system needed that to pick between an SVG master and a PNG fallback; the new art has no SVG counterpart at all, so that whole layer was removed rather than kept as dead code.

## 5. Old assets removed from active use

- `src/components/Card/Card.tsx` — rewritten to render a plain `<img>` everywhere instead of the old `<picture><source type="image/svg+xml">...<img>...</picture>` pair (there is no SVG to prefer anymore). Structure otherwise preserved exactly (same three render paths: face-down, display-only, interactive button) — one real bug caught and fixed during this rewrite: an early draft merged the outer sizing classes (`.uno-card`, `.uno-card--normal` etc.) and the inner `.uno-card__art` (width:100%/height:100%) onto a single `<img>` element, which would have made every non-interactive card (the discard pile's hero card, all face-down backs) stretch to its container's full width instead of its intended fixed size — caught before shipping by re-reading `Card.css`'s cascade, fixed by keeping a wrapper element for those two cases (matching the original two-level structure, just without the now-pointless `<picture>` in the middle).
- `src/components/Card/Card.css` — removed the now-dead `.card-picture { display: contents; }` rule (was only ever needed for the removed `<picture>` wrapper).
- **File moves** (not deletions, per "falls Löschen riskant ist: in einen deprecated-Ordner verschieben"):
  - `public/assets/cards/svg/` (80 files) → `public/assets/cards/deprecated/svg/`
  - `public/assets/cards/archive/` (68 files, the old "v1" design) → `public/assets/cards/deprecated/archive/`
  - `public/assets/cards/png/` (80 files) — **left in place**, since 6 of its files are the temporary DRAW_1/WILD_DRAW_4 fallback (§2). Not moved to avoid breaking those two card types; move the whole folder to `deprecated/` once real art for both arrives and the two `legacy*()` helpers in `cardArt.ts` are deleted.
  - `public/assets/cards/overview/` — a 2-file design-reference image, not used by any code (`grep` for "overview" in `src/` found no matches); left untouched, out of scope.

Confirmed via `grep -r "cards/svg\|cards/archive\|gdy_" src/` that the **only** remaining references anywhere in the app are the two explicitly-flagged temporary fallback lines in `cardArt.ts` — nothing else in the running app points at anything outside `final/png/`.

## 6. Validation

- ✅ Every CORE variant (25/25) has a PNG — verified by an updated automated test (`tests/cardAssets.test.ts`), not just visual spot-checks.
- ✅ Every ACTION variant (40/40) has a PNG — same test.
- ✅ Every CHAOS card (8/8) has a PNG — same test.
- ✅ Backcover present — same test.
- ⚠ `DRAW_1`/`WILD_DRAW_4` render via the flagged temporary legacy path (§2) — not broken, but not final art either.
- ✅ No broken image paths — confirmed both by the automated `existsSync` test (checks every color × every `CardType`, including the two legacy-path exceptions) and live in the browser (`/dev/action-preview`, `/dev/mobile-preview` — screenshots below show real rendered cards, no missing-image icons).
- ✅ No old graphic renders anywhere except the two documented, deliberate, temporary exceptions.

Live-verified in the browser (not just the test suite): CORE (triangle/square/circle hand cards), ACTION (`TARGET_SKIP` → "TIMEOUT" art, confirming the asset swap took effect), and CHAOS (`ROTATE_HANDS` → new chaos-branded card with the swirl icon) all render the new final art correctly, on both the discard pile and in-hand.

## 7. Regression

```
npx tsc -b        → clean
npx vitest run    → 221/221 passed (21 files) — tests/cardAssets.test.ts rewritten
                     for the new asset system (old test asserted SVG+PNG pairs
                     and old filenames, which no longer exist by design)
npm run lint      → same 3 pre-existing set-state-in-effect warnings, nothing new
npm run build     → succeeds; all 74 final PNGs confirmed present in dist/assets/cards/final/png/
```

## 8. Open problems / follow-ups

1. **`DRAW_1` and `WILD_DRAW_4` final art still needed** (§2) — you've confirmed you'll supply these; once they exist as `action_{color}_draw_1.png` (5 files) and `chaos_wild_draw_4.png` (1 file) in `final/png/`, delete the `legacyColored`/`legacyColorless` helpers and their two call sites in `cardArt.ts`, then move the now-fully-unused `public/assets/cards/png/` folder to `deprecated/` too.
2. **Deploy-size housekeeping (not urgent, not touched this phase)**: `public/` is copied verbatim into the production build, so `deprecated/` (148 files) and the still-mostly-unused `png/` folder (74 of its 80 files are now dead weight) will ship as unused bytes on the next real deploy. Fine for now since nothing is being deployed this phase — worth a dedicated cleanup pass before the next real release.
3. **In-game display-text vs. new asset-naming divergence** (§3) — `TARGET_SKIP`/`DISCARD_ONE_EXTRA` art now say "TIMEOUT"/"ONE MORE" while the UI still says "TARGET"/"DITCH". Flagged, not changed — a copy decision for you to make separately if you want the UI text to match the new art's own naming.

## 9. Follow-up: DRAW_1 / WILD_DRAW_4 gap closed, DRAW_2 / DRAW_4 redesigned

You supplied two archives (`DRAW_1_5_COLORS_PIXEL_MATCHED.zip`, `GO_DRAW_YOURSELF_4_CARDS_PNG.zip` — found in `C:\Users\sophie\OneDrive\Desktop\Ablage`, unzipped to inspect before touching anything) containing:

- **`DRAW_1`**: a complete, already pixel-matched 5-color set (`DRAW_1_RED/BLUE/GREEN/YELLOW/PURPLE.png`) — no image processing needed, just renamed straight to `action_{color}_draw_1.png`.
- **`WILD_DRAW_4`**: one colorless file — renamed straight to `chaos_wild_draw_4.png`.
- **`DRAW_2`** and **`DRAW_4`**: a genuine redesign (new icon/layout — stacked card-back icons instead of the old single-icon style), each delivered in **one color only** (gold for DRAW_2, violet for DRAW_4) — exactly the situation you described, confirmed by opening and comparing the files rather than assuming.

### How the other 4 colors were generated for DRAW_2/DRAW_4

Sampled the exact hue already used for each color elsewhere in the deck (from `action_{color}_skip.png`, a template known to be correct for all 5 colors): red=0°, blue=216°, green=144°, gold=48°, violet=270°. Measured the master's own hue (gold master ≈42°, violet master ≈261° — close to, not exactly, the deck's canonical value, likely just natural rendering variance), then:

1. **Canonicalized** the master by rotating it to the exact deck hue (gold: +6°, violet: +9°) — so the color you delivered now matches the rest of the deck's gold/violet exactly, not just approximately.
2. **Generated the other 4 colors** from that canonicalized version via the same technique — a pure HSV **Hue** rotation (Saturation/Value/Alpha untouched, implemented as a vectorized numpy transform for speed, verified pixel-correct against a slower per-pixel reference calculation during development). Since white text/icons and black borders have Saturation ≈ 0, hue rotation leaves them mathematically unchanged — only the colored gradient background/frame actually shifts, which is exactly why this produces a genuinely pixel-identical recolor (same shapes, same glow, same composition) rather than an approximation.

I opened every one of the 10 generated files (5×DRAW_2, 5×DRAW_4) plus the copied DRAW_1/WILD_DRAW_4 files and visually confirmed: text stays white, borders stay black, only the intended color region changes, no banding or artifacts, and each color matches its established deck-wide hue exactly. Also confirmed live in `/dev/action-preview?kind=DRAW_4` — the new gold DRAW 4 design renders correctly in the real Action Focus flow.

The pre-redesign `DRAW_2`/`DRAW_4` files (all 5 colors each) were backed up to `public/assets/cards/deprecated/final-draw-old/` before being overwritten, not deleted.

### Code change

`src/components/Card/cardArt.ts`: `DRAW_1` moved from the temporary `legacyColored()` fallback to the normal `action("draw_1", ...)` mapping; `WILD_DRAW_4` moved from `legacyColorless()` to `chaos("wild_draw_4", ...)`. The now-fully-unused `legacyColored`/`legacyColorless` helpers and `LEGACY_PNG_DIR`/`LEGACY_COLOR_SLUG` constants were deleted — there is no longer any code path in the app that points outside `/public/assets/cards/final/png/`. The now-fully-unused `public/assets/cards/png/` folder (only 6 of its 80 files were still referenced) was moved to `public/assets/cards/deprecated/png/`.

### Regression (re-run after this follow-up)

```
npx tsc -b        → clean
npx vitest run    → 221/221 passed (21 files) — tests/cardAssets.test.ts already covered
                     DRAW_1/WILD_DRAW_4 generically (no hardcoded exception),
                     so it now passes against the real final assets with no
                     test changes needed
npm run lint      → same 3 pre-existing warnings, nothing new
npm run build     → succeeds; all 80 final PNGs confirmed in dist/assets/cards/final/png/
```

`docs/cards/CARD_LOGIC.md` and `docs/cards/CARD_ASSET_MAPPING.md` updated to remove the ⚠ gap markers and document the resolution.

## Final status

**CARD ASSET UPDATE: PASS — no open gaps.** Every `CardType` now has a real final asset; no card in the app renders anything outside `/public/assets/cards/final/png/`; all old assets (including the now-fully-superseded legacy `png/` folder) live under `deprecated/`.

Kein Commit, kein Push, kein Deploy.
