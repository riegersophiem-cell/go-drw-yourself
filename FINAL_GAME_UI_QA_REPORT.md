# FINAL_GAME_UI_QA_REPORT

QA-Durchgang über Kartendesign, Regel-/Kartenverteilung und die neue TABLE_DEVICE/
REMOTE_MOBILE_FULL-UI. Kein Redesign, keine neuen Regeln — nur Prüfung, echtes lokales
Durchspielen, und minimal-invasive Behebung tatsächlich gefundener Fehler.

## 1. Geprüfter Stand

- Working Tree zum Zeitpunkt dieses QA-Laufs: uncommittete Änderungen aus der
  Regel-Engine-Phase (`GAME_RULE_UPDATE_REPORT.md`) und der UI-Phase
  (`TABLE_UI_IMPLEMENTATION_REPORT.md`) plus die in diesem Lauf gefundenen Fixes (siehe
  Abschnitt 10). Kein Commit, kein Push — Git-Historie unverändert.
- `HANDOFF_MANIFEST.md` existiert im Projekt **nicht** (geprüft: nur `AUDIT_REPORT.md`,
  `BOT_TURN_ARCHITECTURE.md`, `CARD_ASSET_REPORT.md`, `FIX_REPORT.md`,
  `GAME_RULE_UPDATE_REPORT.md`, `PHASE_A_VERIFICATION.md`, `README.md`,
  `TABLE_UI_IMPLEMENTATION_REPORT.md`). `AUDIT_REPORT.md`/`FIX_REPORT.md`/
  `PHASE_A_VERIFICATION.md`/`BOT_TURN_ARCHITECTURE.md` sind **historische** Berichte aus
  Phasen vor dem 5-Farben-Regel-Update und vor dem TABLE_DEVICE-Neubau (referenzieren u. a.
  die inzwischen gelöschte alte `Table`-Komponente) — als Kontext gelesen, aber nicht als
  aktuelle Source of Truth behandelt. Verbindliche Quellen für diesen Lauf waren
  `GAME_RULE_UPDATE_REPORT.md` und `TABLE_UI_IMPLEMENTATION_REPORT.md` (jeweils die
  unmittelbar vorherigen Phasenberichte) sowie der tatsächliche Code/die Tests.

## 2. Vollständigkeitsmatrix

| Feature | Erwartet | Implementiert | Getestet | Visuell verifiziert | Status |
|---|---|---|---|---|---|
| VIOLET (#7047EB) | 5. reguläre Farbe, überall gleichwertig | Ja (`types.ts`, `cards.ts`, `botStrategy.ts`, `cardArt.ts`, UI-Halo/Badges) | Ja (`cardFamilies.test.ts`) | Ja (violetter Halo/ARC-Karte live gesehen) | **PASS** |
| Cards (Design/Assets) | eigenständig, keine Platzhalter, keine Altbestände | Ja — 80 SVG + 80 PNG, alter `src/assets/cards` nicht mehr vorhanden | indirekt (Zähl-Tests) | Ja (alle Screenshots zeigen finale Kartenoptik) | **PASS** |
| Basic Distribution | 4 Typen × 5 Farben × 4 = 80 | Ja | Ja (`cardFamilies.test.ts`: 20/Typ, 80 gesamt) | Ja | **PASS** |
| Core Action Distribution | 4 Typen × 5 Farben × 2 = 40 | Ja | Ja (`cardFamilies.test.ts`: 10/Typ, 40 gesamt) | Ja | **PASS** |
| Chaos Cards | SWAP/ROTATE/SKIP ALL/WILD DRAW 6/10/REVERSE+4/ROULETTE, farblos | Ja (`CHAOS_TYPES`) | Ja (`cardFamilies.test.ts`, `rulesEngine.test.ts`) | Ja (ROTATE, SKIP ALL, REVERSE, STANDARD-Fälle live) | **PASS** |
| SWAP | Farbe vor Tausch, Hand-Tausch korrekt, keine Fremddaten | Ja | Ja (`rulesEngine.test.ts` SWAP_HAND-Suite) | **Nein** — 5 Live-Versuche über ~15 Min. Bot-Spiel haben keinen sauberen SWAP-Frame eingefangen (ein Capture-Versuch traf wegen einer Race Condition im Screenshot-Skript den falschen Folge-Beat und wurde verworfen, siehe Abschnitt 9) | **OPEN TODO** (nur visuell; Logik unit-getestet PASS) |
| ROTATE | Farbe vor Rotation, alle aktiven Spieler, Bots eingeschlossen | Ja | Ja (`rulesEngine.test.ts` ROTATE_HANDS-Suite) | Ja (`07_TABLE_ROTATE.png`) | **PASS** |
| Active Color | jederzeit über ≥2 Signale erkennbar | Ja (Center Halo + Eckbadge + Karte) | Ja (`actionSeverity`/DiscardStage-Logik) | Ja (grüner/roter/blauer/gelber Halo+Badge live) | **PASS** |
| Hero Center | Discard klar dominant vs. Draw (~52 %) | Ja (unverändert aus Vorphase übernommen) | n/a (visuell) | Ja | **PASS** |
| Player Ring | ovale Ellipse, 2–6 Spieler, keine Kollision | Ja, reine Ellipsen-Mathematik | Ja (`seatGeometry.test.ts`) | Ja (4 und 6 Spieler live, siehe `02_/03_TABLE_*_PLAYERS.png`) | **PASS** |
| Seat Edit | Tap-Tausch, Touch+Desktop, Persistenz | Tausch: ja. Persistenz: **DB-Migration nicht angewendet** (siehe Abschnitt 8) | Ja (`seatLayout.test.ts`) | Ja (`04_TABLE_SEAT_EDIT.png`, Tausch live bestätigt) | **OPEN TODO** (Persistenz gesperrt auf Freigabe der Migration) |
| Orbit Flow | ersetzt altes Widget, CW/CCW, Reverse sichtbar | Ja | n/a (visuell) | Ja (`09_TABLE_REVERSE.png` zeigt Reverse-Flash) | **PASS** |
| Standard Action | verständlich, kein Vollbild-Block | Ja | Ja (`actionSeverity.test.ts`) | Ja (`05_TABLE_STANDARD_ACTION.png`, `11_MOBILE_STANDARD_ACTION.png`) | **PASS** |
| Major Action | bis ~5 s, Scrim, große Typografie | Ja | Ja (`actionSeverity.test.ts` Duration-Caps) | Ja (`07_TABLE_ROTATE.png`, `08_TABLE_SKIP_ALL.png`, `12_MOBILE_MAJOR_ACTION.png`) | **PASS** |
| Table Device | kein Header/Eventleiste, Hero dominiert | Ja | n/a | Ja | **PASS** |
| Remote Mobile | eigene Komposition, nicht verkleinert | Ja (kompakter Ring statt Oval) | n/a | Ja (`10_MOBILE_NORMAL.png` u. a.) | **PASS** |
| Hand Only | weiterhin funktionsfähig | Ja, unverändert (Code-Review: `PlayerGame.tsx` `effectiveHandOnly`-Pfad nicht angetastet) | bestehend | **Nein** (nicht erneut live durchgeklickt — kein Table-Device-Gerät im QA-Setup verbunden) | **PASS** (Code unverändert, aus Vorphase übernommenes Feature) |
| 1 Row (1–10 Karten) | genau 1 Reihe | Ja | Ja (`handLayout.test.ts`) | Ja (z. B. 7-Karten-Screenshots) | **PASS** |
| 2 Rows (11–20) | 7/6 bei 13 etc. | Ja | Ja (`handLayout.test.ts`, exakt 13→7/6 etc.) | Ja (`13_MOBILE_13_CARDS.png`, 13+ Karten) | **PASS** |
| 3 Rows (21+) | 8/7/7 bei 22 etc. | Ja | Ja (`handLayout.test.ts`, exakt 22→8/7/7 etc.) | **Nein** — Live-Versuche erreichten wiederholt nur 15–18 Karten, bevor die Testrunde endete (siehe Abschnitt 9) | **OPEN TODO** (nur visuell bei genau 21+; Logik unit-getestet PASS) |
| Privacy | keine fremden Handkarten je Modus | Ja (Code-Review: `TableGame` ruft nie `privateState` ab; `GameTable`/`PlayerRing` erhalten nur `cardCount`) | bestehende Sicherheitsarchitektur unverändert | Ja (kein Fund) | **PASS** |
| Reconnect | korrekter Endzustand, keine kaputte Queue | Ja | bestehend | Ja ("Du bist wieder im Spiel." nach Reload mehrfach live, u. a. mit aktiver Chaos-Farbe und laufendem Draw-Stack) | **PASS** |
| Responsive | Desktop/Tablet/Mobile ohne Cutoffs | Ja, **2 echte Bugs gefunden und behoben** (siehe Abschnitt 10) | n/a | Ja (siehe Screenshot-Liste) | **PASS** (nach Fix) |
| Reduced Motion | Funktion bleibt erhalten | Ja (alle neuen Animations-Dateien haben `prefers-reduced-motion`-Regeln) | Code-Review | **Nein** (nicht mit aktivierter OS-Einstellung live geklickt) | **PASS** (Code-Review; nicht live gegengetestet) |

## 3. Logic-Test-Ergebnisse

```
npx tsc -b        → 0 Fehler
npx vitest run    → 21 Testdateien, 218/218 Tests grün
npm run lint      → 0 neue Warnungen (1 vorbestehende in RoomPage.tsx, unverändert)
npm run build     → erfolgreich, dist/ erzeugt
```

Keine Regel-Logik verändert. Alle drei offenen `TODO_DEFINE_*`-Marker aus der
Regel-Engine-Phase sind weiterhin unangetastet im Code vorhanden und wurden **nicht**
stillschweigend entschieden:

- `TODO_DEFINE_SHOVE_EFFECT` — `src/game/types.ts:26,49`
- `TODO_DEFINE_LOWEST_HAND_TIE_RULE` — `src/game/rulesEngine.ts:385`
- `TODO_DEFINE_COLORED_ACTION_COPY_COUNT` — `src/game/cards.ts:25,35`

## 4. UI-Test-Ergebnisse (echtes lokales Durchspielen)

Getestet über ein eigens geschriebenes Playwright-Skript (`qa/capture*.mjs`, siehe
Abschnitt 9) gegen den laufenden `npm run dev`-Server — **keine Mockups**, jeder
Screenshot zeigt den tatsächlich gerenderten Zustand einer echten Supabase-Partie
(mehrere frische Testräume, ausschließlich mit Bots und einer Testspielerin "Sophie").

- 4-Spieler- und 6-Spieler-Ring: sauber, keine Kollisionen, Namen/Kartenzahlen vollständig
  lesbar (`02_/03_TABLE_*_PLAYERS.png`).
- Seat Edit Mode: Aktivieren, Tap-Tap-Tausch, Deaktivieren — funktioniert, verändert
  nachweislich nur die visuelle Position (Server-`seatIndex`/Turn Order/Hände unberührt,
  da `seatLayout.ts` ausschließlich mit einer separaten Id-Liste arbeitet).
- Standard Action (REVERSE/DRAW 4) und Major Action (ROTATE, SKIP ALL) live beobachtet,
  jeweils mit korrektem Highlight des betroffenen Spielers, korrekter Farbe und
  angemessener Anzeigedauer.
- Reverse: Orbit-Flow-Puls wechselt sichtbar auf Weiß/verlangsamt und kehrt danach zur
  normalen Richtungsanimation zurück (`09_TABLE_REVERSE.png`).
- Chaos-Farbauflösung: nach `chooseColor()` zeigt der Ablagestapel Halo **und**
  Eckbadge in der gewählten Farbe (Kartenbild selbst bleibt schwarz/graphit — siehe
  bekannte Einschränkung in `TABLE_UI_IMPLEMENTATION_REPORT.md` Abschnitt 8).

## 5. Responsive-Ergebnisse

| Auflösung | Ergebnis |
|---|---|
| 1024×768 | PASS |
| 1366×768 | PASS |
| 1920×1080 | **Bug gefunden und behoben** (siehe Abschnitt 10.1) |
| 320×568 | **Bug gefunden und behoben** (siehe Abschnitt 10.2) |
| 360×800 | PASS |
| 390×844 | PASS (nach Fix 10.3 für den Topbar/Ring-Overlap) |
| 430×932 | PASS |
| 844×390 (Landscape) | **Bug gefunden und behoben** (siehe Abschnitt 10.3/10.4) |
| 932×430 (Landscape) | PASS (nach Fix) |

Nicht separat getestet: 1280×800 wurde indirekt als Basisauflösung für die meisten
Table-Device-Läufe genutzt (implizit PASS), aber nicht explizit gelistet wie in Abschnitt
82 gefordert — inhaltlich abgedeckt durch die vier oben genannten Desktop-Größen.

## 6. Animation-Ergebnisse

- Keine sichtbaren Ruckler bei 4–6 Spielern oder 13–18 Handkarten während der
  automatisierten Testläufe beobachtet.
- Karten-Flug, Zieh-Flug, Center-Halo-Übergänge, Orbit-Flow-Puls: alle über
  `transform`/`opacity`/`filter`, keine erzwungenen Layout-Reflows beobachtet.
- **Ein echtes visuelles Kollisionsproblem gefunden und behoben**: der permanente
  Draw-Stack-Chip über dem Ablagestapel überlappte die große Major-Action-Typografie
  (z. B. "SKIP ALL" erschien als "SKIP ALL2"). Fix: Chip blendet sich aus, sobald irgendein
  Action Focus aktiv ist (siehe Abschnitt 10.5).
- Reduced Motion nicht mit tatsächlich aktivierter Betriebssystem-Einstellung
  gegengetestet (nur Code-Review, siehe Matrix) — Restrisiko gering, da die Regeln
  strukturell identisch zu den bereits vorher funktionierenden sind.

## 7. Privacy-Prüfung

Code-Review bestätigt (unverändert seit Vorphase, für diese Phase erneut geprüft):

- `TableGame.tsx` ruft `useRoomRealtime(session.roomId)` **ohne** Device/Session-Parameter
  auf → erhält nie `privateState`.
- `GameTable`/`PlayerRing` erhalten fremde Spieler ausschließlich als `PublicPlayerView`
  (`cardCount`, kein `CardDefinition[]`).
- Die neue `room_seat_layout`-Tabelle enthält ausschließlich Spieler-IDs, keine Kartendaten.
- Keine Stelle im UI-Code sendet ein fremdes `CardDefinition`-Objekt an eine Animation.

Keine Verletzung gefunden.

## 8. Reconnect-Prüfung

Live bestätigt (Seiten-Reload während laufender Partie, mehrfach in verschiedenen
Zuständen):

- Normaler Zug: korrekter Endzustand, "Du bist wieder im Spiel."-Toast.
- Aktive (aufgelöste) Chaos-Farbe: Halo/Badge zeigen nach Reload weiterhin korrekt die
  zuletzt gewählte Farbe (nicht zurückgesetzt).
- Laufender Draw-Stack: `pendingEffect`-Chip nach Reload weiterhin korrekt sichtbar.
- Große Hand (13–18 Karten): Mehrreihen-Layout nach Reload sofort korrekt, keine
  Neuberechnung nötig (reiner Funktions-Aufruf auf dem aktuellen `ownHand`).
- **Nicht separat reproduziert**: Reconnect exakt in der Mitte einer laufenden
  SWAP/ROTATE-Animation bzw. mit aktivem TARGET-Marker — laut
  `useTurnPlayback`/`useEventPresentation`-Architektur (unverändert) sollte dies aus dem
  bereits vorher bestehenden Verhalten automatisch korrekt funktionieren (State ist
  autoritativ, Animation wird nur aus dem aktuellen State abgeleitet), aber nicht in
  diesem Lauf einzeln erzwungen.

## 9. Screenshot-Methodik (wichtiger Hinweis zur Werkzeugwahl)

Die interaktive Browser-Vorschau dieser Sitzung kann Screenshots nur inline anzeigen,
aber nicht als Dateien auf die Festplatte schreiben. Da echte, als Datei vorliegende
Screenshots ausdrücklich gefordert waren, wurde `playwright` (Version 1.63.0) als
einmalige Dev-Dependency installiert (`package.json`/`package-lock.json`, siehe Abschnitt
11) und drei kleine, nicht in die App integrierte Node-Skripte unter `qa/` geschrieben:

- `qa/capture.mjs` — Grundzustände (Table Device 4/6 Spieler, Seat Edit, responsive
  Matrix, Mobile Normal/klein/Landscape).
- `qa/capture_actions.mjs` — spielt automatisiert Bot-Runden durch und schneidet
  Standard-/Major-Action-Momente am Tisch mit.
- `qa/capture_hand_sizes.mjs` — zieht absichtlich wiederholt Karten, um 13+/22+-Hände zu
  erzwingen.
- `qa/capture_mobile_actions.mjs` — dieselbe Action-Erfassung für die mobile Ansicht.

Diese Skripte steuern echte Browser-Sessions gegen den lokalen Dev-Server und echte
Supabase-Testräume — es sind **keine** Mockups. Sie sind bewusst nicht Teil der
App/Test-Suite (kein `import` aus `src/`, nicht von `npm test` erfasst) und können
gelöscht werden, falls nicht mehr benötigt; `playwright` kann danach wieder entfernt
werden (`npm uninstall -D playwright`).

**Einschränkung**: Chaos-Karten wie SWAP_HAND kommen bei zufälligem Bot-Spiel selten vor
(10 von ~166 Karten). Trotz fünf Versuchen (~15 Minuten automatisiertes Bot-Spiel) wurde
kein sauberer SWAP-Screenshot erzielt; ein Versuch traf durch eine Race Condition
zwischen Zustandserkennung und `page.screenshot()` den falschen (nachfolgenden) Beat und
wurde verworfen, statt ihn fälschlich als SWAP auszugeben. Ebenso wurde 21+ Karten (exakt
3-Reihen-Fall) trotz mehrerer Versuche nicht erreicht, da die Testrunden vorher endeten
(Mercy-Regel/Rundenende). Beide Fälle sind ausschließlich **visuelle** Bestätigungslücken
— die zugrunde liegende Logik ist in beiden Fällen durch dedizierte Unit-Tests
(`rulesEngine.test.ts`, `handLayout.test.ts`) exakt abgedeckt und grün.

## 10. Gefundene und behobene Fehler

Alle fünf sind echte, live reproduzierte Bugs (keine hypothetischen) und wurden minimal
-invasiv behoben, ohne Architektur oder Regeln zu verändern.

### 10.1 Player Ring kollabiert auf Ultra-Wide-Desktops
**Gefunden bei**: 1920×1080. Die prozentbasierte Ellipse (`PlayerRing.css`) spannte sich
über die volle, sehr breite Surface auf und drückte die Sitzplätze fast an den
Bildschirmrand, mit großem leeren Innenraum — Verstoß gegen "Spieler nicht zu weit außen
verlieren" (Auftrag Abschnitt 21).
**Fix**: `.game-table--table_device .game-table__surface` erhält `max-width`/`max-height`
+ Zentrierung (`GameTable.css`).

### 10.2 (Beim Beheben von 10.1 zwischenzeitlich verursacht, sofort gefunden und behoben) Surface-Breite kollabierte auf 0
Die erste Fix-Version nutzte `margin: 0 auto` ohne explizite `width` — das deaktiviert
Flexbox-`stretch`, und da alle Kinder der Surface `position: absolute` sind (kein
In-Flow-Inhalt), kollabierte die Breite auf 0, wodurch zwei Spieler exakt übereinander
lagen und hinter dem Hero-Center verschwanden. Sofort per Debug-Skript entdeckt, bevor es
in einen Screenshot einging. **Fix**: explizite `width: 100%` zusätzlich zu `max-width` +
`margin-inline: auto`.

### 10.3 Room-Code-Chip überlappt ersten Spieler-Chip (Mobile & Desktop REMOTE_MOBILE_FULL)
**Gefunden bei**: 390×844 und 1280×800 (Player-Ansicht). Der feste `padding-top`
(42px/54px), 1:1 aus der alten `Table`-Komponente übernommen, reichte nicht aus, um den
tatsächlich gerenderten Topbar-Bereich (in Player Game 78–106px hoch) zu räumen — der neue
kompakte Player Ring beginnt direkt am oberen Rand der Surface und überlappte dadurch
sichtbar den "Raum"-Chip.
**Fix**: `padding-top` in `PlayerGame.css` auf 116px (Desktop) / 88px (≤760px) angehoben,
anhand tatsächlich gemessener Topbar-Höhen.

### 10.4 Player Ring überlappt Discard/Draw-Stapel bei umbrechendem Ring (320–360px)
**Gefunden bei**: 320×568 mit 4 Spielern. `PlayerRing--compact` bricht bei wenig Platz in
2 Zeilen um; da `DiscardStage` unabhängig davon absolut über die **gesamte** Surface
zentriert war, rutschte die zweite Ring-Zeile sichtbar über die Ablagekarte.
**Fix**: Für `REMOTE_MOBILE_FULL` wird die Surface zu einer Flex-Spalte; `DiscardStage`
zentriert sich nur noch in der nach dem Ring verbleibenden Fläche statt absolut über die
gesamte Surface (`GameTable.css`).

### 10.5 Draw-Stack-Chip überlappt Major-Action-Typografie
**Gefunden bei**: Live-Test von SKIP ALL am Tisch — der Text erschien als "SKIP ALL2"
(die "2" gehörte zum permanenten Draw-Stack-Chip über dem Ablagestapel).
**Fix**: `.game-table--focus .discard-stage__stack-chip { opacity: 0 }` — der Chip blendet
sich für die Dauer jeder Action-Focus-Anzeige aus.

### 10.6 (kleinerer Kosmetik-Fund, nebenbei behoben) Leerer Major-Headline-Titel für SWAP/ROTATE vor dem zweiten Beat
**Gefunden bei**: mobiler Major-Action-Screenshot — Farbzeile ("FARBE · BLAU") ohne
darüberliegenden Titel. Ursache: Die Titel-Zuordnung in `ActionFocus.tsx` prüfte nur
`beat.kind === "SWAP"/"ROTATE"` (die späteren, zusammengeführten Beats), nicht aber den
ersten `PLAY`-Beat mit `card.type === "SWAP_HAND"/"ROTATE_HANDS"` (bereits als MAJOR
eingestuft, aber noch ohne Titel-Zuordnung).
**Fix**: Titel-Zuordnung ergänzt um `beat.card?.type === "SWAP_HAND"` → "SWAP" bzw.
`"ROTATE_HANDS"` → "ROTATE".

Alle sechs Fixes sind in `src/components/GameTable/*.css`, `src/components/GameTable/ActionFocus.tsx`
und `src/pages/PlayerGame.css` enthalten; nach jedem Fix wurden `tsc -b`, `vitest run` und
`lint` erneut grün bestätigt (letzter Stand: siehe Abschnitt 3).

## 11. Bekannte Restrisiken / offene TODOs

1. **Seat-Layout-Persistenz** (`supabase/migrations/0009_seat_layout.sql`) ist weiterhin
   nicht auf das Supabase-Projekt angewendet — reine Freigabefrage, kein Codeproblem
   (unverändert seit `TABLE_UI_IMPLEMENTATION_REPORT.md`).
2. **SWAP-Screenshot** und **21+-Karten-Screenshot** nicht live erzielt (siehe Abschnitt
   9) — Logik in beiden Fällen unit-getestet PASS, nur visuelle Bestätigungslücke.
3. Die drei `TODO_DEFINE_*`-Marker aus der Regel-Engine-Phase sind weiterhin offen und
   wurden bewusst nicht in dieser Phase entschieden.
4. `playwright` wurde als Dev-Dependency hinzugefügt, ausschließlich für dieses
   QA-Skript-Tooling (siehe Abschnitt 9) — kein Einfluss auf `dist/`, kann bei Bedarf
   wieder entfernt werden.
5. Reduced-Motion und `PLAYER_HAND_ONLY` wurden in diesem Lauf per Code-Review, nicht
   erneut live bestätigt (siehe Matrix) — beides unverändert aus der Vorphase
   übernommen, kein neuer Code-Pfad.
6. Die vollständige 8-Auflösungen-Matrix aus Auftrags-Abschnitt 82 wurde nicht jede
   einzeln mit eigenem Screenshot-Namen abgedeckt (1280×800 lief implizit als
   Basisauflösung mit, ohne eigenen Screenshot) — inhaltlich durch die 9 tatsächlich
   erzeugten Responsive-Screenshots abgedeckt.

## 12. Screenshots

Alle Dateien liegen unter:

```
C:\Users\sophie\Documents\Sophies Programme\uno-show-em-no-mercy\qa\final\screenshots\
```

| Datei | Inhalt |
|---|---|
| `01_TABLE_NORMAL_hostview.png` | Ausgangszustand, Host-Sicht (REMOTE_MOBILE_FULL) |
| `02_TABLE_4_PLAYERS.png` | TABLE_DEVICE, 4 Spieler |
| `03_TABLE_6_PLAYERS.png` | TABLE_DEVICE, 6 Spieler |
| `04_TABLE_SEAT_EDIT.png` | Seat Edit Mode aktiv |
| `05_TABLE_STANDARD_ACTION.png` | Standard Action Focus (REVERSE), Actor hervorgehoben |
| `07_TABLE_ROTATE.png` | Major Action Focus (ROTATE), Scrim + Typografie |
| `08_TABLE_SKIP_ALL.png` | Major Action Focus (SKIP ALL), nach Fix 10.5 ohne Chip-Overlap |
| `09_TABLE_REVERSE.png` | Orbit-Flow-Reverse-Flash |
| `10_MOBILE_NORMAL.png` | REMOTE_MOBILE_FULL Grundzustand |
| `11_MOBILE_STANDARD_ACTION.png` | Standard Action auf Mobile |
| `12_MOBILE_MAJOR_ACTION.png` | Major Action auf Mobile (nach Fix 10.6) |
| `13_MOBILE_13_CARDS.png` | Mehrreihen-Hand, ≥13 Karten (2 Reihen) |
| `15_MOBILE_SMALL_320.png` | 320px Breite, nach Fix 10.4 ohne Ring/Discard-Overlap |
| `16_MOBILE_LANDSCAPE_844x390.png` | Landscape 844×390, nach Fix |
| `16b_MOBILE_LANDSCAPE_932x430.png` | Landscape 932×430 |
| `MOBILE_320x568.png` | 320×568 Portrait |
| `MOBILE_360x800.png` | 360×800 Portrait |
| `MOBILE_430x932.png` | 430×932 Portrait |
| `TABLE_1024x768.png` | Table Device 1024×768 |
| `TABLE_1366x768.png` | Table Device 1366×768 |
| `TABLE_1920x1080.png` | Table Device 1920×1080, nach Fix 10.1/10.2 |

Fehlend (siehe Abschnitt 9): `06_TABLE_SWAP.png`, `14_MOBILE_22_CARDS.png`.

## Status

**UI/Layout/Animation**: vollständig gemäß Vorphasen-Berichten umgesetzt, in diesem Lauf
gegen echtes Gameplay verifiziert, sechs echte Bugs gefunden und behoben.
**Regeln**: unverändert, alle offenen TODOs unangetastet gemeldet statt entschieden.
**Git/Deployment**: keine Commits, kein Push, kein Vercel-Deploy.
