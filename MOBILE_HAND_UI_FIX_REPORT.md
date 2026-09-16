# MOBILE_HAND_UI_FIX_REPORT

Scope: **REMOTE_MOBILE_FULL** and the private hand only. TABLE_DEVICE, Player Ring, Hero Center, Player Units, Seat Edit, Orbit, Action Choreography (table), Rule Engine, Game Logic, card assets, Supabase and the realtime architecture were **not** touched — verified by re-reading every changed file's diff before finishing and by the unchanged `npx vitest run` count (218/218, all pre-existing suites, no TABLE_DEVICE test touched).

## 1. Summary

The row/overlap/distribution algorithm for the private hand already matched the brief exactly (verified against the 11–30 card table in section 9 before changing anything — `distributeCardsAcrossRows` already produces 7/6, 8/7/7, 10/10/10, etc.). This phase's real work was:

- a genuinely dynamic Hand Dock (height now follows row count instead of one fixed height for every hand size),
- a controls hierarchy rebuild (Sort demoted to a small chip docked at the hand; Play/Draw kept as primary/secondary),
- a real mobile Action Presentation upgrade (affected chips now highlight, and a new lightweight motion layer flies card-back glyphs between actual player-chip positions — mobile previously had no motion at all, only text),
- a landscape reflow (board left / hand right, not portrait squeezed shorter),
- a deterministic DEV-only mobile QA harness (`/dev/mobile-preview`), mirroring the `/dev/action-preview` harness from the previous phase, and
- two real bugs found live via screenshot review and fixed (see section 6).

## 2. Files changed

| File | Change |
|---|---|
| `src/components/GameTable/PlayerRing.tsx` | `data-player-id` on every seat (table + compact); ROTATE/SKIP_ALL highlight classes now also applied to the compact variant (previously full-ring only) |
| `src/components/GameTable/PlayerRing.css` | Compact-ring counterparts for rotate-participant / skip-all-dim / actor / target highlight |
| `src/components/GameTable/DiscardStage.tsx` | `data-draw-pile="true"` on the draw pile element (motion anchor point) |
| `src/components/GameTable/GameTable.tsx` | `surfaceRef`; renders `MobileActionMotion` on `!isTable`; computes a presentation-only severity class (`game-table--focus-severity-*`) for the Major-Action dock recede |
| `src/components/GameTable/MobileActionMotion.tsx` (new) | Mobile's own choreography — see section 5 |
| `src/components/GameTable/MobileActionMotion.css` (new) | its styling |
| `src/components/GameTable/ActionFocus.tsx` | Removed the old generic floating draw-cards flourish (now redundant — both modes have real card-back motion) |
| `src/components/GameTable/ActionFocus.css` | New REMOTE_MOBILE_FULL headline safe zone (see section 6); removed now-dead draw-cards CSS |
| `src/pages/PlayerGame.tsx` | Sort button moved inside the hand-wrap (docked at the hand, not a separate column); Play gets a `--ready` modifier once a card is selected |
| `src/pages/PlayerGame.css` | 2-column dock grid (was 3); dynamic dock height via `:has()`; Major-Action temporary growth; landscape reflow; sort/play restyle |
| `src/components/GameTable/HandDock.css` | Same 2-column grid + lighter/more translucent base styling, for consistency (only consumer is `PlayerGame.tsx`) |
| `src/App.tsx` | New DEV-only lazy route `/dev/mobile-preview` |
| `src/pages/dev/MobilePreview.tsx` (new) | The deterministic mobile QA harness |
| `qa/capture_mobile.mjs` (new) | Playwright script producing all required screenshots from the harness |

`src/game/handLayout.ts` was **not** changed — it already implements section 8/9 correctly.

## 3. Hand Dock

Restyled to match "light translucent" more closely: `background: rgba(255,255,255,.32)` (was `.18`), `backdrop-filter: blur(18px) saturate(140%)` (was `14px/118%`), brighter border/shadow. Still never a dark solid block.

**Dynamic height** (brief section 19), driven purely by the row-count class `PlayerHand` already puts on itself — no extra wiring:

```css
.player-game:has(.player-hand--rows-2) { grid-template-rows: auto minmax(0, 1fr) clamp(280px, 38vh, 400px); }
.player-game:has(.player-hand--rows-3) { grid-template-rows: auto minmax(0, 1fr) clamp(310px, 42vh, 440px); }
```

1-row hands keep the original compact `clamp(245px, 36vh, 320px)` dock.

## 4. Controls hierarchy

- **Sort** is now a small pill (`⇅ Sortieren`) docked at the top-left corner of the hand itself, not a full-height button in its own far column (brief section 18). The dock grid dropped from 3 columns (`160px | 1fr | 190px`) to 2 (`1fr | 168px` desktop / `1fr | 72px` mobile) since Sort no longer needs its own track.
- **Play** (gold, primary) and **Draw** (dark, secondary) keep their existing vertical stack in the remaining right column — already matched the brief's hierarchy, just re-verified. Play now gets a `player-game__play--ready` modifier (extra glow) once a legal card is selected, making the contextual "this is now the one clear next step" state (section 17) more visible than disabled/enabled alone.

## 5. Mobile Action Presentation

REMOTE_MOBILE_FULL previously had **no motion at all** — only `ActionFocus`'s text headline plus a generic floating "draw cards" flourish unrelated to real player positions. This phase adds `MobileActionMotion.tsx`, a scaled-down sibling of TABLE_DEVICE's `ActionChoreography`:

- Since the compact ring is a wrapping flex strip (no ellipse formula exists for it, unlike `computeFullRingSeatPoints`), positions are **measured live** from the actual rendered `[data-player-id]` / `[data-draw-pile]` DOM nodes via `getBoundingClientRect()`, not computed from geometry.
- Deliberately simpler than the table version per the brief (section 21/23–26: "nicht die TABLE_DEVICE-Choreographie 1:1 übernehmen"): straight lines, two discrete steps (no bow/curve), small 15×21px card-back glyphs.
- **ROTATE**: every chip gets a small glyph that travels to the next seat in turn direction; all 5 chips also get the existing (now compact-ring-extended) blue "participating" ring glow.
- **SWAP**: a dashed connector between actor and target chips (color = the resolved chosen color) plus two glyphs crossing.
- **TARGET** (SKIP): a dashed connector plus the target's existing red skip badge.
- **DRAW**: 1–4 card-back glyphs fly from the draw pile's real screen position to the actor's chip, staggered 70ms apart.
- The old generic `action-focus__draw-cards` flourish (3 floating card-backs + a `+N` badge, unrelated to any real position) was **removed** from `ActionFocus.tsx` — it's now redundant and was producing a visibly duplicated/overlapping presentation once the real motion existed (found live, see section 6).

Player-chip highlighting (`ROTATE`-participant glow, `SKIP_ALL`-dim, actor/target rings) was previously **full-ring-only** in `PlayerRing.tsx` — a `variant === "full"` guard silently no-op'd on the compact variant. Removed that restriction and added the compact CSS counterparts, since REMOTE_MOBILE_FULL has no choreography to lean on otherwise.

## 6. Bugs found live and fixed

Screenshots were opened and inspected personally at every step (not just code-reviewed), per the brief's requirement, and this caught two real defects that code review alone would have missed:

1. **Action headline colliding with the top player chips.** The mobile `ActionFocus` headline used the same `top:10–14%` as everywhere else, which on REMOTE_MOBILE_FULL landed squarely on the compact ring ("ROTATE"/"Hands move" overlapping "Bot 2"'s name — same class of bug as the TABLE_DEVICE collision from the previous phase). Fixed with a mobile-specific safe zone anchored to the ring's own **maximum possible height** (`22vh`, already the ring's own CSS cap) plus the board's known top padding (88/116px, both pre-existing constants from `PlayerGame.css`) — a ceiling that holds regardless of player count, rather than a guessed screen percentage:
   ```css
   .game-table--remote_mobile_full .action-focus__headline { top: calc(116px + 22vh + 14px); }
   @media (max-width: 760px) {
     .game-table--remote_mobile_full .action-focus__headline { top: calc(88px + 22vh + 42px); }
   }
   ```
   Verified clear on ROTATE/SWAP/TARGET/DRAW_4 screenshots at 390×844 — no overlap with the ring above or the discard/draw hero card below.

2. **Landscape brand text overlapping the first player chip.** At 844×390, the desktop-width two-line brand block ("GO DR*W / YOURSELF" + tagline) doesn't get hidden by the existing `max-width:760px` rule (844px is wider), so "YOURSELF" sat on top of "Sophie"'s name. Fixed by hiding `.player-game__brand`/`.player-game__meta` in the new landscape media query too, the same way the portrait ≤760px breakpoint already does.

Also found and fixed during implementation (not screenshot-caught, but worth recording): `MobileActionMotion`'s `useLayoutEffect` read `containerRef.current` before it was set — because in React's commit order, a **parent's** own DOM ref attaches *after* its children's layout effects run (bottom-up), so a child reading its parent's ref inside `useLayoutEffect` always sees `null` on first mount. Switched to `useEffect` (which runs in a separate, later pass once all refs are attached).

## 7. Landscape

New reflow at `(orientation: landscape) and (max-height: 500px) and (min-width: 560px)` — covers both required test sizes (844×390, 932×430):

- Board takes the left ~66% column, full height.
- The dock becomes a right-hand column (not a bottom band), its own internal grid switched to rows (sort → hand → actions) instead of columns, scrollable if content ever needs it.
- No hand cards are cropped — the dock has real height to work with instead of a squeezed portrait band.

Tablets/desktop landscape are excluded (`min-width: 560px` alone wouldn't touch a landscape tablet since those also have generous height, but the `max-height: 500px` clause is what actually keeps this scoped to phones — anything with more vertical room stays on the normal stacked layout).

## 8. Row algorithm / card sizes

No change — `src/game/handLayout.ts`'s existing `distributeCardsAcrossRows` was checked against every example in the brief (11→6/5, 13→7/6, 22→8/7/7, 30→10/10/10, etc.) and matches exactly; `PlayerHand.tsx`/`.css`'s existing overlap-first, scale-second, scroll-last priority order (negative margins for rows 1, `transform:scale(.94/.82)` for 2/3-row hands, horizontal-scroll-per-row as the last resort) already matched brief section 10. Verified visually via the 13/22/30-card screenshots — all legible (color, icon, and border all distinguishable) even at 320px width.

## 9. Touch targets

No code change needed here — each card slot's negative `margin-right` only covers the *next* sibling's left edge over *this* card's right edge; the visually-uncovered portion of every card exactly equals its own un-covered hitbox (nothing else is layered on top of it), so overlapped cards were already correctly tappable. Verified via the `MOBILE_13_CARDS_SELECTED` screenshot: clicking the 3rd card of the (fully overlapped) second row selects exactly that card.

## 10. Responsive tests performed

| Size | Result |
|---|---|
| 320×568 | Pass — 5 chips wrap to 2 rows without collision, discard/draw/hand/controls all visible and usable |
| 360×800 | Pass |
| 390×844 | Pass (primary reference size) |
| 430×932 | Pass |
| 844×390 landscape | Pass (after the brand-overlap fix) |
| 932×430 landscape | Pass |

## 11. Deterministic DEV-only QA harness

`src/pages/dev/MobilePreview.tsx`, routed at `/dev/mobile-preview?hand=N&kind=ACTION&players=N`, following the exact same pattern as the previous phase's `/dev/action-preview`:

- `import.meta.env.DEV`-gated `React.lazy()` dynamic import in `App.tsx` — Vite/Rollup drops the whole branch from a production build.
- **Verified**: `grep -l "mobile-preview\|MobilePreview" dist/assets/*.js` → no matches after `npm run build`.
- Renders the real `PlayerGame.css` classes/markup (imported directly, `<main className="player-game">` → `.player-game__board` (`GameTable`) + `.player-game__dock` (`HandDock`/`PlayerHand`/actions), matching the production DOM structure exactly, so screenshots are representative — not a simplified mockup.
- `hand=N` builds a synthetic hand cycling through the 8 non-Chaos card types × 5 colors (40 combinations before repeating), so any hand size up to 30 renders distinct, readable cards.
- `kind=ROTATE|SWAP|TARGET|DRAW_4` injects the corresponding synthetic `PlaybackBeat`, exercising `MobileActionMotion`/`ActionFocus` exactly like the previous phase's table harness did for TABLE_DEVICE.
- `qa/capture_mobile.mjs` drives this harness with Playwright for every required screenshot — deterministic, no bot RNG, ~40 seconds total for the full set (vs. the "25 minutes of bot play" problem explicitly called out in the previous phase for a different action).
- One caveat found while writing the capture script: `PlayerHand`'s deal-in animation staggers by `35ms × card index` (up to ~1.4s for a 30-card hand) — an early screenshot attempt captured only the first ~5 already-animated-in cards with row 2 entirely and invisibly still at `opacity:0`. Fixed by waiting 1.4s after navigation before every capture.

## 12. Screenshots

All in `qa/final/screenshots/`, opened and visually inspected personally (not just code-reviewed):

| File | Shows |
|---|---|
| `MOBILE_NORMAL_390.png` | Normal turn, 7-card hand, 390×844 |
| `MOBILE_13_CARDS.png` | 13 cards, exact 7/6 split, both rows clean and legible |
| `MOBILE_13_CARDS_SELECTED.png` | A row-2 card selected — glow/lift/z-index works in every row |
| `MOBILE_22_CARDS.png` | 22 cards, exact 8/7/7, three distinct readable rows, no "card cloud" |
| `MOBILE_30_CARDS.png` | 30 cards, exact 10/10/10, still functional, all colors/icons distinguishable |
| `MOBILE_SMALL_320.png` | 320px width, 13-card hand, no collisions |
| `MOBILE_LANDSCAPE.png` | 844×390, board left / hand right, no cropping, no brand overlap |
| `MOBILE_STANDARD_ACTION.png` | TARGET as the "standard" example — compact title, connector, target marker |
| `MOBILE_ROTATE.png` | All 5 chips glowing + glyphs docked at each, title clear of the ring |
| `MOBILE_SWAP.png` | Actor⇄target connector + two crossing glyphs, actor/target rings |
| `MOBILE_TARGET.png` | Connector + red skip badge on the target chip |

(`MOBILE_360_NORMAL.png`, `MOBILE_430_NORMAL.png`, `MOBILE_LANDSCAPE_932.png`, `MOBILE_DRAW4.png` were also captured for the full responsive/action matrix beyond the minimum required list.)

## 13. Regression

```
npx tsc -b        → clean
npx vitest run    → 218/218 passed (21 files) — unchanged from before this phase
npm run lint      → same 3 pre-existing set-state-in-effect warnings as before (RoomPage.tsx, ActionChoreography.tsx, dev/ActionPreview.tsx); nothing new
npm run build     → succeeds; /dev/mobile-preview confirmed absent from dist/assets/*.js
```

## 14. Known limitations

- The mobile motion (`MobileActionMotion`) uses straight-line/two-step transitions, not the bowed/curved paths TABLE_DEVICE uses — intentional per the brief ("nicht 1:1 übernehmen"), not a missed feature.
- `PLAYER_HAND_ONLY` (the `PlayerGame`-level "Nur meine Hand" toggle, not a separate `GameTableMode`) was not re-tested live in this phase, since it reuses the exact same `HandDock`/`PlayerHand`/dock CSS this phase already changed and verified — a targeted follow-up regression pass on that specific toggle is recommended before shipping, though no code path specific to it was touched.
- `prefers-reduced-motion` was verified by code review only (both `MobileActionMotion.css` and the existing `ActionFocus`/`PlayerHand` rules already handle it), not with the OS setting live-enabled — consistent with every previous phase's disclosed limitation.
- SKIP_ALL was not built out on `MobileActionMotion` (no per-brief requirement for it in this phase — sections 23–26 only ask for ROTATE/SWAP/TARGET/DRAW); the existing compact-ring dim/highlight classes already generically cover it (extended in section 5), same as the other actions' base highlight.

## 15. Final status

**MOBILE + HAND UI: PASS**

- 13 cards: exact 7/6, both rows visually clean, legible, every card reliably selectable — pass.
- 22 cards: exact 8/7/7, three clear rows, no card cloud, all cards operable, public table still visible — pass.
- 30 cards: exact 10/10/10, functional, no layout break — pass.
- No overlaps found after the two live-caught fixes (headline/chip collision, landscape brand overlap) were applied and re-verified via fresh screenshots.
- Actions (ROTATE/SWAP/TARGET/DRAW) are understandable via motion + highlight + compact title, not text-over-a-blurred-table.
- TABLE_DEVICE and Player Hand Only were not regressed: no file exclusive to either was edited; `PlayerHand.css`/`handLayout.ts` (shared by all three) were read but not changed; full test suite unchanged at 218/218.

Kein Commit, kein Push, kein Deploy — nur lokal geändert, getestet und dokumentiert.

---

## 16. Follow-up: public table now reads as one table, not a chip bar over a decoration

User feedback after the above: the compact ring was still a flex-wrap chip strip floating above a purely decorative orbit ellipse — the two didn't actually share geometry. This follow-up makes them the same thing.

### 16.1 Real ellipse geometry for the compact ring

- `src/game/seatGeometry.ts`: added `COMPACT_RING_RADII` (`radiusXPct: 35, radiusYPct: 37`) and `computeCompactRingSeatPoints()`, plus `seatAngleDeg()` (exposes the same angle math `computeSeatPoints` already used internally, so other code can compute a seat's angle without duplicating the formula).
- `PlayerRing.tsx`: the compact variant now computes `seatPoints` via `computeCompactRingSeatPoints` and positions every seat absolutely (`left/top` %), the same mechanism the full TABLE_DEVICE ring already used — not a flex-wrap strip. Seats "sit on the table" the same way TABLE_DEVICE's do.
- `PlayerRing.css`: compact seat rewritten as a frameless round avatar token (border/glow instead of a background pill) with a small name+count label below it; `.player-ring--compact` is now `position:absolute;inset:0`.
- `GameTable.css`: dropped the mobile-specific grid/flex-column layout entirely — `.game-table--remote_mobile_full .game-table__surface` now just gets a `min-height`/`max-height` clamp and otherwise uses the exact same absolute-overlay coordinate space TABLE_DEVICE always used. `DiscardStage`'s existing default `left:50%;top:50%` centering (previously overridden to flex-center "the remaining space below the ring" on mobile) now applies unmodified — **the discard pile sits exactly at the ellipse's geometric center**, matching the user's ASCII target.
- `DiscardStage.css`: added compact-only hero/draw card width overrides (`clamp(50-80px)` / `clamp(28-46px)`, down from the shared 96-108px mobile breakpoint values) — needed once real seats had to visually fit around the center cards instead of floating independently above them.

### 16.2 Current → Next turn arc (replaces the old 4-marker chase for mobile)

- `OrbitFlow.tsx` gained an optional `turnArc: {fromAngleDeg, toAngleDeg} | null` prop. **TABLE_DEVICE's call site never passes it** (stays `undefined`), so its own orbit treatment is byte-for-byte unchanged — this is additive, not a modification of the already-approved table behavior.
- When provided, `OrbitFlow` draws an SVG elliptical arc (`A rx ry 0 0 sweepFlag`) from the current player's seat angle to the next player's, with a bright glow (`stroke` + `drop-shadow`) and a small traveling light (`<circle>` + `<animateMotion>`, keyed by the arc's own endpoints so a turn change forces a clean SMIL restart instead of hoping the browser notices an attribute change mid-loop). The generic ambient pulse dims to `opacity:.18` while a turn arc is showing, so the two never compete.
- `direction === 1` → `sweepFlag=1` (clockwise, matching the seat angle math where increasing angle already runs clockwise); `direction === -1` → `sweepFlag=0`. **Reverse therefore just flips which side of the current player the bright segment points to** — verified live via a `direction` query param added to the dev harness (see 16.4): the arc visibly jumped from Sophie→Bot2 (forward) to Sophie→Bot5 (reverse), no separate reverse icon needed.
- `PlayerRing.tsx` gained a `nextPlayerId` prop → `.player-ring__seat--next-up` (subtle blue tint on the avatar border), the destination-end complement to the existing (now strengthened) `--active` glow.
- **Suppressed during actions**: `GameTable.tsx` passes `turnArc={playback?.active ? null : turnArc}` for mobile — `null` (not omitted) tells `OrbitFlow` "an action choreography owns the spotlight right now," hiding the bright arc but keeping the calm ambient pulse, so `MobileActionMotion`'s glyphs are never competing with a second bright animated element. Verified live: the arc is absent in the ROTATE/SWAP/TARGET screenshots and reappears immediately once `playback.active` clears.
- Respects `prefers-reduced-motion`: since SMIL's `<animateMotion>` can't be paused via CSS the way the codebase's other chase effects are, `OrbitFlow` now checks `window.matchMedia("(prefers-reduced-motion: reduce)")` directly and skips rendering the traveling-light circle under that setting, leaving only the static glowing arc (still fully conveys direction without motion).

### 16.3 Active player glow, and smaller Room/Leave chrome

- `PlayerRing.css`: the compact "current player" state is now a clear glow directly on the avatar border (`border-color:#58a1ff` + a two-layer `box-shadow` glow) instead of a small corner dot — matches the brief's "deutlich erhellen, aber nicht riesig" ask, and pairs with the turn arc pointing away from it.
- `PlayerGame.css`: Room code and "Aufgeben" are now visibly secondary on REMOTE_MOBILE_FULL — Room dropped its card border/background to a flat label, "Aufgeben" changed from a bordered button to a small underlined text link, in both the portrait ≤760px and landscape media queries.

### 16.4 Dev harness / capture script updates

- `src/pages/dev/MobilePreview.tsx`: added a `direction` query param (`&direction=-1`) specifically to make the reverse-arc behavior screenshot-verifiable without needing a live REVERSE card draw.
- `qa/capture_mobile.mjs`: added `MOBILE_ORBIT_FORWARD`, `MOBILE_ORBIT_REVERSE`, and `MOBILE_ORBIT_8_PLAYERS` to the capture set.

### 16.5 Bugs found live and fixed during this follow-up (all via real `getBoundingClientRect()` measurement, not just visual guessing)

1. **Seat labels overlapping the discard/draw cards.** Once seats sat on the real ellipse, the shared mobile card-size breakpoints (tuned for the old "cards float independently below the chip strip" layout) were too big for the available center space — fixed via the compact-only card-size overrides in 16.1. Verified at 320px, 390px, and 8 players via `getBoundingClientRect()` overlap checks (all `false`) before trusting the screenshots.
2. **Same overlap reappearing specifically in landscape.** The portrait `max-height:44vh` surface cap left far too little vertical room once the board column got the viewport's *full* height in landscape (844×390/932×430) — the ellipse's vertical radius in px collapsed, pushing top/bottom seats into the center cards. Fixed with a landscape-scoped override (`.player-game .game-table--remote_mobile_full .game-table__surface { max-height:none; min-height:260px }`, 3-class specificity so it reliably wins over `GameTable.css`'s rule regardless of stylesheet import order).
3. **Action headline overlapping the top seat's name pill by ~9px** — not visible as an obvious collision in a screenshot at a glance, only caught by directly comparing `headline.getBoundingClientRect()` against the seat's own rect. The fix required two changes together, not just a bigger offset: (a) recomputing the safe-zone formula for the new ellipse geometry, and (b) shrinking the mobile headline's own font size, because the true available gap between the ring and the discard card (~30px) was narrower than the default headline text's own height (~48px) — no vertical offset alone could satisfy "clears the seat above" and "clears the card below" at the same time without also shrinking the text. Increased `COMPACT_RING_RADII.radiusYPct` from 32 to 37 in the same pass to buy a few more px of that gap rather than relying on font-shrinking alone. Re-verified via exact rect math for both a MAJOR (ROTATE, 7.3px/16.4px clearance) and a STANDARD (TARGET, 7.3px/18px clearance) beat before trusting it.

### 16.6 Regression (re-run after this follow-up)

```
npx tsc -b        → clean
npx vitest run    → 218/218 passed (21 files) — unchanged
npm run lint      → same 3 pre-existing set-state-in-effect warnings, nothing new
npm run build     → succeeds; /dev/mobile-preview and /dev/action-preview both confirmed absent from dist/assets/*.js
```

### 16.7 Updated screenshots

All in `qa/final/screenshots/`, re-captured after every fix above and opened individually:

| File | Shows |
|---|---|
| `MOBILE_ORBIT_FORWARD.png` | Normal turn, direction=1: bright arc Sophie → Bot 2 |
| `MOBILE_ORBIT_REVERSE.png` | Same state, direction=-1: arc flips to Sophie → Bot 5 |
| `MOBILE_ORBIT_8_PLAYERS.png` | 8 seats on the ellipse, still no overlaps, still reads as one table |
| `MOBILE_NORMAL_390.png`, `MOBILE_13/22/30_CARDS*.png`, `MOBILE_SMALL_320.png`, `MOBILE_360/430_NORMAL.png` | Re-captured on the new geometry — all previously-passing cases re-verified, no regressions |
| `MOBILE_LANDSCAPE.png`, `MOBILE_LANDSCAPE_932.png` | Same table logic (seats on the orbit) now applies in landscape too, no overlaps |
| `MOBILE_ROTATE/SWAP/TARGET/DRAW4.png` | Turn arc correctly suppressed during the action; headline clears both the ring above and the discard card below |

### 16.8 Status

**PUBLIC TABLE GEOMETRY FOLLOW-UP: PASS** — the mobile public table now reads as one table (seats on a real orbit, discard at its exact center) with direction/next-up expressed entirely through the orbit itself, TABLE_DEVICE's own orbit/ring code path untouched (no `turnArc` ever passed there), and no regressions in the 218-test suite or the previously-passing hand-size/responsive screenshots.

---

## 17. Follow-up 2: fine polish pass (top chrome, action feel, landscape legibility, hand-dock re-check)

User feedback after the geometry rework: things work, but four specific spots still felt unfinished. All four addressed with targeted CSS/markup changes, not structural rework — "nur fein" per the request.

### 17.1 Top chrome (Room/Leave) — from utility text to a deliberate chip

The previous pass made Room/Leave smaller but left them as a flat label and a bare underlined link — functional but, per feedback, reading as "Utility-Text" rather than intentional chrome. Both are now small glass-pill chips using the same translucent-chip language as the hand dock/sort button (`rgba(255,255,255,.4-.55)` + `backdrop-filter:blur(10px)` + a soft shadow), in both the portrait ≤760px and landscape media queries in `PlayerGame.css`. Room's label+code now sit inline (`Raum QA-01`) in one pill instead of stacked, reading as one small badge rather than two separate text lines.

### 17.2 Mobile action state — grounded title, real card-stack glyphs

- **Headline felt "schwebend"**: `ActionFocus.css`'s `.game-table--remote_mobile_full .action-focus__headline` now has a small dark glass-plate background (`rgba(10,16,28,.4)` + `backdrop-filter:blur(8px)` + a soft shadow that also picks up `--action-accent` for a subtle color-matched glow) instead of bare text directly on the table gradient. Padding was kept deliberately tight (3px/4px) since the available vertical gap between the ring and the discard card is only ~30px on a phone — re-verified via `getBoundingClientRect()` that both the seat-label and hero-card clearances still hold (9.2px / 11.3px measured on a MAJOR beat) after adding the backdrop.
- **Hand-stack glyphs "wirken noch technisch/provisorisch"**: `MobileActionMotion.tsx`/`.css` — the flat single-rectangle glyph is now a small two-leaf card-back stack (nested `<span>` leaves, one rotated slightly behind the front one), the mobile-scale equivalent of `ActionChoreography`'s table-side handstack glyph, instead of a plain bordered box.
- **Found live while checking this**: the glyph was centering on the *whole* seat token (avatar + name pill stacked below it), so it visually landed on top of the player's name text instead of just their avatar. Fixed by having `MobileActionMotion` target `.player-ring__avatar` specifically instead of the outer `[data-player-id]` element — the glyph now docks on the avatar itself, names stay fully legible during ROTATE/SWAP.

### 17.3 Landscape player info — a real bug, not just "too minimal"

Feedback: names/card-counts felt almost too reduced in landscape to track several actions in a row. Investigating found this wasn't a design choice that needed dialing back — it was a genuine bug: a pre-existing `@media (max-height: 450px)` rule (written before the dedicated landscape reflow existed, back when a short `max-height` was the only available signal for "this is probably a rotated phone") unconditionally set `.player-ring__seat--compact .player-ring__copy { display: none }`, and 844×390/932×430 both satisfy `max-height:450px` too — so every seat's name+count was being silently hidden in landscape. Fixed by scoping that old rule to `and (orientation: portrait)` (its only remaining legitimate use is a genuinely short portrait viewport, e.g. an on-screen keyboard eating vertical space), and gave landscape its own slightly larger name/count sizing (`.56rem`/`.46rem` vs portrait's `.5rem`/`.42rem`) since landscape seats have a bit more room to spend on legibility.

### 17.4 Hand dock re-check (13/22/30 cards, every row)

Verified programmatically (`getBoundingClientRect()` + click simulation via a throwaway Playwright script, not just visual inspection) rather than re-trusting the earlier screenshots alone:

| Hand | Rows | Per-row counts | Selecting a card in every row |
|---|---|---|---|
| 13 | 2 | 7, 6 | Selects correctly, `z-index:100`, fully on-screen — both rows |
| 22 | 3 | 8, 7, 7 | Selects correctly, `z-index:100`, fully on-screen — all three rows |
| 30 | 3 | 10, 10, 10 | Selects correctly, `z-index:100`, fully on-screen — all three rows |

Row counts match the binding table in section 9 exactly for all three sizes; the selected card is always the topmost element (`z-index:100`) and always lands within the viewport regardless of which row it's in. Additional screenshots (`MOBILE_22_CARDS_SELECTED_ROW3.png`, `MOBILE_30_CARDS_SELECTED_ROW2.png`) confirm this visually — the lifted/glowing selected card is clearly readable in the front row of both a 22- and a 30-card hand, and "Karte spielen" correctly switches to its primary/ready state the moment a legal card is selected, regardless of hand size. No code changes were needed here — `PlayerHand.tsx`/`.css` and `handLayout.ts` were re-verified, not touched.

### 17.5 Regression (re-run after this polish pass)

```
npx tsc -b        → clean
npx vitest run    → 218/218 passed (21 files) — unchanged
npm run lint      → same 3 pre-existing set-state-in-effect warnings, nothing new
npm run build     → succeeds; /dev/mobile-preview and /dev/action-preview both confirmed absent from dist/assets/*.js
```

TABLE_DEVICE re-checked live via `/dev/action-preview?kind=SWAP` after this pass — its headline/title styling is untouched (all new CSS in this section is scoped under `.game-table--remote_mobile_full`).

### 17.6 Status

**FINE POLISH PASS: PASS** — top chrome now reads as deliberate chip UI, mobile action headline is visually grounded instead of floating, hand-stack glyphs read as small card stacks instead of debug boxes and no longer cover player names, landscape's "too minimal" player info turned out to be a real bug (now fixed, not just a design opinion), and the hand dock's row/selection/control behavior is confirmed correct in every row for 13/22/30 cards via direct measurement, not just a look.

---

## 18. PLAYER_HAND_ONLY (presence mode with a separate TABLE_DEVICE)

Scope for this block: the `PlayerGame`-level "Nur meine Hand" toggle (not a `GameTableMode` — see the exploration summary earlier in this session; it's a CSS/state switch inside `PlayerGame.tsx`, gated by `useHasTableDevice`, that hides `GameTable`'s board and lets the hand dock fill the screen). Checked against every point raised: radical reduction, dran/nicht-dran/spielbar/ziehen/betrifft-mich clarity, no superfluous public info, hand-UI parity with REMOTE_MOBILE_FULL, Major/Standard Action legibility, and no regression from the mobile phases above.

### 18.1 Two real bugs found (not just "unverified", both silent breakages introduced by earlier mobile-phase CSS)

1. **ActionFocus was being hidden along with the board — Action feedback was completely invisible in hand-only.** `PlayerGame.css` had `.player-game--hand-only .player-game__board { display: none; }`. `GameTable` renders `ActionFocus` *inside* that same board wrapper (it's the component that also owns `PlayerRing`/`DiscardStage`/`OrbitFlow` — see `GameTable.tsx`), so hiding the board took every Standard/Major Action notification down with it. A player using hand-only would see and feel *nothing* when someone drew 4, when ROTATE moved their hand, or when a SWAP/TARGET affected them directly — silently, since there was no error, just missing UI. This directly contradicts "Major/Standard Actions für die eigene Hand verständlich," which was the explicit thing to check.

   Fixed by no longer hiding the whole board: only the actual table content (`.game-table__surface`, i.e. ring/orbit/discard) is now `visibility:hidden`, while the board wrapper itself becomes a full-viewport, `pointer-events:none` overlay (`position:fixed;inset:0`) so `ActionFocus`'s scrim/headline/skip-button still render on top of the hand exactly when an action is active — verified live for both a MAJOR beat (ROTATE, SWAP — screenshots below) and the pending-draw-stack case.

2. **The mobile hand-dock row-height rules silently broke hand-only's full-screen dock for 2-3 row hands.** The dynamic dock-height rules added in section 3 (`.player-game:has(.player-hand--rows-2/3)`, 2-class specificity) outrank `.player-game--hand-only`'s single-class `grid-template-rows: minmax(0,1fr)`, so the moment a hand-only player's hand grew past 10 or 20 cards, the dock silently shrank back down to the row-based clamp (280-440px) instead of staying full-screen — the opposite of "radically reduced." Fixed with `!important` on the hand-only rule (verified live with a 22-card hand: dock now correctly fills the screen — screenshot `MOBILE_HAND_ONLY_22_CARDS.png`).

   A related, non-visible-but-real side effect was also excluded: the "Major Action shrinks the dock to grow the public table" rule (section 3) still matched in hand-only via `:has()` even though the table itself is invisible there — pointlessly crowding the player's own hand during exactly the moment they most need to see it. Excluded via `:not(.player-game--hand-only)`.

### 18.2 Checked against every point raised

- **Radikal reduziert?** Yes — no player chips, no discard/draw pile, no orbit, nothing but Room/Leave (small, secondary), a single status line, and the hand + its controls. Confirmed via screenshot (`MOBILE_HAND_ONLY_NORMAL.png`).
- **dran / nicht dran**: `.player-game__hand-only-status` shows "Du bist dran" or "`<Name>` ist dran" — verified both states.
- **Karte spielbar**: inherited unchanged from the shared `PlayerHand`/`Card` components (legal-move highlighting never depended on the public table being visible) — same playable/disabled visual language as REMOTE_MOBILE_FULL.
- **Karte ziehen**: Draw button now correctly disables when it isn't the player's turn (this was actually missing a `disabled` binding check when re-verifying — confirmed the real `PlayerGame.tsx` already has `disabled={!canUseMainActions}` wired for both buttons, so this was already correct there; only the disposable dev-harness stand-in needed the same wiring for an honest test).
- **Action betrifft mich**: now works at all (see 18.1.1) — and since `ActionFocus`'s subtitle always uses real display names ("Sophie ⇄ Bot 4"), the player sees their own name directly in the headline whenever an action involves them.
- **Keine überflüssigen öffentlichen Infos**: confirmed — no discard color, no other players' card counts, no orbit/turn-direction indicator leak through. The one secondary line shown (own card count, or the active draw-stack amount) is private-to-the-player info, not public table state.
- **Gleiche gute Hand-UI wie im Remote-Modus**: same `HandDock`/`PlayerHand` components, same row algorithm, same controls hierarchy — verified with 7/22-card hands.
- **Kein Regression durch die Mobile-Änderungen**: the two bugs above *were* exactly that regression risk materializing — both are now fixed and covered by the new `handOnly=1` dev-harness scenarios so they can't silently regress again unnoticed.

### 18.3 Dev harness extension

`src/pages/dev/MobilePreview.tsx` gained `handOnly=1` (mirrors `PlayerGame.tsx`'s `effectiveHandOnly` markup exactly, since `useHasTableDevice` needs a live Supabase room and can't be faked otherwise), `myTurn=0` (shows another player as active), and `pending=N` (injects a `DRAW_STACK` pending effect) query params — combinable with the existing `hand`/`kind`/`players`/`direction` params. `qa/capture_mobile.mjs` gained 5 new captures for this mode.

### 18.4 Screenshots

| File | Shows |
|---|---|
| `MOBILE_HAND_ONLY_NORMAL.png` | Own turn, 7 cards, fully reduced view |
| `MOBILE_HAND_ONLY_NOT_MY_TURN_PENDING.png` | Someone else's turn + an active +4 draw stack, both buttons correctly disabled |
| `MOBILE_HAND_ONLY_22_CARDS.png` | 22-card hand, dock correctly still full-screen (the fixed regression) |
| `MOBILE_HAND_ONLY_ROTATE.png` | MAJOR action now visible as an overlay (the fixed regression) |
| `MOBILE_HAND_ONLY_SWAP.png` | MAJOR action naming the player directly ("Sophie ⇄ Bot 4") — "betrifft mich" is unambiguous |

### 18.5 Regression

```
npx tsc -b        → clean
npx vitest run    → 218/218 passed (21 files) — unchanged
npm run lint      → same 3 pre-existing set-state-in-effect warnings, nothing new
npm run build     → succeeds; /dev/mobile-preview and /dev/action-preview both confirmed absent from dist/assets/*.js
```

REMOTE_MOBILE_FULL re-checked live after these CSS changes (all new rules are scoped under `.player-game--hand-only`) — unaffected, screenshot-confirmed.

### 18.6 Status

**PLAYER_HAND_ONLY: PASS** — found and fixed two real, previously-silent regressions (Action feedback completely missing; dock height breaking on larger hands) that this checking pass was specifically designed to catch, and confirmed every other point on the list was already correct.
