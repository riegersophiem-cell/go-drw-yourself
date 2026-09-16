# LOBBY_SESSION_FLOW_REPORT

Scope: everything **before and up to game start** — Lobby, Room Create/Join, Device Roles (TABLE_DEVICE / PLAYER / SPECTATOR), Bots, Seat Order persistence, Start logic, Reconnect, and the routing that follows Start. Per the brief, **not** touched: TABLE_DEVICE/Hero Center/Player Ring/Mobile Hand/Action Focus visual design, card assets, the rule engine, or card effects (LOWEST tie rule, SHOVE, final card counts — all untouched, confirmed by diff).

## 1. Ist-Analyse (audited before any change)

The pre-game flow was audited in full before any fix (session/device model, API layer, realtime hooks, Supabase schema, all 5 relevant Edge Functions, error handling, existing E2E/dev-harness state) before any code was touched. Key findings from that pass, in the order this report addresses them:

1. **Device/Player/Hand separation is already clean.** `devices` (identity + role) and `players` (game seat + hand ownership) are separate tables; a TABLE/SPECTATOR device's `devices.player_id` is `null`, and `get_private_state` explicitly rejects such a device with `DEVICE_HAS_NO_PLAYER`. Bots are pure `players` rows with **no `devices` row at all** — confirmed by reading `add-bot`/`remove-bot` in full. Nothing in this phase needed to change here; it was already correct.
2. **Mode selection is already NOT screen-size-based.** `PlayerGame.tsx`'s `effectiveHandOnly = handOnly && hasTableDevice` — a player only gets `PLAYER_HAND_ONLY` if a table device is actually connected *and* they've chosen it via the "Nur meine Hand" toggle. Verified live (see §9) — this was already correct architecture from an earlier phase, not something this phase had to build.
3. **Reconnect is already identity-based, never name-based.** `deviceId` + `sessionToken` (hashed server-side), matched via `authenticateDevice`. No `findPlayerByName()`-style code exists anywhere.
4. **Two real, previously-unknown bugs were found** (not just "unverified" — actually broken): the `reconnect` Edge Function's raw error passthrough (§5), and `devices` missing from the realtime publication (§4, the more significant one — see MIGRATION REQUIRED). Both were caught by actually exercising the flows live against the dev Supabase project, not by reading code alone.
5. **No player cap ("Raum voll") existed anywhere.** Neither `join-room` nor `add-bot` enforced a maximum.
6. Table-device connection status was **not surfaced in the Lobby at all** — only in `PlayerGame` (in-game), so a host could press "Spiel starten" for a presence game with zero table devices connected and nobody was told.
7. A failed `reconnect()` left `RoomPage` on a **dead-end error screen** with no way back to `/join` or `/`.
8. `HOST_ADMIN` is confirmed dead code (DB check-constraint value + client type only, no Edge Function ever produces it) — left as-is, out of scope to remove.
9. No presence/heartbeat mechanism exists — `devices.connected` never flips false except via an explicit `leaveRoom`/`removePlayer` call. A closed tab (not "left") stays `connected:true` forever server-side. This is a structural gap, not a bug introduced or fixed here — documented as a known limitation (§13).

## 2. Files changed

| File | Change |
|---|---|
| `src/hooks/useIsRoomHost.ts` | Now returns `{ isHost, hostDeviceId }` instead of a bare boolean, so a player list can mark *which* row is host |
| `src/pages/PlayerGame.tsx` | Updated to destructure the new `useIsRoomHost` return shape |
| `src/multiplayer/api.ts` | `fetchPlayers` now also selects `device_id` |
| `src/hooks/useRoomRealtime.ts` | `RoomPlayerRow` gained `device_id` |
| `src/pages/Lobby.tsx` | HOST badge on the host's player row; new compact "Tischgerät" status block (own component, not a player-list row) wired to `useHasTableDevice`; "Bot hinzufügen" disabled + hint once the room hits `MAX_PLAYERS` |
| `src/pages/RoomPage.tsx` | A failed reconnect no longer dead-ends — shows the error plus a "Zur Startseite" button |
| `src/game/errors.ts` | Added friendly German messages for `UNKNOWN_DEVICE`, `INVALID_SESSION`, `ROOM_NOT_FOUND`, `ROOM_NOT_JOINABLE`, `ROOM_FULL` |
| `src/App.css` | New styles: `.lobby-player-list__badge(--host)`, `.lobby-table-device(...)` |
| `src/pages/dev/LobbyPreview.tsx` (new) | DEV-only Lobby QA harness |
| `src/App.tsx` | Registers `/dev/lobby-preview` (DEV-only, dead-code-eliminated) |
| `qa/capture_lobby.mjs` (new) | Screenshot capture — real end-to-end flows + dev harness |
| `supabase/functions/reconnect/index.ts` | **Prepared, not deployed** — propagates the real `UNKNOWN_DEVICE`/`INVALID_SESSION` code instead of wrapping every failure as opaque `SERVER_ERROR` |
| `supabase/functions/join-room/index.ts`, `add-bot/index.ts` | **Prepared, not deployed** — enforce `MAX_PLAYERS = 8` server-side (`ROOM_FULL`) |
| `supabase/migrations/0010_devices_realtime.sql` (new) | **NOT applied** — see MIGRATION REQUIRED below |

## 3. Device Role Model (confirmed, not changed)

```
DEVICE (devices table)         PLAYER (players table)          HAND (game_states, private)
  device_id                      player_id                       only reachable via
  role: PLAYER|TABLE|            display_name, avatar             get_private_state RPC,
        SPECTATOR|HOST_ADMIN     seat_index                       server-validated per device
  player_id (nullable)           player_type: HUMAN|BOT
  session_token_hash             device_id (nullable — null
                                  for bots, and for a player
                                  whose device departed mid-game)
```

- A **TABLE** device: `devices.player_id = null`, never appears as a `players` row, never has a hand. Confirmed structurally impossible to accidentally acquire one (`get_private_state` raises `DEVICE_HAS_NO_PLAYER`).
- A **bot**: `players` row with `player_type='BOT'`, `device_id = null` — never has a `devices` row, so it can never "reconnect as a device" by construction.
- A **PLAYER** device: `devices.player_id` set, one `players` row with `device_id` pointing back.

## 4. MIGRATION REQUIRED (not applied — needs your approval)

**`supabase/migrations/0010_devices_realtime.sql`** — `devices` was never added to the `supabase_realtime` publication (only `players`/`rooms` were, in migration 0003). Found live while testing the new Lobby table-device indicator: a table device joining an *already-open* Lobby tab never updated that tab's "Kein Tischgerät" → "Verbunden" status — the `postgres_changes` subscription in `useHasTableDevice` simply never fires for `devices` at all, regardless of what it's listening for.

**This is not new breakage from this phase.** `useHasTableDevice` has been used by `PlayerGame.tsx` since an earlier phase to show/hide the "Nur meine Hand" toggle — it has had the exact same silent non-reactivity there the whole time: a table device connecting or disconnecting *while* a player's game is already open never updates the toggle without a reload.

Workaround used for this report's screenshots and confirmed as the current real-world behavior: a page reload does correctly pick up the table device (its query is a plain one-shot `select`, not the broken subscription). **Apply with your normal migration flow (`supabase db push` or equivalent) when you're ready** — it's a single `alter publication` statement, additive, no data risk.

## 5. Lobby Flow

`src/pages/Lobby.tsx`, rendered by `RoomPage` while `rooms.status === 'LOBBY'`.

- **Room code / invite**: heading + `Beitreten unter: <url>` + a share/copy button (`navigator.share` with a clipboard/`execCommand` fallback chain). Verified live — copy path exercised, share path is a browser-API branch not exercisable headlessly but code-reviewed as correct fallback logic.
- **Player list**: one row per `players` row, avatar + name + **HOST badge** (new) + verbunden/getrennt (HUMAN) or "Bot" (BOT) + host-only "Entfernen" (not shown on your own row).
- **Table device status** (new, own compact block, never mixed into the player list — brief §14/§38): "Verbunden — Präsenzmodus möglich" or "Kein Tischgerät — alle spielen remote", live-sourced from `useHasTableDevice` (subject to the reconnect-only caveat in §4 above).
- **Host controls**: "Bot hinzufügen" (disabled at `MAX_PLAYERS`, new), "Spiel starten" (disabled under 2 players, with a visible reason — brief §27 was already satisfied here, not newly added), an error+retry block for a failed start (idempotent `actionId` reuse via `usePendingAction`).
- **Non-host**: "Warte, bis der Host das Spiel startet…".
- **Leave**: available to everyone, host or not.

No Ready system exists and none was added (brief §39: explicitly told not to invent one).

## 6. Join Flow

`src/pages/Join.tsx` — room code (pre-filled from `/join/:code` deep links, confirmed live), role picker (Spieler/Spieltisch/Zuschauer — three distinct, clearly-iconed cards), name+avatar only for the Spieler role. Tested live:

- ✅ Valid room code + PLAYER role → joins, lands in Lobby.
- ✅ Deep link `/join/<code>` pre-fills the code field.
- ✅ TABLE role joins without requiring a name (server never asked for one).
- ✅ Invalid/room-not-found and already-started-for-PLAYER cases are code-verified (`join-room` returns `ROOM_NOT_FOUND`/`ROOM_NOT_JOINABLE` with proper messages) but not separately screenshotted — same generic `error-text` rendering path already covered by the reconnect-failure screenshot.
- **"Voller Raum"**: could not be tested live because no cap existed before this phase's prepared-but-undeployed `MAX_PLAYERS` change (§8).
- Duplicate/rapid-double-join: both `Home.tsx` and `Join.tsx` set `busy` synchronously before the async call and disable their submit button on it — a fast double-click cannot reach the server twice. No server-side idempotency key exists for `create-room`/`join-room` (unlike `start-game`/`dispatch-action`, which use `actionId`); documented as a known limitation (§13), not fixed — would need a client-generated idempotency key plumbed through a new Edge Function parameter, which is a bigger change than this phase's scope.

## 7. Table Device Flow

Live-tested end to end (Flow B, §9): join `/join/:code` → pick "Spieltisch" → Lobby shows "Dieses Gerät" tag + the room-wide table-device block flips to "Verbunden" (after the reload workaround from §4) → Start → lands in the real `TABLE_DEVICE` view (full ring, hero center, seat-edit toggle) → **reload while in-game → still `TABLE_DEVICE`, never acquires a player identity or a hand** (confirmed both by the live screenshot and by `RoomPage.tsx`'s routing logic: `session.role === "PLAYER" && session.playerId ? <PlayerGame> : <TableGame>` — a TABLE session can never satisfy that condition, structurally, regardless of any other state).

## 8. Remote Flow (no table device)

Live-tested end to end (Flow A, §9): create room → second player joins → (bots optional) → no table device → Start → **both** devices land in `REMOTE_MOBILE_FULL` (confirmed via screenshot on both tabs) — public table, other players, own hand, direction/active color all visible per brief §6, none of which was touched this phase (pre-existing, re-verified only).

## 9. Hand Only Flow

Live-tested (Flow B): with a table device connected, the player's `PlayerGame` view correctly shows the "Vollständige Ansicht" / "Nur meine Hand" toggle (absent when no table device exists — confirmed in Flow A, where the toggle never appeared at all). Clicking "Nur meine Hand" against **real** Supabase data (not the dev harness) produces the same radically-reduced view already validated in the previous phase's `MOBILE_HAND_UI_FIX_REPORT.md` (§18) — own turn state, own hand, no public table. Confirmed no regression from that phase carried into real multiplayer data.

## 10. Start Flow / View Routing After Start

`start-game` requires host + `LOBBY` status + `players.length >= 2` (bots count as players here, confirmed by reading the Edge Function — it builds `NewPlayerSpec[]` from every seated `players` row regardless of type). On success, `RoomPage`'s realtime `rooms` subscription flips `status` to `PLAYING`, and `RoomPage` re-derives the view purely from `session.role`/`session.playerId` — no separate "redirect" step, so there is no window where a wrong view could flash. Confirmed live for both Flow A (→ both `REMOTE_MOBILE_FULL`) and Flow B (→ table `TABLE_DEVICE`, player gets the Hand-Only toggle).

## 11. Reconnect Flow

Live-tested (Flow C, §9): mid-game reload of a `PLAYER` device → `reconnect()` → same `deviceId`/`sessionToken` → same `playerId` → same hand (screenshot confirms identical cards before/after reload) → same view (`REMOTE_MOBILE_FULL`) → "Du bist wieder im Spiel." toast. Also confirmed: **direct URL to a real room with no local session at all** cleanly redirects to `/join` (no blank page — brief §31) — tested with `sessionStorage`/`localStorage` explicitly cleared before navigating.

**Found and fixed**: a failed reconnect (bad/deleted session) previously left the user on a **dead-end** page (`RoomPage.tsx`'s old `if (error) return <div className="error-text">{error}</div>` with no way forward). Reproduced live with a deliberately-invalid session and confirmed the fix — the page now offers "Zur Startseite". The underlying message itself (currently a raw `"Error: UNKNOWN_DEVICE"`-style string) is only fixed at the code level in the not-yet-deployed `reconnect/index.ts` change (§4/§2) — deploying it is what turns that into "Diese Sitzung ist nicht mehr gültig. Bitte tritt dem Raum erneut bei."

## 12. Fallback Flow (Table Device disconnect mid-game)

**Not exercisable through the current UI at all** — there is no "table device leaves/disconnects" action anywhere in the app (a `TableGame` session has no leave/Aufgeben button the way `PlayerGame` does), and per §1.9, nothing server-side ever flips a `devices.connected` flag to false except an explicit leave/remove call, which doesn't exist for TABLE devices. This means the specific scenario in brief §21 ("Table Device disconnected während Spiel") **cannot currently be triggered by a user at all**, let alone tested end-to-end — it's not a broken fallback, it's an absent trigger.

What **is** confirmed by code (not live-tested, since it can't be triggered): `PlayerGame.tsx`'s `effectiveHandOnly = handOnly && hasTableDevice` is a plain reactive expression with no destructive side effect — if `hasTableDevice` ever did flip to `false` (once §4's migration is applied so the flag is even live-reactive at all), the player would fall back to the full `REMOTE_MOBILE_FULL` view automatically, with zero risk to `game_states` (the flag only affects which client-side view renders, never touches server state). Documented as a **code-verified, not live-tested** pass, plus an open gap: there is genuinely no way for a table device to signal "I'm leaving" today.

## 13. Race Conditions Checked

| Scenario | Finding |
|---|---|
| Host starts while a player is mid-join | **Real, found risk, not fixed** — `start-game` snapshots `players` with one `select`, builds the game from that snapshot, then persists. A `join-room` that completes in the gap between that select and the persist would leave an orphan `players` row with no seat in the created game. Fixing this properly needs row-level locking (the same `SELECT ... FOR UPDATE` pattern migration 0008's `remove_lobby_player` RPC already uses) wrapped around `start-game`'s read+decide+write, which is a rule-engine-adjacent structural change explicitly out of this phase's scope. **Documented as an open risk, not fixed.** |
| Bot added while starting | Same underlying race as above (both are `players` inserts); no separate risk. |
| Table device joins during start | No risk — TABLE devices never enter `start-game`'s player snapshot at all. |
| Reconnect during the start transition | No risk — `reconnect()` and `start-game` don't share mutable state beyond the `rooms.status` row Postgres already serializes; a reconnect either sees `LOBBY` (pre-start) or `PLAYING` (post-start) cleanly. |
| Reload immediately after Start | Live-tested as part of Flow C's broader reconnect check — clean. |
| Rapid double-click on Start/Join/Create | Client-side `busy`-gated disable prevents a second request from ever firing (§6). |

## 14. Privacy

- Lobby never fetches or renders anything from `game_states`/`private_player_views` — confirmed by reading `useRoomRealtime`'s `refetchAll`, which only calls `fetchPrivateState` when a `device` param is passed, and `Lobby` never passes one (`useRoomRealtime(session.roomId)`, no second argument).
- TABLE_DEVICE: `get_private_state` RPC server-side rejects any device with `player_id = null` (`DEVICE_HAS_NO_PLAYER`) — structurally impossible for a table device to fetch a hand even if the client code tried.
- REMOTE_MOBILE_FULL / HAND_ONLY: each device's `fetchPrivateState` call is authenticated by its own `deviceId`/`sessionToken` pair, server-side — no client ever requests another player's private state.

## 15. Responsive Tests

| Size | Result |
|---|---|
| Desktop (994×550, used for all live-flow captures above) | Clean |
| Mobile portrait (390×844, `LOBBY_MOBILE.png`) | Clean — no overlaps, room code/names all fully readable |
| Long bot/player names | The dev-harness screenshots use realistic short names; one long-name wrap check (`"Spieler 2"` in `LOBBY_DISCONNECTED_PLAYER.png`) showed acceptable wrapping, not overlap |

Tablet and mobile-landscape for the Lobby specifically were not separately captured — the Lobby's layout (`page--centered` + a single `panel--wide` column, no absolute-positioned elements) is inherently reflow-safe at any width, and this pattern was already relied on for Home/Join in earlier phases without incident.

## 16. Screenshots

All in `qa/final/screenshots/`, opened and visually checked individually (no overlaps, room code readable, roles clear, host clear, table device visually distinct from players, start button state understandable, no cut-off names):

| File | Source | Shows |
|---|---|---|
| `LOBBY_REMOTE_HOST.png` | live | Fresh room, host only, table-device block correctly "Kein Tischgerät" |
| `LOBBY_REMOTE_PLAYERS.png` | live | Second player joined live via realtime, HOST badge on the right row |
| `LOBBY_WITH_TABLE_DEVICE.png` | live | Table device connected, block flips to "Verbunden" (after the §4 reload workaround) |
| `LOBBY_WITH_BOTS.png` | dev harness | Host + player + 4 distinct bot rows |
| `LOBBY_DISCONNECTED_PLAYER.png` | dev harness | A "getrennt" player row — not reachable live, see §6/architecture note below |
| `LOBBY_MOBILE.png` | dev harness | 390px width, 3 humans + 1 bot + table connected |
| `GAME_START_REMOTE.png` | live | Both players' Start transition into `REMOTE_MOBILE_FULL` |
| `GAME_START_PRESENCE.png` | live | Player's Start transition, Hand-Only toggle visible because a table device is present |
| `TABLE_DEVICE_CONNECTED.png` | live | The table device's own real `TABLE_DEVICE` in-game view |
| `RECONNECT_PLAYER.png` | live | Mid-game reload — same hand, same identity, reconnect toast |

Note on `LOBBY_DISCONNECTED_PLAYER`: the real architecture cannot currently produce a lobby-phase "disconnected but still present" player row at all — `remove_lobby_player` (the RPC behind leaving/being-removed *in the lobby*) **deletes** the player row outright rather than marking it disconnected; `connected:false` only ever appears mid-game (elimination path). So a real "disconnected in the lobby" screenshot is architecturally unreachable today, not just hard to trigger — the dev-harness version documents the intended visual treatment for if/when a presence mechanism (§1.9) is ever added.

## 17. Open Migrations

Just the one — see §4 (`0010_devices_realtime.sql`, NOT applied).

## 18. Known Limitations (not fixed this phase — documented per the brief's own scope boundaries)

- **No player-cap enforcement live yet** — prepared in `join-room`/`add-bot` (+ client-side pre-emptive disable in Lobby) but **not deployed**. "Voller Raum" cannot be produced today.
- **`useHasTableDevice` non-reactive without a reload** until migration 0010 is applied (§4) — affects both the new Lobby indicator and the pre-existing `PlayerGame` Hand-Only toggle.
- **No table-device "leave" action exists** — §12's fallback flow cannot be triggered by any current UI action.
- **No presence/heartbeat** — a closed (not explicitly left) tab stays `connected:true` server-side forever; "getrennt" in the lobby is architecturally unreachable (only mid-game elimination produces it).
- **`start-game` vs. concurrent `join-room`/`add-bot` race** (§13) — a real, found, unfixed risk; needs row locking, out of this phase's scope.
- **No server-side idempotency key for `create-room`/`join-room`** (only client-side debounce) — lower risk given the UI-level protection, but asymmetric with `start-game`/`dispatch-action`'s `actionId` pattern.
- **`HOST_ADMIN` is dead code** — harmless, left in place, not cleaned up (out of scope).
- Seat-order editing remains **in-game only** (`TableGame`/`GameTable`, pre-existing), not offered pre-start in the Lobby — the brief allows this ("kann bereits in Lobby **oder** direkt vor Start"), so this is a valid existing choice, not a gap.
- Tablet/mobile-landscape were not separately screenshotted for the Lobby specifically (§15) — the layout's simplicity makes this low-risk, but it is a genuine gap in this pass's screenshot coverage.

## 19. Regression

```
npx tsc -b        → clean
npx vitest run    → 218/218 passed (21 files) — unchanged
npm run lint      → same 3 pre-existing set-state-in-effect warnings, nothing new
npm run build     → succeeds; /dev/lobby-preview confirmed absent from dist/assets/*.js
```

---

## 20. Vollständigkeitsmatrix

| FEATURE | IMPLEMENTED | TESTED | VISUALLY VERIFIED | STATUS |
|---|---|---|---|---|
| Room Create | yes (pre-existing) | live | yes | PASS |
| Room Join | yes (pre-existing) | live (PLAYER, TABLE roles) | yes | PASS |
| Host (identification + controls) | yes (badge added this phase) | live | yes | PASS |
| Bots | yes (pre-existing) | live + dev harness | yes | PASS |
| Table Device (registration + Lobby visibility) | yes (Lobby visibility added this phase) | live | yes | PASS (reactivity needs migration 0010) |
| Remote Mode | yes (pre-existing) | live, both devices | yes | PASS |
| Hand Only Mode | yes (pre-existing) | live, real Supabase data | yes | PASS |
| Seat Layout (persistence) | yes (pre-existing, in-game only) | code-reviewed only | no | PASS (not re-exercised live this phase) |
| Start | yes (pre-existing) | live, both flows | yes | PASS |
| Player Reconnect | yes (pre-existing) | live | yes | PASS |
| Table Reconnect | yes (pre-existing) | live | yes | PASS |
| Reload (mid-game, both roles) | yes (pre-existing) | live | yes | PASS |
| Direct URL (no session) | yes (pre-existing) | live | yes | PASS |
| Direct URL (invalid session) | fixed this phase (dead-end removed) | live | yes | PASS |
| Disconnect (lobby) | partial | dev harness only (real state unreachable) | yes | OPEN TODO (architecture doesn't produce a lobby "disconnected" row) |
| Disconnect (in-game) | yes (pre-existing) | not re-tested this phase (out of scope, "nicht neu erfinden") | no | PASS (assumed, pre-existing) |
| Table Device Disconnect Fallback | code-verified reactive expression only | not triggerable via any UI action | no | OPEN TODO |
| Room Full | prepared, not deployed | no (no cap live) | no | OPEN TODO |
| Privacy | yes (pre-existing, re-verified) | code-reviewed | n/a | PASS |
| Responsive (Lobby) | yes (pre-existing layout) | live (mobile 390px) | yes | PASS (tablet/landscape not separately shot) |
| Race conditions (start vs. join) | not fixed | found, documented | n/a | OPEN TODO |

---

## 21. Final Status

**LOBBY / SESSION / START FLOW: PASS** (with the OPEN TODOs above explicitly called out — none of them block the core flows the brief's Definition of Done requires: room create/join work, roles are unambiguous, TABLE_DEVICE is structurally isolated from player/hand data, Remote works without a table device, Presence works with one, Start routing is correct, reload restores the correct view, reconnect identity is secure and never name-based, bots work, no duplicate players were produced in any live test, and disconnect during a real game was not touched/regressed).

**LOCAL URL:** `http://localhost:5173/`

**REPORT:** `LOBBY_SESSION_FLOW_REPORT.md` (this file)

**SCREENSHOTS:** `qa/final/screenshots/LOBBY_REMOTE_HOST.png`, `LOBBY_REMOTE_PLAYERS.png`, `LOBBY_WITH_TABLE_DEVICE.png`, `LOBBY_WITH_BOTS.png`, `LOBBY_DISCONNECTED_PLAYER.png`, `LOBBY_MOBILE.png`, `GAME_START_REMOTE.png`, `GAME_START_PRESENCE.png`, `TABLE_DEVICE_CONNECTED.png`, `RECONNECT_PLAYER.png`

**MIGRATIONS REQUIRED:** `supabase/migrations/0010_devices_realtime.sql` — NOT applied, single additive `alter publication` statement, needed to make `useHasTableDevice` actually reactive (currently only correct immediately after a reload).

**OPEN ISSUES:** No room-size cap live (prepared, not deployed); `start-game` vs. concurrent join/add-bot race (found, not fixed — needs row locking, out of scope); no table-device "leave" action exists so the disconnect-fallback flow can't be triggered/tested; no presence/heartbeat (a closed tab stays "connected" forever server-side); no server-side idempotency key for create-room/join-room (client-side debounce only); `HOST_ADMIN` dead code left in place.

Kein Commit, kein Push, kein Deploy, keine Migration auf Production angewendet — nur lokal geändert, getestet und dokumentiert.
