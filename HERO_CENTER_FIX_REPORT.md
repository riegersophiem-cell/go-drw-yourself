# HERO_CENTER_FIX_REPORT

Gezielter Fix des visuellen Größen-/Layoutproblems auf **TABLE_DEVICE**: Hero Center war
zu klein, Player Ring zu weit außen, dadurch zu viel leere Fläche. Kein Redesign — nur
Größenhierarchie/Positionierung/Skalierung. Game Logic, Rule Engine, Realtime, Seat Logic,
Action-Focus-Verhalten, Mobile-Layout, Hand-Layout, Farben, Kartenassets und Animation-
Logik wurden nicht verändert.

## 1. Geänderte Dateien

Ausschließlich vier Dateien in `src/components/GameTable/`, alle rein layout-/größenbezogen:

| Datei | Änderung |
|---|---|
| `GameTable.css` | Surface-Container für `TABLE_DEVICE` verkleinert/dichter gemacht |
| `PlayerRing.tsx` | Sitzplatz-Ellipsenradien für die `"full"`-Variante enger |
| `OrbitFlow.tsx` | Ellipsenradien passend zum engeren Ring nachgezogen |
| `DiscardStage.css` | Discard/Draw-Kartengröße nur für TABLE_DEVICE deutlich erhöht |

Keine Änderung an `seatGeometry.ts` selbst (Standardwerte/Tests bleiben unangetastet) —
die engeren Radien werden nur an der einen Aufrufstelle (`PlayerRing.tsx`, Variante
`"full"`) explizit übergeben. Keine Änderung an `ActionFocus.tsx`, `CenterHalo.tsx`,
`HandDock.tsx`, `PlayerHand.tsx` oder irgendeiner `.ts`-Datei außerhalb von UI-Layout.

## 2. Vorher/Nachher-Größenlogik

### Player Ring (nur `variant="full"`, also nur TABLE_DEVICE)

| Parameter | Vorher | Nachher |
|---|---|---|
| `radiusXPct` | 43 (Funktions-Default) | **34** (explizit für `"full"`) |
| `radiusYPct` | 37 (Funktions-Default) | **33** (explizit für `"full"`) |
| Surface `max-width` | 1360px | **1120px** |
| Surface `max-height` | 840px | **760px** |

### Hero Center (Discard/Draw), nur nicht-kompakte (`TABLE_DEVICE`) Instanz

| Element | Vorher (geerbt von `Card.css`) | Nachher | Erhöhung |
|---|---|---|---|
| Discard (Hero) | 160px fix (108/96/88px unter 760/420/320px — für TABLE_DEVICE praktisch irrelevant, da Table nie unter 760px läuft) | `clamp(188px, 14vw, 222px)` | **+17,5 % bis +38,75 %** je nach Viewport |
| Draw | 74px fix (`.uno-card--normal`) | `clamp(104px, 7.7vw, 122px)` | Verhältnis Draw/Discard jetzt durchgehend **~55 %** (vorher ~46 %) |

Die Erhöhung liegt an der unteren Grenze der vorgegebenen 35–60 %-Spanne (Abschnitt 3 des
Auftrags), bewusst konservativ gewählt, weil die ersten beiden Testläufe bei stärkerer
Vergrößerung (ursprünglich `clamp(200,15vw,240)` mit Ring-Radius 35/30 und Surface
680px Höhe) zu einer echten Kollision zwischen der vergrößerten Discard-Karte und den
Sitzplätzen "Sophie" (oben) und "Bot 3" (unten) führten — live im Screenshot entdeckt,
sofort korrigiert (Surface-Höhe auf 760px angehoben, Ring-Radius auf 34/33 justiert,
Kartengröße leicht auf den finalen Wert reduziert), bevor der Fix als fertig galt.

### Orbit Flow (nur `compact={false}`, also TABLE_DEVICE)

| Parameter | Vorher | Nachher |
|---|---|---|
| `rx` | 44 | **36** |
| `ry` | 38 | **35** |

Folgt damit dem neuen, engeren Player-Ring-Radius (34/33) mit einem kleinen Puffer nach
außen, statt wie vorher deutlich weiter draußen als der eigentliche Ring zu liegen.

## 3. Getestete Auflösungen

Live gegen den lokalen Dev-Server mit einer echten 4- bzw. 6-Spieler-Partie (1 Testspielerin
+ Bots) geprüft, per Playwright-Skript (`qa/capture.mjs`, bereits aus dem vorherigen
QA-Lauf vorhanden) — keine Mockups:

- 1024×768
- 1366×768
- 1920×1080
- 6-Spieler-Ansicht (bei 1280×800)

Zusätzlich beiläufig mitgeprüft (nicht explizit gefordert, aber zur Sicherheit gegen
Regressionen): 320×568, 360×800, 390×844, 430×932, 844×390 und 932×430 (REMOTE_MOBILE_FULL)
— alle optisch identisch zum vorherigen QA-Stand, da sämtliche Änderungen ausschließlich
`variant="full"`/`.discard-stage:not(.discard-stage--compact)`/`.game-table--table_device`
betreffen und damit REMOTE_MOBILE_FULL strukturell gar nicht erreichen können.

Zusätzlich verifiziert: Standard Action Focus (REVERSE) und Major Action Focus (ROTATE,
SKIP ALL) live mit der neuen, größeren Hero-Center-Geometrie durchgespielt — Headline
bleibt zentriert über der jetzt größeren Discard-Karte, nicht abgeschnitten, keine neue
Kollision mit dem Draw-Stack-Chip (bereits aus der vorherigen QA-Phase behobene
Überlappung bleibt behoben, siehe `08_TABLE_SKIP_ALL.png`).

## 4. Regressionstests

```
npx tsc -b        → 0 Fehler
npx vitest run    → 21 Testdateien, 218/218 Tests grün
npm run lint      → 0 neue Warnungen (1 vorbestehende in RoomPage.tsx, unverändert)
npm run build     → erfolgreich
```

Keine Test-Datei musste angepasst werden — `seatGeometry.test.ts` prüft weiterhin die
unveränderten Funktions-Defaults (43/37), die nur an der einen Aufrufstelle in
`PlayerRing.tsx` überschrieben werden.

## 5. Screenshot-Pfade

```
C:\Users\sophie\Documents\Sophies Programme\uno-show-em-no-mercy\qa\final\screenshots\
```

| Datei | Inhalt |
|---|---|
| `TABLE_1024x768_CENTER_FIX.png` | 1024×768 nach Fix |
| `TABLE_1366x768_CENTER_FIX.png` | 1366×768 nach Fix |
| `TABLE_1920x1080_CENTER_FIX.png` | 1920×1080 nach Fix |
| `TABLE_6_PLAYERS_CENTER_FIX.png` | 6-Spieler-Ansicht nach Fix |
| `07_TABLE_ROTATE.png` | Major Action Focus mit neuer Hero-Größe, korrekt zentriert |
| `08_TABLE_SKIP_ALL.png` | Major Action Focus, keine Chip-Kollision |
| `05_TABLE_STANDARD_ACTION.png` | Standard Action Focus mit neuer Hero-Größe |

(`TABLE_1024x768.png`, `TABLE_1366x768.png`, `TABLE_1920x1080.png`, `03_TABLE_6_PLAYERS.png`
ohne Suffix sind exakt dieselben Aufnahmen, unter den bereits aus der vorherigen QA-Phase
bekannten Dateinamen weiter vorhanden.)

## 6. Visuelle Abnahmeprüfung (Abschnitt 13/14 des Auftrags)

Jeder Screenshot wurde selbst angesehen, nicht nur erzeugt:

- ✅ Discard ist sofort der stärkste Blickfang (deutlich größer, kräftiger Schatten, Halo)
- ✅ Hero Center wirkt groß und bewusst, nicht mehr wie ein kleiner Punkt in der Mitte
- ✅ Draw klar sekundär (~55 % der Discard-Größe), nah am Discard
- ✅ Player Ring wirkt kompakt, spürbar näher am Zentrum als vorher
- ✅ Player Cards nicht am Außenrand verloren — lesbar, mit Bezug zum Zentrum
- ✅ keine große leere Mitte mehr
- ✅ keine Kollisionen (erste Iteration hatte eine, wurde vor Abschluss korrigiert — siehe
  Abschnitt 2)
- ✅ alle Namen und Kartenzahlen lesbar (4- und 6-Spieler-Ansicht geprüft)
- ✅ Orbit bleibt klar integriert, liegt jetzt sichtbar näher am kompakteren Ring
- ✅ Action Focus bleibt zentriert (ROTATE/SKIP ALL live mit neuer Größe geprüft)
- ✅ 6 Spieler passen sauber, keine Kollision

## 7. Restprobleme

Keine bekannten. Die neue Discard-Größe liegt an der unteren Grenze der vorgegebenen
35–60 %-Spanne — falls ein noch stärkerer Dominanzeindruck gewünscht ist, ist über
`DiscardStage.css`s `clamp(188px, 14vw, 222px)` (Discard) und `clamp(104px, 7.7vw, 122px)`
(Draw) weiter nach oben skalierbar, dann aber erneut gegen die Ring-Radien (`PlayerRing.tsx`)
und die Surface-Höhe (`GameTable.css`) prüfen, da genau diese Kombination in der ersten
Iteration dieses Fixes zu einer Kollision geführt hatte.

## HERO CENTER FIX:
**PASS**
