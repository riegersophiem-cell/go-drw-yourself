# fix/bot-turn-timing-race

## Ziel
Der Ablagestapel (und wer gerade "dran" ist) darf während eines Bot-Zug-Ketten-Playbacks nicht schon das Endergebnis zeigen, bevor die Erzähl-Beats der einzelnen Bots durchgelaufen sind.

## Stand
Fix implementiert, getestet, lokal verifiziert. **Nicht committet/gepusht/deployed** (Session-weite Vorgabe).

## Entscheidungen + Begründung
- **Root Cause bestätigt**: `botLoop.ts`'s `runBotTurnsUntilHumanOrOver` löst die komplette Bot-Kette serverseitig in einem Rutsch auf; `dispatch-action/index.ts` persistiert nur den finalen State (`persistTurnBatch`). `useRoomRealtime.refetchAll` setzt `publicState` sofort auf diesen finalen State, sobald die Broadcast-Bestätigung reinkommt — bevor `useTurnPlayback` überhaupt den ersten Beat zeigt. `GameTable` bekam bisher immer `publicState` (final) statt eines an den aktuellen Beat gekoppelten Zwischenstands.
- **Lösung ist rein clientseitig** (kein Server-Redeploy nötig, passt zur "kein Deploy"-Vorgabe): neuer Projektor `src/multiplayer/presentationState.ts` spielt die im Batch mitgelieferten `PendingGameEvent`s einzeln auf den State VOR dem Batch ab (`applyEventToPublicState`/`buildPresentationSnapshots`) und rekonstruiert so `topDiscard`, `activeColor`, `currentPlayerId`, `cardCount` pro Spieler, `pendingSkipTargets` und `pendingEffect` (Draw-Stack-Chip) für jeden einzelnen Schritt.
- **`currentPlayerId`-Heuristik**: statt die echte Zugreihenfolge/Skip-Logik zu duplizieren, wird für jeden Event einfach `event.actorPlayerId` als "aktiver Sitz" übernommen — einfacher, robuster, und deckt genau das ab, was die Ringanzeige während des Playbacks zeigen soll (wer gerade handelt).
- **`baseState`-Capture**: `useRoomRealtime` hält jetzt `publicStateRef` und snapshotet ihn ganz am Anfang von `handleBatchBroadcast`, bevor der bestätigende Refetch `publicState` überschreibt. Nur wenn `baseState.gameId`/`.version` exakt zu `batch.fromVersion` passen, wird er als gültige Rekonstruktionsbasis durchgereicht (`PresentationBatch.baseState`) — sonst `null`, und `useTurnPlayback` fällt für diesen einen Batch auf den live `publicState` zurück (kein falscher State, nur kein beat-genaues Board für diesen Batch).
- **`PlaybackBeat.lastEventSequence`** (neues Feld) markiert, welches Roh-Event den Endzustand eines zusammengefassten Beats (z. B. PLAY_CARD+CHOSE_COLOR) bestimmt, damit `useTurnPlayback` den richtigen Snapshot nachschlagen kann.
- **Bekannte, akzeptierte Ungenauigkeit**: `DISCARD_ONE_EXTRA`'s Zusatz-Karten-Effekt bei `DISCARD_ALL` ist im Event-Log nicht separat erfasst (nur der ursprüngliche `PLAY_CARD`-Event zieht 1 vom Handkartenzähler ab) — während exakt dieses einen Beats kann die Handkartenanzahl auf dem Ring kurz ungenau sein, korrigiert sich sofort beim nächsten Live-Refetch. Wurde bewusst nicht "gefixt", weil das ein neues Server-Event + Redeploy bräuchte (außerhalb der No-Deploy-Vorgabe) — dokumentiert statt umgangen.

## Offene Punkte (max. 3)
1. DISCARD_ALL-Handkartenzahl während des eigenen Beats leicht ungenau (s.o.) — nur behebbar mit neuem Server-Event + Redeploy.
2. `pendingEffect.sourcePlayerId`/`.allowedResponseDefIds` werden in der Rekonstruktion nur mit Platzhaltern gefüllt (kein Renderer liest sie aktuell — falls sich das ändert, hier nachziehen).
3. Live nur mit einem Szenario durchgespielt (SKIP_EVERYONE → WILD_DRAW_4 → REVERSE_DRAW_4-Kette); nicht jede Kartenkombination einzeln durchprobiert.

## Relevante Dateien/Pfade
- `src/multiplayer/presentationState.ts` (neu) — Projektor + `PresentationBatch`-Typ
- `src/multiplayer/playbackBeats.ts` — `lastEventSequence`-Feld
- `src/hooks/useRoomRealtime.ts` — `publicStateRef`, `baseState`-Capture
- `src/hooks/useEventPresentation.ts` — Queue-Typ auf `PresentationBatch`
- `src/hooks/useTurnPlayback.ts` — Snapshot-Aufbau, `presentationState` im Rückgabewert
- `src/pages/PlayerGame.tsx`, `src/pages/TableGame.tsx` — `GameTable` bekommt `tableState = playback.presentationState ?? publicState`
- `src/pages/dev/ActionPreview.tsx`, `src/pages/dev/MobilePreview.tsx` — Fixture-Update für neues Pflichtfeld
- `tests/presentationState.test.ts` (neu) — inkl. Test, der exakt das gemeldete Bug-Szenario reproduziert

## Verworfen & warum
- Vollständige serverseitige Turn-Order-Simulation für `currentPlayerId` (statt `actorPlayerId`-Heuristik) — unnötig komplex für das, was der Ring tatsächlich anzeigen muss.
- Ein neues Server-Event für `DISCARD_ALL`'s Zusatzkarten — würde Edge-Function-Redeploy erfordern, verstößt gegen die Session-Vorgabe "kein Deploy".

## Befehle zum Reproduzieren
```bash
npx tsc -b
npx vitest run tests/presentationState.test.ts
npx vitest run
npm run lint
npm run build
```
Live-Verifikation: Raum mit 3 Bots erstellen, Spiel starten, eine Karte spielen, die eine Bot-Kette auslöst (z. B. SKIP_EVERYONE) — Ablagestapel/Highlight müssen pro Beat wechseln, nicht sofort das Kettenende zeigen.
