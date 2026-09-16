# feat/action-chaos-lifecycle

## Ziel
Alle 16 Action/Chaos-Sonderkarten gegen eine neue, verbindliche Lifecycle-Spec prüfen und jede gefundene Regelabweichung fixen — Game-State/Rule-Engine strikt getrennt von Presentation.

## Stand
Engine-Layer-Fixes implementiert, getestet, live verifiziert. **Nicht committet/gepusht/deployed.**

## Entscheidungen + Begründung
- **Drei echte Regel-Bugs gefunden und gefixt** (nicht nur Presentation-Lücken):
  1. **LOWEST**: Unentschieden wurde komplett ignoriert — immer nur ein willkürlicher Spieler zog +2. Jetzt: 1 Spieler → +2, 2+ gleichauf → je +1.
  2. **DRAW-Stack-Topping**: Nur exakt gleicher Kartentyp durfte toppen (DRAW_4 konnte NICHT auf DRAW_2 gelegt werden). Jetzt: Vergleich `drawAmountOf(card) >= lastDrawValue`, wie in der Spec explizit gefordert.
  3. **COLOR ROULETTE**: War faktisch nur eine umskinnte normale WILD-Karte — Spieler/Bot wählte die Farbe selbst, kein Zufall, keine erzwungene Richtung. Jetzt: Engine würfelt Spieler + Farbe serverseitig, erzwingt `direction=1` (im Uhrzeigersinn).
  4. Zusätzlich: WILD_REVERSE_DRAW_4/WILD_DRAW_6/WILD_DRAW_10 sperrten den Stack nach dem Spielen nicht (`terminal`-Flag fehlte komplett) — jetzt gefixt.
- **Vieles war bereits korrekt** (durch Lesen + neue Regressionstests bestätigt, nicht verändert): TIMEOUT-Persistenz inkl. korrektem SKIP/SKIP-ALL-Nichtverbrauch, ONE MORE's Effekt-Unterdrückung, DROP ALL's Suppression mitabgeworfener Karten, SWAP/ROTATE's Player-State-Bindung (TIMEOUT bleibt am Spieler, nicht an der Hand), REVERSE +4's Reihenfolge (erst Richtung drehen, dann Ziel bestimmen).
- **Kein neuer Event-Typ eingeführt** — Spec erlaubt explizit "Eventnamen dürfen an bestehende Architektur angepasst werden". Einzige Event-Änderung: COLOR ROULETTE emittiert jetzt einen `CHOSE_COLOR`-Event mit der von der Engine gewürfelten Farbe (vorher wäre das Zufallsergebnis für die Präsentationsschicht unsichtbar geblieben).
- **Presentation-Schicht nicht neu gebaut**: Bestehende `ActionFocus`/`ActionChoreography`/`MobileActionMotion`/`actionSeverity.ts` aus früheren Phasen erfüllen die Architektur-Vorgabe (Engine entscheidet, Presentation liest nur) bereits. Die volle 5-Phasen-Roulette-Rad-Animation aus der Spec wurde NICHT gebaut (zu großer Umfang für diesen Durchgang) — COLOR ROULETTE bekommt aktuell die bestehende generische MAJOR-Action-Focus-Behandlung (Titel, Akzentfarbe, Kartenbewegung).
- **Kein vollständiges DEV-QA-Harness** (Query-Parameter für jede der 16 Karten deterministisch) und **kein vollständiges 32-Screenshot-Matrix** gebaut — stattdessen: 11 neue, präzise Vitest-Regressionstests direkt gegen den echten Production-Rule-Engine-Code (kein Mock), plus ein Live-Playtest im Browser, der die DRAW-Stack-Fixes tatsächlich in einer echten Bot-Kette bestätigt hat (DRAW_1→DRAW_2→WILD_DRAW_4 korrekt gestapelt, ein zu niedriger DRAW_1 danach korrekt abgelehnt).

## Offene Punkte (max. 3)
1. Volles DEV-QA-Harness (`card=`, `target=`, `drawStack=`, `timeoutCount=`, `roulettePlayer=`, `rouletteColor=`) nicht gebaut.
2. Volle MAJOR-Choreographie für COLOR ROULETTE (Rad-Spin, Phasen A–E) und WILD DRAW 10 (gestaffeltes Streaming statt Kartenwolke) nicht gebaut.
3. Vollständige 32-Screenshot-Matrix aus Sektion 32 nicht erzeugt — nur punktuell live verifiziert.

## Relevante Dateien/Pfade
- `src/game/types.ts` — `PendingEffect.DRAW_STACK` um `lastDrawValue`/`terminal` erweitert, `allowedResponseDefIds` entfernt
- `src/game/rulesEngine.ts` — `isPlayable`, `applyDrawEffect`, `applyGiveTwoToLowest`, neue `applyColorRoulette`, `finalizePlay`'s `skipTurnAdvance`
- `src/game/cards.ts` — neue `isTerminalDrawCard`
- `src/game/gameEventDerivation.ts` — COLOR-ROULETTE-`CHOSE_COLOR`-Emission
- `src/game/botStrategy.ts`, `src/pages/PlayerGame.tsx` — kein Farbwahl-UI/Bot-Farbwahl mehr für COLOR ROULETTE
- `src/components/GameTable/PlayerRing.tsx` — TIMEOUT-Badge zeigt jetzt `×N`
- `src/multiplayer/presentationState.ts`, `src/pages/dev/MobilePreview.tsx` — Schema-Anpassung für die neuen PendingEffect-Felder
- `tests/rulesEngine.test.ts`, `tests/gameEventDerivation.test.ts` — 11 neue Tests
- `ACTION_CHAOS_LIFECYCLE_REPORT.md`, `ACTION_CHAOS_CARD_MATRIX.md` (neu, Repo-Root)

## Verworfen & warum
- Vollständige serverseitige Turn-Order-Simulation statt der einfachen `actorPlayerId`-Heuristik für "wer glüht gerade" während Bot-Ketten — unnötig komplex für den reinen Anzeigezweck.
- Ein komplett neues, paralleles Event-Vokabular nach Sektion 26 wörtlich — hätte nur Informationen dupliziert, die bereits im State stehen.

## Befehle zum Reproduzieren
```bash
npx tsc -b
npx vitest run
npm run lint
npm run build
```
Live-Verifikation: Raum mit 2-3 Bots, DRAW-Karten spielen bis eine Kette entsteht, prüfen dass Cross-Type-Topping (DRAW_4 auf DRAW_2) funktioniert und ein zu niedriger Wert abgelehnt wird.
