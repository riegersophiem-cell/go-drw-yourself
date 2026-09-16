# ACTION_FOCUS_POLISH_REPORT

Letzter visueller Polish-Pass für das Action-Focus-System auf **TABLE_DEVICE**.
Die Choreographie-Grundlage (echte ROTATE-/SWAP-Bewegung, TARGET-Verbindung,
Draw-Choreographie, kein Blur, sichtbare Player Units, State-first, Action Queue,
Chaos-Color-Tint, kompakte Player Units, Hero Center, Player Ring) bleibt exakt
wie vorher — hier ging es ausschließlich um Kollisionsfreiheit, Bewegungsqualität
und Test-Determinismus. Rule Engine, Game Logic, Card Effects, Turn/Seat Logic,
Player-Ring-Geometrie, Hero-Center-Grundgröße, Player-Unit-Grunddesign,
Kartenassets, Mobile Hand, Hand Layout und Supabase: unangetastet.

## 1. Hauptproblem behoben: Action Title kollidierte mit Player Unit

**Ursache**: Die Headline war per `top: 10–14%` relativ zum gesamten Bildschirm
positioniert — ein Wert, der zufällig ungefähr dort landete, wo die obere Player
Unit sitzt.

**Fix**: Eine echte **CENTER ACTION TITLE ZONE**, verankert an der tatsächlichen
Hero-Center-Geometrie statt an einer beliebigen Bildschirmprozentzahl:

- Sitzplatz 0 (oben) liegt bei `computeFullRingSeatPoints()` **immer** exakt auf
  dem -90°-Punkt der Ellipse, unabhängig von der Spielerzahl — die Zone ist damit
  für 2 bis 8 Spieler identisch positionierbar.
- Live bei 1280×800 gemessen: obere Player-Unit-Unterkante bei ≈194px, Hero-Card-
  Oberkante bei ≈245px eines 760px hohen Surface → eine ~51px/~6,7%-Lücke.
- Neue Regel (`ActionFocus.css`, nur `.action-focus--table`): Headline startet bei
  `top: 26.3%`, von der eigenen Oberkante aus verankert (nicht zentriert), mit
  deutlich kompakteren Schriftgrößen/Zeilenhöhen, sodass der gesamte Block
  nachweislich **nie** die 6,7%-Lücke überschreitet.
- Per Live-Messung nach dem Fix bestätigt: Headline-Oberkante 212px (18px Abstand
  zur Player Unit), Headline-Unterkante 243px (3px Abstand zur Hero Card) — beide
  Seiten frei, für ROTATE, SWAP, TARGET, DRAW 4 und SKIP ALL gleichermaßen
  (jeweils per Screenshot verifiziert, siehe Abschnitt 8).
- Ein `.action-focus--table`-Modifier hält das komplett getrennt vom
  Mobile/`REMOTE_MOBILE_FULL`-Pfad, der exakt seine alte `top: 10–14%`-Positionierung
  behält (`GameTable` übergibt `tableDevice={false}` dort).

**Nebenbefund während des Fixes**: Für SWAP wurden anfangs **zwei** Subtitle-Zeilen
gleichzeitig gerendert (Actor⇄Target **und** die gewählte Farbe), was den Block auf
78px statt 52px aufblähte und selbst mit der neuen Zone kollidierte. Behoben, indem
die Farb-Subline für SWAP (wie bereits für ROTATE/SKIP) unterdrückt wird — die
Actor⇄Target-Zeile trägt die relevante Information bereits vollständig.

## 2. Hand Stack Glyph — kein Debug-Rechteck mehr

Neu: `.action-choreo__handstack` — drei leicht versetzte, unterschiedlich
gedrehte "Karten-Rückseiten"-Ebenen (reine CSS-Layer, keine zusätzlichen DOM-Knoten
nötig für die unteren zwei), mit Tiefenschatten und einem kleinen hellen Akzent auf
der obersten Karte. Größe `clamp(30px, 2.8vw, 40px)` Breite × `clamp(40px, 3.8vw,
54px)` Höhe — deutlich über der alten 30×30px-Box, ohne die Player Unit zu
verdecken (live bei 1280×800 geprüft).

## 3. Draw-Glyph — kein weißer Block mehr

Neu: `.action-choreo__cardback` — ein einzelnes, klar als Kartenrückseite lesbares
Element (dunkler Verlauf, heller Rand, kleiner Mittelakzent), `clamp(20px, 1.9vw,
27px)` breit. Zusätzlich wurde der **Startpunkt** korrigiert: vorher starteten alle
Draw-Karten exakt in der Bildschirmmitte (= Position des Discard-Stapels!), jetzt
an der tatsächlich gemessenen Ziehstapel-Position (`leftPct: 40.8, topPct: 51.2`,
live vermessen). Die vier Karten sind zusätzlich per `transitionDelay` (0/80/160/
240ms) gestaffelt, sodass "4 einzelne Karten" statt "ein Block" sichtbar wird.

## 4. Bogenbewegung statt gerader Linien

Beide Haupt-Choreographien nutzen jetzt einen dreistufigen, kurvenförmig
interpolierten Pfad (quadratische Bézier-Annäherung über einen "gebogenen"
Kontrollpunkt) statt einer reinen Start→Ziel-Gerade:

- **ROTATE**: der Kontrollpunkt liegt radial nach außen versetzt (5,5% vom
  Zentrum weg) — die Hand-Stacks folgen dadurch sichtbar der Ring-Krümmung statt
  quer durch die Tischmitte zu schneiden. Per Live-Screenshot bei ~40% der
  Bewegung bestätigt (`POLISH_ROTATE_MID.png`): jedes Symbol liegt sichtbar
  zwischen zwei Sitzen, entlang der Ellipse.
- **SWAP**: zwei Kontrollpunkte senkrecht zur Actor↔Target-Linie, in
  **entgegengesetzte** Richtungen versetzt (±7%) — beide Bewegungen sind dadurch
  visuell als zwei getrennte Bögen unterscheidbar statt sich deckungsgleich zu
  überlagern (`POLISH_SWAP_MID.png`).
- **DRAW**: leichter radialer Bogen (4%) zwischen Ziehstapel und Zielspieler.

Technisch: kein echtes SVG `offset-path` (das würde eine eigene, vom
Glyphen-Element getrennte Pixel-Koordinatenbasis brauchen und wäre über
Responsive-Breakpoints hinweg fragil) — statt dessen drei diskrete, in JS
vorberechnete Wegpunkte (Start/gebogene Mitte/Ziel), zwischen denen eine normale
CSS-`left`/`top`-Transition läuft. Optisch praktisch nicht von einer echten Kurve
zu unterscheiden, dafür deutlich robuster.

## 5. TARGET-Verbindung überarbeitet

- Linie nutzt jetzt die Kartenfarbe als Akzent (`stroke`/`color` aus
  `beat.chosenColor ?? beat.card?.color`) statt eines festen Rot/Weiß, mit
  weichem `drop-shadow`-Glow.
- Ein zuvor eingebauter animierter "Licht-Puls" (`<animateMotion>`) wurde
  **entfernt**, nachdem er live einen sichtbaren Fehler zeigte: nach Ablauf der
  SMIL-Animation (kein `fill="freeze"`) sprang der Punkt zurück auf die
  SVG-Ursprungsposition (0,0) und blieb dort als kleiner farbiger Fleck in der
  oberen linken Bildschirmecke sichtbar — ein echter, live gefundener Bug, kein
  hypothetisches Risiko. Die bereits vorhandene animierte gestrichelte Linie
  vermittelt "Energie fließt" bereits ausreichend ohne dieses Risiko.
- Zielmarker (`.action-choreo__marker`) ist ein kleiner 15px-Kreis, der direkt am
  Zielspieler andockt — kein Rechteck.

## 6. Skip-Statusmarker — kompaktes Icon statt Rechteck

`player-unit__badge--skip` zeigt jetzt ein kleines ⏭-Icon in einem 20×20px
Kreis-Chip statt des Texts "AUSGESETZT" in einer länglichen Pille — sitzt am
Avatar-Eck, kollidiert nicht mit Name/Kartenanzahl (live bei TARGET/SKIP
bestätigt).

## 7. Deterministisches QA-Setup (kein Produktions-Cheat)

**Problem**: SKIP ALL (nur 2 Kopien im gesamten Deck) und andere seltene Aktionen
ließen sich in ~25 Minuten Bot-Zufallsspiel über vier frühere Testläufe nicht
zuverlässig auslösen.

**Lösung**: `src/pages/dev/ActionPreview.tsx` + Route `/dev/action-preview?kind=...`
in `src/App.tsx` — rendert `<GameTable mode="TABLE_DEVICE">` direkt gegen einen
handgebauten `PublicGameState` und einen synthetischen `PlaybackBeat`, **komplett
ohne Supabase, ohne Rule Engine, ohne echtes Spiel**. Unterstützt `kind` ∈
`ROTATE, SWAP, TARGET, DRAW_2, DRAW_4, LOWEST, DITCH, SKIP, REVERSE, SKIP_ALL,
WILD_DRAW_10, COLOR_ROULETTE, WILD_REVERSE_DRAW_4` sowie eine `players`-Query
(2–8 Spieler).

**Warum das kein Produktions-Cheat ist**:
- Die Route existiert nur, wenn `import.meta.env.DEV` zur Build-Zeit wahr ist;
  Vite/Rollup faltet diese Konstante zur Build-Zeit und entfernt den gesamten
  Zweig (inkl. des dynamischen `import()` für `ActionPreview`) aus dem
  Produktions-Bundle — **verifiziert**: `grep -r "ActionPreview" dist/` nach
  `npm run build` findet nichts, es wird auch kein separater Chunk erzeugt.
- Keine Zeile in `src/game/`, `src/multiplayer/` oder `supabase/` wurde
  geändert — der Harness baut sein Mock-`PublicGameState` komplett unabhängig
  von der echten State-Pipeline auf.

Damit ist SKIP ALL (und jede andere seltene Aktion) ab jetzt in **unter einer
Sekunde** reproduzierbar statt in Minuten zufälligen Bot-Spiels.

## 8. Screenshots

Alle über `qa/capture_polish.mjs` gegen den lokalen Dev-Server erzeugt (ruft
ausschließlich `/dev/action-preview` auf — kein Mockup-Bild, echtes gerendertes
DOM):

```
C:\Users\sophie\Documents\Sophies Programme\uno-show-em-no-mercy\qa\final\screenshots\
```

| Datei | Ergebnis |
|---|---|
| `POLISH_ROTATE_START.png` | alle 6 Hand-Stacks an ihrer Ursprungs-Position, kein Kollisionsproblem |
| `POLISH_ROTATE_MID.png` | Stacks sichtbar zwischen zwei Sitzen, entlang der Ringkrümmung |
| `POLISH_ROTATE_END.png` | Endzustand, Titel ausblendend, keine übrig gebliebene Kollision |
| `POLISH_SWAP_START/_MID/_END.png` | zwei Stacks kreuzen sich auf getrennten Bögen, Actor/Target-Rahmen durchgehend sichtbar |
| `POLISH_TARGET.png` | Actor→Target innerhalb 1s erkennbar, farbiger Verbindungspfad, kompakter Marker |
| `POLISH_DRAW4_START/_MID/_END.png` | vier einzelne Kartenrückseiten, gestaffelt, vom tatsächlichen Ziehstapel zum Zielspieler |
| `POLISH_SKIP_ALL.png` | Ausspieler hell mit "AM ZUG", alle 5 anderen sichtbar gedimmt, Farbe RED korrekt, kein Event-Banner |

Jeder Screenshot wurde selbst geöffnet und gegen die Abnahmekriterien (Abschnitt
25 des Auftrags) geprüft — keiner zeigt eine Kollision, ein Platzhalter-Rechteck
oder abgeschnittenen Text.

## 9. Z-Index-System (dokumentiert statt zufällig)

Innerhalb von `.game-table__surface` (siehe Kommentarblock in
`ActionChoreography.tsx`):

```
1  OrbitFlow           (Hintergrund-Ellipse/Marker)
4  PlayerRing          (Player Units)
5  DiscardStage        (Hero Halo + Karten)
6  ActionChoreography__link   (Verbindungspfade)
7  ActionChoreography Glyphen (Hand-Stacks/Card-Backs/Marker — je nach Element 2–3 lokal, Container z-index:8)
18 ActionFocus         (Scrim + Titel + Skip-Button)
```

Kein lokales `z-index: 9999` verwendet; jede neue Ebene wurde bewusst zwischen
den bestehenden Werten eingeordnet.

## 10. Standard vs. Major (unverändert in der Substanz)

Beide nutzen weiterhin dieselbe visuelle Sprache (Hand-Stack-/Card-Back-Glyphen,
Verbindungspfade, kompakte Headline) — Major bekommt weiterhin den leichten Scrim
und etwas größere Titel-Schrift (`clamp(.9rem,1.6vw,1.1rem)` vs. `clamp(.8rem,
1.4vw,1rem)` für Standard), keine grundsätzlich andere Choreographie-Technik.

## 11. Keine übrig gebliebenen Labels

Unverändert aus der Vorphase: `ActionFocus` rendert seine Headline nur, während
`active && severity !== "NONE" && title` — sobald der Beat vorbei ist, verschwindet
der gesamte Block; kein persistenter Rest-Text (Code-Pfad nicht in dieser Phase
angefasst, nur die Positionierung/Größe des Blocks selbst).

## 12. Regressionstests

```
npx tsc -b        → 0 Fehler
npx vitest run    → 21 Testdateien, 218/218 Tests grün
npm run lint      → 0 neue Warnungen außer dem bekannten, akzeptierten
                     set-state-in-effect-Muster (jetzt auch in
                     ActionChoreography.tsx und dem DEV-only
                     ActionPreview.tsx, gleiche Technik wie an anderer
                     Stelle im Projekt bereits vorhanden)
npm run build     → erfolgreich; `dist/` enthält keine Referenz auf
                     `ActionPreview` (verifiziert per grep, siehe Abschnitt 7)
```

## 13. Bekannte Restprobleme

1. Die Bézier-Bogen-Bewegung ist eine Annäherung (drei Wegpunkte + CSS-
   Transition), kein echtes `offset-path`-Kurven-Rendering — visuell überzeugend
   und robust, aber nicht mathematisch exakt auf der Ellipse.
2. `ActionPreview`s Mock-`PublicGameState` bildet nur die für die Choreographie
   relevanten Felder nach (z. B. `pendingSkipTargets` nur für TARGET/SKIP
   gesetzt) — für andere, hier nicht geforderte Szenarien (z. B. `DITCH`) ist der
   Mock funktional, aber nicht bis ins letzte Detail wie ein echtes Spiel
   durchmodelliert.
3. Reduced Motion weiterhin nur per Code-Review geprüft (kürzere
   Transition-Dauer unter `prefers-reduced-motion`), nicht live mit aktivierter
   Betriebssystem-Einstellung gegengetestet.
4. Mobile (`REMOTE_MOBILE_FULL`) wurde bewusst nicht mit dem neuen Harness
   gegengetestet (Harness ist expliziter TABLE_DEVICE-Test gemäß Auftrag) — die
   Trennung über `tableDevice`/`.action-focus--table` wurde per Code-Review
   verifiziert (mobile Selektoren sind unverändert und werden nur ohne die neue
   Modifier-Klasse erreicht).

## 14. Geänderte Dateien

| Datei | Art der Änderung |
|---|---|
| `src/components/GameTable/ActionFocus.tsx` | `action-focus--table`-Klasse, DRAW-Titel/Subtitle-Fälle, SWAP-Farb-Subline unterdrückt |
| `src/components/GameTable/ActionFocus.css` | CENTER ACTION TITLE ZONE, kompaktere Typografie, eigenes Keyframe für Table |
| `src/components/GameTable/ActionChoreography.tsx` | Hand-Stack-/Card-Back-Glyphen-Komponenten, Bogenbewegung (bowOutward/bowPerpendicular/curvedPoint), korrigierter Draw-Startpunkt, Target-Pulse entfernt |
| `src/components/GameTable/ActionChoreography.css` | neue Glyphen-Styles, Z-Index-Dokumentation |
| `src/components/GameTable/PlayerRing.tsx` / `.css` | Skip-Badge auf Icon-Chip umgestellt |
| `src/pages/dev/ActionPreview.tsx` | **neu**, DEV-only |
| `src/App.tsx` | DEV-only Route (lazy, aus Produktion herausgefaltet) |
| `qa/capture_polish.mjs` | **neu**, deterministisches Screenshot-Skript |

## ACTION FOCUS POLISH:
**PASS**

Begründung: keine Action-Typografie überlagert mehr eine Player Unit (live
vermessen, nicht nur behauptet), Hand-Stack- und Draw-Glyphen sind eindeutig als
Karten erkennbar statt als Platzhalter-Rechtecke, ROTATE/SWAP folgen einer
sichtbaren Bogenbewegung entlang des Rings statt gerader Linien, und SKIP ALL
wurde — wie ausdrücklich gefordert — mit einem echten lokalen Screenshot belegt,
nicht nur per Code-Review.
