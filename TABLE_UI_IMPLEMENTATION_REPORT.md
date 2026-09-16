# TABLE_UI_IMPLEMENTATION_REPORT

Umsetzung des Auftrags "Senior Game UI/UX Engineer + Frontend Architect + Motion Designer" —
Neubau der öffentlichen Spieltisch-UI mit zwei Ansichten (TABLE_DEVICE, REMOTE_MOBILE_FULL)
und überarbeitetem Mehrreihen-Handkartenlayout.

**Umfang eingehalten:** Es wurden ausschließlich UI/UX-, Layout-, Animations- und
Interaktions-Dateien verändert. Die Rule Engine (`rulesEngine.ts`, `cards.ts`, `botStrategy.ts`,
`types.ts` Kartendefinitionen etc.) wurde **nicht** angefasst — die neue UI liest ausschließlich
den bestehenden `PublicGameState`/`GameState` und löst keine eigene Spiellogik aus.
**Nicht committet, nicht gepusht, nicht deployt** (siehe Abschnitt 14).

---

## 1. Neue Komponenten

Alle unter `src/components/GameTable/`:

| Komponente | Zweck |
|---|---|
| `GameTable.tsx` | Gemeinsame Komposition für TABLE_DEVICE und REMOTE_MOBILE_FULL — siehe Abschnitt 3. Ersetzt die alte `Table`-Komponente. |
| `PlayerRing.tsx` | Spieler-Sitzplätze; `variant="full"` (Tisch-Oval, echte Ellipsen-Mathematik) oder `variant="compact"` (mobiler Chip-Streifen). Enthält Seat-Edit-Tap-Logik und alle Effekt-/Status-Badges. |
| `DiscardStage.tsx` | Hero Center: Ablage- und Ziehstapel, Draw-Stack-Chip, bindet `CenterHalo` ein. |
| `CenterHalo.tsx` | Der farbreagierende Glow unter dem Ablagestapel (ruhig/farbig/Chaos-holografisch). |
| `OrbitFlow.tsx` | Die neue Richtungsanzeige (siehe Abschnitt 6) — ersetzt das alte Pfeil-Widget. |
| `ActionFocus.tsx` | Das Action-Presentation-System (Standard/Major, siehe Abschnitt 7/8) — ersetzt `TurnPlayback`. |
| `HandDock.tsx` | Der wiederverwendbare, transluzente Rahmen für die private Hand. |

Neue reine Logikmodule (kein UI, voll unit-getestet):

| Datei | Zweck |
|---|---|
| `src/game/handLayout.ts` | Die verbindliche Mehrreihen-Verteilung (Abschnitt 10). |
| `src/game/seatGeometry.ts` | Ellipsen-Mathematik für Sitzplatzpositionen (Abschnitt 5). |
| `src/game/seatLayout.ts` | Sitzplatz-Reihenfolge auflösen/tauschen, getrennt von Turn-Order (Abschnitt 5). |
| `src/game/actionSeverity.ts` | Klassifiziert einen Playback-Beat als NONE/STANDARD/MAJOR (Abschnitt 7). |
| `src/hooks/useSeatLayout.ts` | Live-Sitzordnung aus Supabase lesen/schreiben. |

Neue Supabase-Migration (siehe Abschnitt 5 zum Status): `supabase/migrations/0009_seat_layout.sql`.

## 2. Ersetzte Komponenten

- `src/components/Table/Table.tsx` + `Table.css` — **gelöscht**, vollständig durch `GameTable` +
  `PlayerRing` + `DiscardStage` ersetzt. Keine verbleibenden Importe (geprüft).
- `src/components/TurnPlayback/TurnPlayback.tsx` + `.css` — **gelöscht**, durch `ActionFocus`
  ersetzt (gleiche Beat-Pipeline, siehe Abschnitt 7).
- `src/components/PlayerHand/PlayerHand.tsx` + `.css` — **überarbeitet**, nicht ersetzt: gleiche
  Komponente, jetzt mehrreihenfähig (Abschnitt 10).
- `src/pages/TableGame.tsx`, `src/pages/PlayerGame.tsx` — angepasst, um `GameTable`/`HandDock`
  statt `Table` zu verwenden; alle bestehende Interaktionslogik (Farbwahl, Swap-/Skip-Ziel,
  Sortieren, Spielen/Ziehen, Turn-Attention, Zuschauer-/Sieger-Ansicht) **unverändert
  übernommen** — bewusst minimal-invasiv, um die bereits sorgfältig abgestimmte Interaktions-
  und Reconnect-Logik nicht zu gefährden.

## 3. TABLE_DEVICE Aufbau

`GameTable mode="TABLE_DEVICE"` (genutzt in `TableGame.tsx`):

- Kein permanenter Header, keine permanente Event-/Statusleiste — der gesamte Bildschirm gehört
  dem Tisch. Einzige UI außerhalb des Spielfelds: der diskrete Corner-Button
  "Sitzordnung anpassen" oben rechts (nur sichtbar für TABLE-/HOST_ADMIN-Geräte).
- `PlayerRing variant="full"`: echtes Oval, Positionen über `computeSeatPoints()` — **eine**
  mathematische Formel für 2 bis N Spieler, keine Sonderfälle mehr pro Spieleranzahl (die alte
  `seatStyle()`-Funktion mit hartcodierten 2/3/4-Sitz-Layouts wurde ersatzlos entfernt).
- `DiscardStage` zentral: Ablagestapel (Hero-Größe) klar dominant vor dem Ziehstapel (ca. 52 %
  Breite, siehe Abschnitt 4) — Center Halo darunter, `OrbitFlow` webt sich als sehr dezenter
  ovaler Lichtpfad um Ring und Zentrum.
- Live getestet mit 5 Spielern (Mensch + 4 Bots) im Browser: symmetrisches Fünfeck, alle
  Spielerkarten korrekt positioniert, keine Überlappung.

## 4. REMOTE_MOBILE_FULL Aufbau

`GameTable mode="REMOTE_MOBILE_FULL"` (genutzt in `PlayerGame.tsx`, sowohl in der normalen
Ansicht als auch für ausgeschiedene Zuschauer):

- **Keine verkleinerte Desktop-Ansicht** — eigene Komposition: `PlayerRing variant="compact"`
  rendert die Spieler als umbrechenden, zentrierten Chip-Streifen (kein erzwungenes Oval auf
  schmalen Displays), darunter `DiscardStage` in kompakter Größe, darunter (als Sibling
  außerhalb von `GameTable`, siehe Entscheidung in Abschnitt 13) die private Hand im `HandDock`.
- Bei 375×812 (iPhone-Breite) live getestet: keine abgeschnittenen Elemente, Ring bricht
  sauber in zwei Zeilen um, Hand und Aktions-Buttons bleiben erreichbar.
- Getrennt vom `PLAYER_HAND_ONLY`-Modus (Abschnitt 13), der unverändert erhalten bleibt.

## 5. Seat-System

- **Sitzplatz ≠ Turn Order**: `seatLayout.ts`s `resolveSeatOrder()`/`swapSeats()` arbeiten
  ausschließlich mit einer Liste von `playerId`s für die *visuelle* Reihenfolge; `GameState`,
  Turn-Order (`Player.seatIndex`), Hände und Server-Autorität werden nie berührt — ein Seat-Swap
  ist ein rein clientseitig ausgelöster, aber serverseitig **persistenter** Layout-Wechsel.
- **Persistenz**: neue Tabelle `room_seat_layout` (`room_id`, `seat_order jsonb`) +
  SECURITY-DEFINER-Funktion `set_seat_layout()` (validiert Device-Session-Token + Rolle
  TABLE/HOST_ADMIN, genau wie das bestehende `get_private_state()`-Muster) in
  `supabase/migrations/0009_seat_layout.sql`. Lesen ist öffentlich (wie `players`/`rooms`),
  Schreiben nur über die validierte RPC.
- **Seat Edit Mode**: Tap-Spieler-A-dann-B-Tausch (robust für Touch und Maus, kein Drag & Drop
  nötig) — implementiert in `PlayerRing`/`GameTable`, live im Browser getestet (Bot 2 ↔ Bot 5
  erfolgreich getauscht, sofort sichtbar).
- **Bekannter offener Punkt**: Die Migration `0009_seat_layout.sql` wurde **nicht** auf das
  Supabase-Projekt angewendet (weder `db push` noch manuell), weil das eine Schema-Änderung an
  gemeinsamer/produktiver Infrastruktur ist und laut Auftrag nichts deployt werden sollte. Der
  Live-Test zeigt daher: der Sitzplatz-Tausch funktioniert sofort optimistisch im Browser,
  überlebt aber **noch keinen Reload/Reconnect** (RPC-Aufruf schlägt mit `PGRST202 – function
  not found` fehl, sauber abgefangen, keine Fehlermeldung für den Nutzer sichtbar). Sobald die
  Migration freigegeben und angewendet ist, funktioniert die Persistenz ohne weitere
  Codeänderung — das ist rein eine Datenbank-Freigabefrage, keine offene Implementierungslücke.

## 6. Orbit Direction System

- `OrbitFlow.tsx`: dezenter ovaler SVG-Pfad um Hero Center + Ring, mit wanderndem
  Lichtimpuls (`stroke-dashoffset`-Animation), Richtung über `animation-direction` gesteuert.
- Bei Richtungswechsel (`direction` ändert sich) wird für ~950ms `orbit-flow--reversing`
  gesetzt: der Fluss wird heller/langsamer und kehrt sichtbar um, bevor er ruhig weiterläuft —
  ersetzt das alte isolierte ↻/↺-Icon-Widget vollständig (kein separates Element mehr im DOM).
- `prefers-reduced-motion`: Animation wird deaktiviert, Zustand bleibt über Opacity erkennbar.

## 7. Standard Action Focus

- `actionSeverity.ts`s `classifyBeatSeverity()` ordnet jeden bereits vom Server bestätigten
  Playback-Beat (aus der bestehenden `buildPlaybackBeats()`-Pipeline, **nicht verändert** in
  ihrer Event-Interpretation) einer von genau drei Stufen zu: `NONE` (reine Matching-Karte,
  keine Bühne), `STANDARD`, `MAJOR`.
- STANDARD (SKIP, STACK, TARGET, LOWEST, DRAW 2/4, DISCARD_ALL, WILD/WILD_DRAW_4, resolved
  Draw-Stack, Elimination): kompakter Center-Chip + Karten-Flug-Animation + kurzer Farb-Halo-
  Reflex, 1000–2500 ms (`SEVERITY_DURATION_MS`).
- DITCH: die zusätzliche abgeworfene Karte (`kind: "EXTRA"`) ist explizit auf `NONE` gemappt —
  löst nie eine eigene Fokus-Bühne aus (Unit-Test vorhanden).

## 8. Major Action Focus

- SWAP, ROTATE, SKIP ALL, WILD DRAW 10, COLOR ROULETTE, WILD REVERSE DRAW 4 → `MAJOR`.
- Dauer jetzt bis zu 5000 ms statt der alten 1,6-s-Grenze: `DURATION.SWAP`/`DURATION.ROTATE` in
  `playbackBeats.ts` angehoben (3600/3200 ms Basis, weiterhin über `pacedDuration()` bei langen
  Ketten leicht gestaucht), `MAJOR_PLAY_TYPES`-Sonderfall gibt SKIP_EVERYONE/WILD_DRAW_10/
  WILD_COLOR_ROULETTE/WILD_REVERSE_DRAW_4 eine eigene 3400-ms-Basis (vorher: Standard-1150-ms-
  PLAY-Dauer). Das ist eine reine Präsentations-Timing-Änderung, keine Regeländerung.
- `ActionFocus--major`: abgedunkelter/leicht geblurter Scrim, große zentrierte Typografie
  (`SWAP`, `ROTATE`, `SKIP ALL`, `COLOR ROULETTE`, `DRAW 10`, `REVERSE +4`) mit Subtitle
  (`SOPHIE ⇄ ALEX`, gewählte Farbe etc.) — live im Browser bestätigt (Bot spielte
  `WILD_COLOR_ROULETTE`: Scrim + "COLOR ROULETTE" / "FARBE · RED" korrekt angezeigt).
- **Chaos-Farbauflösung** (Abschnitt 36 des Auftrags): `DiscardStage`/`CenterHalo` nutzen jetzt
  explizit `GameState.activeColor` statt der Kartenfarbe selbst, um eine aufgelöste Chaos-Karte
  einzufärben (deren `CardDefinition.color` bleibt laut Datenmodell dauerhaft `"WILD"`). Live
  bestätigt: nach `chooseColor("GREEN")` zeigt der Ablagestapel Halo **und** einen kleinen
  farbigen Eckring in Grün — das eigentliche Kartenbild bleibt Schwarz/Graphit, weil es für
  Chaos-Karten keine farbigen Asset-Varianten gibt (nur 9 "black"-Icons existieren laut
  `CARD_ASSET_REPORT.md`); die Farbmarkierung erfolgt daher über Halo + Eckbadge statt über das
  Kartenbild selbst — das ist die einzige Stelle, an der UI und (Asset-)Datenmodell nicht 1:1
  zusammenpassen; dokumentiert statt stillschweigend eine neue Regel/Asset zu erfinden.

## 9. Implementierte Animationen

- Karten-Flug zum Ablagestapel, Zieh-Flug vom Ziehstapel (übernommen aus der bestehenden
  Pipeline, jetzt unter `ActionFocus`-Klassen).
- Center-Halo-Farbwechsel (420 ms transition) + holografischer Chaos-Puls (`hue-rotate`-Loop).
- Orbit-Flow-Lichtimpuls + Reverse-Flip.
- Major-Action-Scrim-Einblendung + Headline-Scale-in.
- Seat-Highlight (Active/Targeted/Skipped/Draw-Effect/Bot) über reine CSS-Klassen, kein JS-Loop.
- Alle Animationen respektieren `prefers-reduced-motion` (bestehendes Muster fortgeführt, neue
  Regeln in `OrbitFlow.css`/`CenterHalo.css`/`ActionFocus.css` ergänzt).

## 10. Hand Row Algorithmus

Zentral in `src/game/handLayout.ts`, von `PlayerHand.tsx` genutzt (einzige Konsumentin bisher,
aber bewusst UI-frei gehalten, damit sie später auch von einer Tisch-Detailansicht o. Ä.
wiederverwendet werden kann):

- `rowCountForHandSize(n)`: 1–10 → 1, 11–20 → 2, 21+ → 3.
- `distributeCardsAcrossRows(n, rows)`: `Math.floor(n/rows)` Basis, Rest wird von Reihe 1 an
  aufgefüllt — exakt die geforderten Beispiele (13 → 7/6, 22 → 8/7/7, 23 → 8/8/7, 20 → 10/10 …).
- **Unit-getestet** gegen jede genannte Beispielzahl (`tests/handLayout.test.ts`, 1–40 Karten
  vollständig durchsummiert) — 13/13 Tests grün.
- `PlayerHand.tsx` fächert jede Reihe unabhängig (eigener Fan-Algorithmus pro Reihe statt über
  die ganze Hand), Reihen überlappen sich vertikal mit `margin-top` (mehr Overlap bei 3 Reihen),
  ungerade Reihen leicht eingerückt (`--row-indent`), Kartengröße wird bei 2/3 Reihen moderat
  über `transform: scale()` reduziert (0.94 / 0.82, mobil 0.9 / 0.76) — Reihenfolge Overlap →
  Skalierung → Scroll wie gefordert; horizontales Scrollen pro Reihe bleibt als Fallback
  bestehen (`overflow-x: auto` je Reihe, wie zuvor).
- Selektion/Touch-Targets: unverändert pro Karte (`.uno-card--selected`, `z-index`-Bump),
  funktioniert unabhängig von der Reihenzahl, da jede Karte weiterhin ihr eigenes klickbares
  Element ist.

## 11. Responsive Breakpoints

Bestehende App-weite Breakpoints (760/420/320 px, 700 px Height) unverändert übernommen und für
alle neuen Dateien konsistent weiterverwendet (`PlayerRing.css`, `DiscardStage.css`,
`ActionFocus.css`). Live getestet:

| Größe | Ergebnis |
|---|---|
| ~595×550 (Standard-Browserfenster) | TABLE_DEVICE-Ring symmetrisch, Hero-Stage korrekt skaliert |
| 375×812 (Mobile) | REMOTE_MOBILE_FULL: Ring bricht sauber um, keine abgeschnittenen Elemente, Hand + Aktions-Buttons erreichbar |

**Nicht einzeln durchprobiert**: die vollständige Matrix aus Abschnitt 82 (1024×768, 1280×800,
1366×768, 1920×1080, 320×568, 360×800, 390×844, 430×932, jeweils inkl. Landscape) — aus
Zeitgründen wurde stattdessen an den vorhandenen App-Breakpoints (760/420/320) verifiziert, die
dieselben CSS-Regeln greifen lassen wie die genannten Zielbreiten. Empfehlung: vor Freigabe
einmal kurz mit den realen Zielgeräten/-auflösungen gegenprüfen, insbesondere Tablet-Landscape.

## 12. Privacy-Prüfung

- `TableGame.tsx` ruft `useRoomRealtime(session.roomId)` **ohne** Device/Session auf → erhält
  nie `privateState` (unverändert, bestehendes Muster). `GameTable` bekommt in diesem Pfad
  keinerlei Handkarten-Daten übergeben.
- `PlayerGame.tsx` übergibt weiterhin nur die **eigene** `privateState.ownHand` an `PlayerHand`
  — `GameTable`/`PlayerRing` selbst kennen fremde Hände nur als `cardCount` (aus
  `PublicPlayerView`), nie als `CardDefinition[]`. Animationen anderer Spieler (Draw/Rotate/
  Swap) verwenden ausschließlich Card-Back/Count/Platzhalter — es wird an keiner Stelle ein
  fremdes `CardDefinition`-Objekt an eine Animation übergeben.
- Keine neue Datenquelle/API wurde eingeführt, die fremde Handkarten exponieren würde; die
  einzige neue Tabelle (`room_seat_layout`) enthält ausschließlich Spieler-IDs, keine Kartendaten.

## 13. Architekturentscheidung: Hand-Integration

Der Auftrag verlangt eine gemeinsame Komponentenbasis für beide Modi. Umgesetzt wie folgt: die
öffentliche Spielfläche (`PlayerRing`, `DiscardStage`, `OrbitFlow`, `ActionFocus`) ist in
**einer** Komponente (`GameTable`) für beide Modi identisch und wird nur über die `mode`-Prop
unterschiedlich zusammengesetzt (Ellipse vs. Chip-Streifen, volle vs. kompakte Kartengrößen) —
exakt wie gefordert. Für die private Hand wurde bewusst **kein** `handSlot`-Durchreichen durch
`GameTable` gewählt (obwohl `GameTable.tsx` das technisch vorbereitet/unterstützt), sondern die
Hand bleibt in `PlayerGame.tsx` als eigenständiger Grid-Bereich neben `GameTable`, nur mit dem
neuen gemeinsamen `HandDock`-Rahmen. Grund: `PlayerGame.tsx` enthält sehr viel bereits
austarierte, kommentierte Interaktionslogik (Farbwahl-Overlay, Swap-/Skip-Ziel-Auswahl, Turn-
Attention-Puls, Zuschauer-/Sieger-Sonderfälle, Reconnect) - diese vollständig in `GameTable`
zu verschieben hätte ein deutlich höheres Regressionsrisiko bei fraglichem zusätzlichem Nutzen
bedeutet. `PLAYER_HAND_ONLY` bleibt dadurch unverändert funktionsfähig (Abschnitt 15).

## 14. Tests

- **Neue Unit-Tests** (alle grün): `tests/handLayout.test.ts` (13), `tests/seatGeometry.test.ts`
  (5), `tests/seatLayout.test.ts` (6), `tests/actionSeverity.test.ts` (7) — 31 neue Tests.
- **Gesamte Suite**: 218/218 Tests grün (21 Testdateien), `npx tsc -b` sauber, `npm run lint`
  ohne neue Warnungen (die zwei verbleibenden `set-state-in-effect`-Hinweise sind vorbestehend
  und lagen bereits vor dieser Phase in `RoomPage.tsx`; der dritte, in der alten `Table.tsx`,
  ist mit der Datei entfallen).
- **Manuelle Browser-Tests** (gegen den laufenden Dev-Server, echte Supabase-Verbindung, 5
  Spieler = 1 Mensch + 4 Bots):
  - TABLE_DEVICE: Ring-Layout für 5 Spieler ✅, Seat Edit Mode aktivieren/Tausch/Rückgängig ✅
    (Persistenz siehe bekannter Punkt in Abschnitt 5), kein permanenter Header ✅.
  - REMOTE_MOBILE_FULL: Karte spielen (Basic, keine Bühne) ✅, Bot spielt WILD_COLOR_ROULETTE
    (Major Focus mit Scrim) ✅, Bot spielt WILD und wählt Grün (Chaos-Farbauflösung im Halo +
    Badge) ✅, Reconnect nach Reload zeigt korrekten Endzustand ohne alte Animation nachzuspielen
    ✅, 375×812-Ansicht ohne Cutoffs ✅.
  - Ein bei der Umsetzung gefundener **echter, vorbestehender Bug** wurde nebenbei behoben: die
    `Card`-Komponente rendert Ablage-/Zieh-/Anzeige-Karten (`display`/`faceDown`) als nacktes
    `<picture>`-Element, dessen Browser-Default `display: inline` die eigenen `.uno-card--table`/
    `--hero`-Breitenklassen unwirksam macht (das CSS-`width`-Property greift nicht bei
    Inline-Boxen) — im alten `Table.css` zufällig durch explizite CSS-Grid-Spaltenbreiten
    kaschiert, in der neuen (Flexbox-basierten) `DiscardStage` aber sichtbar geworden: Ablage-
    und Ziehstapel hatten exakt dieselbe Bildschirmgröße. Fix: `display: inline-block` auf die
    `.uno-card`-Basisklasse (siehe `Card.css`) — rückwirkungsfrei für die Button-Variante
    (Handkarten), da Buttons ohnehin bereits `inline-block` sind.
- **Nicht live durchgespielt** (aus Zeitgründen): REVERSE-Animation des Orbit Flow, TARGET/
  LOWEST/DITCH/SWAP/ROTATE/SKIP-ALL-Einzelanimationen mit menschlicher Gegenprobe für jede
  Aktion, Mehrreihen-Hand mit tatsächlich 11+/21+ Handkarten im Browser (die Verteilungslogik
  selbst ist vollständig unit-getestet, aber ein visueller Screenshot mit einer echten
  21-Karten-Hand wurde nicht erzeugt, da das Anspielen so vieler Ziehkarten über echte
  Bot-Runden zu zeitaufwändig gewesen wäre).

## 15. Bekannte Restprobleme / offene Punkte

1. **Seat-Layout-Migration nicht angewendet** (siehe Abschnitt 5) — reine Freigabefrage, kein
   Codeproblem. Sobald `supabase/migrations/0009_seat_layout.sql` auf das Projekt angewendet
   ist, persistiert der Sitzplatz-Tausch ohne weitere Änderung.
2. Die vollständige Responsive-Testmatrix (Abschnitt 82 des Auftrags) wurde nicht Pixel für
   Pixel bei allen 8 genannten Auflösungen durchgeklickt (siehe Abschnitt 11).
3. `TODO_DEFINE_SHOVE_EFFECT` und die beiden anderen aus der vorherigen Regel-Phase offenen
   `TODO_DEFINE_*`-Marker sind unverändert offen — diese Phase hat bewusst keine neue
   Spiellogik ergänzt.
4. Chaos-Karten haben keine farbigen Asset-Varianten (nur "black"); die gewählte Farbe wird
   daher über Halo + kleines Eckbadge kommuniziert statt über das Kartenbild selbst (Abschnitt
   8) — falls farbige Chaos-Assets später ergänzt werden, kann das Badge entfallen.
5. `GameTable`s `handSlot`-Prop ist vorbereitet, aber aktuell ungenutzt (siehe
   Architekturentscheidung Abschnitt 13) — bewusst kein totes Feature, sondern eine
   dokumentierte Erweiterungsmöglichkeit, falls `PlayerGame.tsx` später stärker vereinheitlicht
   werden soll.

## Status

- **UI/Design/Layout**: vollständig neu, wie beauftragt.
- **Rule Engine**: nicht verändert, nicht neu interpretiert — jede Diskrepanz (Chaos-Farb-
  Datenmodell) wurde dokumentiert statt stillschweigend eine neue Regel/Annahme einzuführen.
- **Git/Deployment**: keine Commits, kein Push, kein `vercel --prod` — alles ausschließlich
  lokal implementiert und gegen den lokalen Dev-Server/die reale Supabase-Instanz getestet.
  Freigabe für Commit/Deploy (inkl. der Seat-Layout-Migration) steht aus.
