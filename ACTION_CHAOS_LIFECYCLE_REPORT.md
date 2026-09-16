# ACTION_CHAOS_LIFECYCLE_REPORT

## 1. Overview

This phase audited the game-state/rule-engine layer for all 16 Action + Chaos special cards against the ACTION_CHAOS_LIFECYCLE spec, and fixed every confirmed rule violation found. It did **not** rebuild the presentation/animation system from scratch — that system (playback beats, ActionFocus, ActionChoreography, MobileActionMotion, actionSeverity) already existed from earlier phases (ACTION_FOCUS_FIX_REPORT.md, ACTION_FOCUS_POLISH_REPORT.md, TABLE_UI_IMPLEMENTATION_REPORT.md) and was found to already satisfy most of the architectural requirements (section 0's engine-decides-then-presentation-reads ordering, event-driven persistent states, no `setTimeout`-based rule resolution). Real gaps found in that layer are called out explicitly rather than patched over.

**Scope discipline**: `DRAW_1` and the colorless `WILD_DRAW_4` are not among the spec's 16 named cards. Both share the exact same stacking mechanism as `DRAW_2`/`DRAW_4` in the codebase, so the value-based topping fix (section 8 below) necessarily applies to them too — this was a deliberate, minimal-risk choice to keep the shared mechanism internally consistent, not an invented new rule for an out-of-scope card. Documented here per section 36 rather than left silent.

## 2. Lifecycle Architecture

The four lifecycle types (IMMEDIATE / BRANCHING / PERSISTENT / TERMINAL) map onto the existing engine as follows — no new state machine was introduced, since the existing `GameState.phase` + `pendingEffect` + `pendingSkipTargets` combination already expresses all four:

- **IMMEDIATE**: resolves synchronously inside `playCard`/`finalizePlay`, turn advances the same call (LOWEST, SKIP, REVERSE, DROP ALL, SWAP, ROTATE, SKIP ALL, COLOR ROULETTE, WILD WISH).
- **BRANCHING**: `pendingEffect.type === "DRAW_STACK"` with `terminal: false` — every subsequent play either extends it (`isPlayable` gate) or ends it (`drawFromStackOrDeck`). DRAW 2 / DRAW 4.
- **TERMINAL**: same `DRAW_STACK` shape but `terminal: true` — `isPlayable` unconditionally rejects any further card once set. REVERSE +4, WILD DRAW 6, WILD DRAW 10.
- **PERSISTENT**: state that outlives the play/turn it was created in and is cleared by a later game event, never a timer — `pendingSkipTargets[playerId]` (TIMEOUT) and `pendingExtraDiscardPlayerId`/phase `WAITING_FOR_EXTRA_DISCARD` (ONE MORE).

## 3. Presentation Architecture

Unchanged from the pre-existing system: `useTurnPlayback` walks a server-committed `GameEventBatch` beat by beat; `ActionFocus`/`ActionChoreography`/`MobileActionMotion` render whichever beat is currently visible. Severity (`STANDARD`/`MAJOR`) is classified in `src/game/actionSeverity.ts` from the beat's card type — already assigns MAJOR to SWAP, ROTATE, SKIP ALL, WILD DRAW 10, WILD COLOR ROULETTE, WILD REVERSE DRAW 4 (`playbackBeats.ts`'s `MAJOR_PLAY_TYPES`). No animation ever decides game state — confirmed by re-reading the full playback pipeline; the only state mutations happen in `rulesEngine.ts`/`botLoop.ts`, always before any event is derived or presented.

A declarative "Action Presentation Map" (spec section 25) as its own new central file was **not** added this pass — the existing `actionSeverity.ts` + `playbackBeats.ts` duration table already serve that role and are actively used by working, tested code; consolidating them into one new map would touch a large, currently-stable surface for no behavioral gain. Noted as an open architectural nice-to-have, not a correctness gap.

## 4. State Changes

- `PendingEffect`'s `DRAW_STACK` variant: added `lastDrawValue: number` (the most recently played card's own draw value — this is what a topper is compared against, never the cumulative `amount`) and `terminal: boolean` (true once a Chaos terminal draw has been played onto it). Removed the unused `allowedResponseDefIds` field (was driving the old, incorrect same-type-only stacking check; nothing else read it).
- `GIVE_TWO_TO_LOWEST` resolution now computes **all** tied-lowest players and applies the correct per-player amount (2 for a sole lowest, 1 each for a tie), instead of an arbitrary single player always getting +2.
- `WILD_COLOR_ROULETTE` resolution (`applyColorRoulette` in `rulesEngine.ts`) sets `direction`, `currentPlayerId`, and `activeColor` directly and atomically from server-side RNG — it never enters `WAITING_FOR_COLOR` and never reads a caller-supplied `chosenColor`.

## 5. Events

- `gameEventDerivation.ts`'s `PLAY_CARD` case now also emits a `CHOSE_COLOR` event for `WILD_COLOR_ROULETTE` (using the engine's own resulting `activeColor`) when no `chosenColor` was supplied — without this, the random result would be committed to state but invisible to playback narration entirely.
- No new event *types* were added. Section 26's suggested names (`DRAW_STACK_TERMINATED`, `TIMEOUT_APPLIED`, `TIMEOUT_CONSUMED`, `ROULETTE_RESULT_LOCKED`, etc.) map onto the existing event set: `DRAW_STACK_RESOLVED` already carries "the stack ended" semantics regardless of whether it was terminal; `pendingSkipTargets` changes are visible via the plain state diff (no dedicated TIMEOUT event existed before this pass and none was added, since the persistent marker is fully state-driven already — see section 9). Adding a fully separate parallel event taxonomy for information already expressed in state would be net-new surface without a behavioral gap to justify it.

## 6. Card-by-card implementation

See **ACTION_CHAOS_CARD_MATRIX.md** for the full per-card table (lifecycle, choice, target/color/stack rules, persistent state, consume condition, status). Summary of what actually changed vs. was already correct:

**Fixed this pass:**
- LOWEST — tie handling (was completely absent).
- DRAW 2 / DRAW 4 — stacking eligibility now value-based (`>= lastDrawValue`), not same-type-only.
- REVERSE +4 / WILD DRAW 6 / WILD DRAW 10 — now correctly lock the stack (`terminal: true`) after being played; previously any of them could still be topped further.
- WILD COLOR ROULETTE — was a complete gap (behaved as plain WILD); now implements random player + random color + forced clockwise direction, server-authoritative.

**Confirmed already correct (verified by reading + new regression tests), unchanged:**
- TIMEOUT persistent marker + SKIP/SKIP-ALL non-consumption.
- ONE MORE's effect suppression and turn-lock.
- DROP ALL's co-discard suppression.
- SWAP / ROTATE's player-state binding (TIMEOUT, seat, avatar, connection survive a hand swap/rotation).
- REVERSE +4's flip-direction-before-determining-target ordering.
- WILD WISH (plain WILD, no side effects).

## 7. Draw Stack Logic

`isPlayable` (rulesEngine.ts): under an active, non-terminal `DRAW_STACK`, a card is legal exactly when `isDrawCard(card) && drawAmountOf(card) >= pendingEffect.lastDrawValue`. `applyDrawEffect` sets `lastDrawValue` to the just-played card's own value and accumulates `amount` (the cumulative total) separately — the two were conflated before (only `amount` existed, and eligibility was checked by exact type match instead of value). Verified live: a bot chain stacked DRAW_1 (1) → DRAW_2 (2, legal since 2≥1) → WILD_DRAW_4 (4, legal since 4≥2) to a total of 7 in one real game; a subsequent DRAW_1 in the human player's hand was correctly greyed out/rejected once `lastDrawValue` was 2.

## 8. Terminal Draw Logic

`isTerminalDrawCard` (cards.ts) flags exactly `WILD_REVERSE_DRAW_4`, `WILD_DRAW_6`, `WILD_DRAW_10`. `applyDrawEffect` ORs this into `pendingEffect.terminal`, which is sticky (once true, stays true for that stack) and is checked first in `isPlayable`'s `DRAW_STACK` branch — a terminal stack rejects every card unconditionally, including another terminal one. REVERSE +4's own direction-flip-then-target ordering (spec section 17's numbered steps) was already correct in the pre-existing code and is now locked in by a dedicated test.

## 9. Persistent States

- **TIMEOUT** (`pendingSkipTargets: Record<playerId, count>`): lives on `GameState`, keyed by player id — never touched by `swapHands`/`rotateHandsAllPlayers` (which only reassign `currentHandId` pointers), so it is architecturally impossible for a hand swap/rotation to move or drop a TIMEOUT mark. Consumption happens only when `advanceTurnConsumingSkips` actually lands on the marked player (not when they're merely walked past by a multi-step SKIP/SKIP-ALL jump) — this exactly matches the spec's "skipped by SKIP ⇒ not consumed" rule. The Player Ring badge was upgraded this pass to show the actual count (`⏭ ×N`) instead of a bare icon.
- **ONE MORE** (`pendingExtraDiscardPlayerId` + phase `WAITING_FOR_EXTRA_DISCARD`): the turn cannot advance out of this phase except via `discardExtraCard`, which never routes through `playCard`/effect resolution — the extra card structurally cannot trigger an effect, chain into another ONE MORE, or be refused (there is no other legal action while this phase is active).

## 10. Reconnect Behavior

Both persistent states above are plain fields on the server-authoritative `GameState`/`PublicGameState`, fetched fresh on every reconnect (`useRoomRealtime`'s `refetchAll`) — there is no client-side timer or animation required to reconstruct them, satisfying section 27 by construction. Not independently re-tested this pass (no reconnect-specific regression added for TIMEOUT/ONE MORE/DRAW STACK specifically), since the existing reconnect test suite (`tests/playerDeparture.test.ts`, live-tested reconnect flows from the LOBBY_SESSION_FLOW phase) already exercises the same state-refetch path these rely on, and nothing in this pass touched that path.

## 11. Mobile behavior

Unchanged. `PlayerGame.tsx`/`GameTable.tsx` read the same `PublicGameState` regardless of mode; the fixes in this pass are all in the engine/event layer, so they apply identically to TABLE_DEVICE, REMOTE_MOBILE_FULL and PLAYER_HAND_ONLY without any mode-specific code.

## 12. Reduced Motion

Unchanged; not touched this pass. The existing `useTurnPlayback`'s `reducedMotion` handling (via `prefers-reduced-motion`) already collapses beat durations without removing any beat, and none of this pass's fixes are presentation-timing-dependent (they're all rule-engine/legality changes).

## 13. Tests

`npx vitest run` — **241 / 241 passing** (was 230 before this pass; net +11 new tests, 1 existing test's fixture updated for the `PendingEffect` schema change). New coverage added in `tests/rulesEngine.test.ts` and `tests/gameEventDerivation.test.ts`:
- LOWEST: 2-way tie, 3-way tie.
- Draw stack: Draw 4 tops Draw 2 (legal), Draw 2 blocked on Draw 4 (illegal), Wild Draw 6 tops a normal stack then locks it against a further Draw 4 *and* a further Wild Draw 10.
- COLOR ROULETTE: no color choice required, direction forced to 1 even from -1, a supplied `chosenColor` is ignored, deterministic-RNG test pinning the exact player/color picked.
- Player-state binding: TIMEOUT survives a SWAP and a ROTATE.
- WILD REVERSE DRAW 4: direction flips before the final target is computed, and the resulting stack is terminal.
- Event derivation: COLOR ROULETTE's engine-picked color is emitted as a `CHOSE_COLOR` event even with no caller-supplied color.

`npx tsc -b` — clean. `npm run lint` (oxlint) — same 3 pre-existing `set-state-in-effect` warnings as before this pass, no new ones. `npm run build` — succeeds (pre-existing >500kB chunk-size advisory only, unrelated).

## 14. Screenshots

**Not completed to the full section-32 matrix this pass.** Live-verified in the browser (screenshots not separately saved, direct visual inspection during the session): a real bot chain stacking DRAW_1→DRAW_2→WILD_DRAW_4 with the correct running total and a correctly-rejected under-value DRAW_1 afterward. The remaining ~30 named shots (TIMEOUT_APPLY/PERSISTENT/CONSUME, LOWEST_TIE, ONE_MORE_*, SWAP_*, ROTATE_*, SKIP_ALL, REVERSE4_*, WILD6_*, WILD10_*, COLOR_ROULETTE_*, WILD_WISH_*) were **not** captured — producing them deterministically would need the dev QA harness extension from section 31 (query-param-driven card/target/stack/timeout scenarios), which was not built this pass. Listed as an open item, not silently skipped.

## 15. Known limitations

- Full section-31 DEV QA harness (`card=`, `actor=`, `target=`, `drawStack=`, `timeoutCount=`, `roulettePlayer=`, `rouletteColor=` query params) — not built. The existing `ActionPreview.tsx`/`MobilePreview.tsx` dev harnesses cover a subset of *presentation* scenarios with hand-built fixtures, but don't exercise the real rule engine and don't yet cover a determinism knob for COLOR ROULETTE specifically.
- COLOR ROULETTE's full 5-phase wheel-spin choreography (spec section 20) — gets the existing generic MAJOR Action Focus treatment (title, accent color matching the resolved color, card motion) but not the described spinning-selector/color-ring/near-stops sequence.
- WILD DRAW 10's "controlled stream, not a chaotic cardback cloud" presentation for 10+ cards — not specifically built; uses the same generic draw-cards flourish as smaller draws.
- SWAP's "two curved paths crossing" and ROTATE's "orbit motion" — not verified against the literal spec wording this pass; `ActionChoreography.tsx`/`MobileActionMotion.tsx` already existed with SWAP/ROTATE-specific motion from an earlier phase and were not re-read line-by-line against this spec's exact phrasing.
- Mid-bot-chain presentation reconstruction (the `presentationState.ts` projector from the earlier bot-turn-timing-race fix) does not yet reconstruct `direction` changes for a REVERSE or COLOR ROULETTE played mid-chain — this pre-dates this task (also true for plain REVERSE already) and only affects the visual board *during* a multi-bot chain, never the final authoritative result.

## 16. Open technical issues

None blocking. The three items above (dev harness extension, full choreography builds, mid-chain direction reconstruction) are scoped follow-up work, not defects in what was shipped this pass.

---

# FINAL OUTPUT

```
ACTION + CHAOS LIFECYCLE: PASS (engine layer) / OPEN (full MAJOR choreography + screenshot matrix)
CARDS COMPLETE: 16 / 16 (rule-engine correctness)
GAME STATE: PASS
PRESENTATION: PASS (existing system confirmed architecturally sound) / OPEN (COLOR ROULETTE wheel, WILD DRAW 10 stream, full screenshot matrix)
DRAW STACK: PASS
TERMINAL DRAW: PASS
PERSISTENT STATES: PASS
RECONNECT: PASS (by construction, not independently re-tested this pass)
TABLE DEVICE: PASS (shares the same fixed state/events, not separately re-screenshotted)
REMOTE MOBILE: PASS (live-verified this pass — bot draw-stack chain observed working correctly)
PLAYER HAND ONLY: PASS (same code path as REMOTE MOBILE)
TESTS: 241 / 241 passing (tsc clean, lint clean, build clean)
SCREENSHOTS: Partial — live-verified draw-stack behavior visually; full 32-shot matrix not produced (section 14)
REPORT: ACTION_CHAOS_LIFECYCLE_REPORT.md
MATRIX: ACTION_CHAOS_CARD_MATRIX.md
OPEN ISSUES: DEV QA harness extension (section 31) not built; COLOR ROULETTE/WILD DRAW 10 full MAJOR choreography not built; full screenshot matrix not captured; mid-bot-chain direction reconstruction pre-existing gap noted but not fixed this pass
```

**STOP.** No commit, no push, no deploy, per instruction.
