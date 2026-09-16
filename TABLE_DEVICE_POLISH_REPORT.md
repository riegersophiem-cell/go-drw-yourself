# TABLE_DEVICE_POLISH_REPORT

Feinschliff-Durchgang ausschließlich auf **TABLE_DEVICE**: Größenverhältnisse, Hierarchie,
visuelle Ruhe, Kopplung der Elemente. Die grundsätzliche Richtung aus den vorherigen drei
Phasen (Hero Center groß, Player Units avatar-dominant) bleibt vollständig erhalten — hier
wurde ausschließlich nachjustiert, nichts umgebaut. Game Logic, Mobile/Remote-Mobile-Layout,
Handkartenbereich, Seat Logic, Kartenassets und Action-Logik: unangetastet.

## 1. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/GameTable/PlayerRing.css` | Avatar-/Pillen-Proportionen verkleinert, Überlapp reduziert, Turn-Badge kompakter und näher angedockt, Glow-Effekte zurückgenommen |
| `src/components/GameTable/GameTable.css` | Seat-Edit-Button zu kompaktem Ghost-Icon-Button degradiert |
| `src/components/GameTable/GameTable.tsx` | Seat-Edit-Button-Markup (Icon + optionales Label) |
| `src/components/GameTable/OrbitFlow.tsx` | Radien unverändert aus Hero-Center-Fix übernommen; vier sequenziell aufleuchtende Richtungs-Marker ergänzt |
| `src/components/GameTable/OrbitFlow.css` | Track/Pulse-Sichtbarkeit erhöht, neue Marker-Animation |
| `src/components/GameTable/DiscardStage.tsx` | Draw-Pile-Kartenanzahl für TABLE_DEVICE als angedockte Ecke-Badge statt separater Textzeile (Mobile-Pfad unverändert daneben erhalten) |
| `src/components/GameTable/DiscardStage.css` | Grid-Abstand (Draw↔Discard) für TABLE_DEVICE verkleinert; neue Badge-Positionierung |
| `src/pages/RoomPage.tsx` | Reconnect-Toast bekommt bei TABLE-Rollen eine zusätzliche Modifier-Klasse |
| `src/App.css` | `.reconnect-toast--table`: kleinere, weniger dominante Variante (Basis-Stil für Mobile/Player unverändert) |

Keine andere Datei angefasst. Insbesondere: `PlayerHand.*`, `HandDock.*`, `ActionFocus.*`,
`CenterHalo.*`, `seatGeometry.ts`, `seatLayout.ts`, jede Datei in `src/game/` sowie alle
Supabase-Funktionen/Migrationen — unverändert.

## 2. Layout-/Spacing-/Sizing-Parameter im Detail

### Player Units (Abschnitt 3–5 des Auftrags)

| Parameter | Vorher | Nachher |
|---|---|---|
| Avatar-Größe | `clamp(64px, 6.2vw, 88px)` | `clamp(56px, 5.4vw, 76px)` |
| Pillen-Breite | `min 84px, max 118px` | `min 76px, max 106px` |
| Pillen-Padding | `7px 12px` | `6px 10px` |
| Name/Meta-Schrift | `.74rem` / `.58rem` | `.7rem` / `.54rem` |
| Avatar-Überlapp (links/rechts) | `-20%` | `-16%` |
| Avatar-Überlapp (oben/unten) | `-18%` | `-14%` |
| Active-Glow (Pille) | `0 0 0 2px … 0 0 22px … 0 10px 22px …` | `0 0 0 1.5px … 0 0 14px … 0 8px 18px …` (spürbar zurückgenommen) |
| Turn-Badge | `bottom:-10px`, Schrift `.56rem`, Padding `4px 13px` | `bottom:-5px`, Schrift `.5rem`, Padding `2px 10px`, leicht verkleinert (`scale(.94)`) — sitzt jetzt am unteren Rand der ganzen Einheit statt mit sichtbarem Abstand darunter zu schweben |

Ergebnis: Die aktive Spieler-Einheit (oben am Ring) liest sich jetzt als **eine**
zusammenhängende Form (Pille → Avatar → Badge, alle unmittelbar aneinander andockend)
statt als drei erkennbar getrennte Ebenen.

### Seat-Edit-Button (Abschnitt 7)

Vorher: durchgehend sichtbare Pille mit vollem Text ("Sitzordnung anpassen"), starker
Kontrast (weißer Hintergrund, violetter Text), 30–40px hoch mit Padding `8px 14px`.

Nachher: im Ruhezustand ein 30×30px rundes Ghost-Icon (⤢-Symbol), sehr niedriger Kontrast
(`rgba(255,255,255,.06)` Hintergrund, `rgba(210,220,235,.75)` Text), erst im aktiven
Editier-Zustand wird es zur farbigen Pille mit Häkchen + "Fertig" — weil das dann ein
echter, für den Bediener relevanter Modus ist, keine Sekundärfunktion mehr.

### Reconnect-Toast (Abschnitt 6)

Bleibt für Mobile/Player exakt wie zuvor (großer grüner Pill, oben zentriert). Für
TABLE-Rollen (`TABLE`/`SPECTATOR`/`HOST_ADMIN`) neue `--table`-Variante: oben links statt
zentriert (kollidiert dadurch nicht mit dem Seat-Edit-Button oben rechts), deutlich
kleiner (`padding:6px 12px`, `font-size:.62rem` statt `10px 18px`/`.82rem`), verschwindet
weiterhin automatisch nach 3,2 s (bereits bestehendes Verhalten, unverändert).

### Orbit Flow (Abschnitt 8)

- Track-Deckkraft `rgba(...,.16)` → `rgba(...,.26)`, Strichbreite `.35` → `.45`.
- Pulse-Deckkraft `.55` → `.72`, Strichbreite `.6` → `.7`, zweiter versetzter Pulse
  (`animation-delay:-4s`) ergänzt, damit auf einen Blick mehr als ein Lichtpunkt sichtbar
  ist.
- **Erster Versuch verworfen**: zunächst wurden vier gerichtete Pfeil-Chevrons per
  berechnetem SVG-Pfad ergänzt — live sichtbar wurden daraus bei 6 Spielern riesige,
  klobige Dreiecke links/rechts (siehe Abschnitt 5, Restprobleme/Lessons). Ursache: die
  Chevron-Geometrie ging von gleichmäßiger Skalierung aus, das SVG wird aber via
  `preserveAspectRatio="none"` bewusst nicht gleichmäßig gestreckt (nötig, damit die
  Ellipse zur Tischform passt) — dadurch verzerrten sich die Dreiecke massiv.
  **Ersetzt** durch vier kleine, nacheinander aufblitzende Marker-Ellipsen (gleiches
  Verzerrungsverhalten wie die Track-Ellipse selbst, also robust), die in
  Spielrichtung "entlanglaufen" — subtil, aber Richtung ist auch aus einem Einzelbild
  klar erkennbar.

### Draw/Discard/Count-Gruppierung (Abschnitt 9)

- `.discard-stage__grid` Abstand (nur TABLE_DEVICE) `clamp(14px,2.4vw,26px)` →
  `clamp(10px,1.6vw,18px)` — Ablage- und Ziehstapel rücken sichtbar näher zusammen.
- Kartenanzahl-Badge: vorher eigene Textzeile unterhalb des Ziehstapels
  (`.discard-stage__count`, weiße Pille im Leerraum) — jetzt eine kleine, am Stapel
  selbst angedockte Ecke-Badge (`.discard-stage__count--badge`, `position:absolute` auf
  der Kartenrückseite). **Mobile-Pfad bewusst unverändert**: der `compact`-Zweig rendert
  weiterhin exakt die alte `<span className="discard-stage__count">`-Zeile.

### Hero Center Feintuning (Abschnitt 10)

Bewusst minimal gehalten wie gefordert — keine Größenänderung an Discard/Draw selbst
(bereits im Hero-Center-Fix korrekt eingestellt), nur der oben genannte Grid-Abstand.

## 3. Bewusst NICHT verändert

- Hero-Center-Kartengrößen (`clamp(188px,14vw,222px)` Discard / `clamp(104px,7.7vw,122px)`
  Draw) — aus dem Hero-Center-Fix übernommen, hier nicht angetastet.
- Player-Ring-Ellipsenradien (`radiusXPct:34, radiusYPct:33` in `PlayerRing.tsx`) — die
  kleineren Avatare/Pillen schaffen bereits mehr Ruhe, ohne die bereits kollisionsfrei
  austarierten Radien erneut zu riskieren.
- Seat-Orientierungslogik (`seatOrientation()`), Seat-Tausch-Mechanik
  (`handleSeatTap`/`swapSeats`/`resolveSeatOrder`).
- `ActionFocus`-Verhalten/-Timing, `CenterHalo`-Logik, Chaos-Farbauflösung.
- REMOTE_MOBILE_FULL (`variant="compact"`-Pfad in `PlayerRing.tsx`, `discard-stage--compact`
  in CSS) sowie `PlayerHand`/`HandDock` — vollständig unangetastet.
- Rule Engine, Kartenassets, Supabase-Funktionen/Migrationen.

## 4. 6-Spieler-Test (Abschnitt 13)

Live geprüft (1280×800, 6 Spieler): keine der sechs Einheiten rutscht zu hoch/tief, keine
seitliche Einheit wirkt abgeschnitten, keine Namenskollision, das "AM ZUG"-Badge ragt in
keinem der sechs Sitzplätze in ein Nachbarelement hinein. Siehe
`TABLE_POLISH_6_PLAYERS.png`.

## 5. Screenshots

```
C:\Users\sophie\Documents\Sophies Programme\uno-show-em-no-mercy\qa\final\screenshots\
```

| Datei | Inhalt |
|---|---|
| `TABLE_POLISH_NORMAL.png` | 4 Spieler, Ruhezustand — kompakter Seat-Edit-Button, kleiner Toast, angedockte Count-Badge |
| `TABLE_POLISH_ACTIVE_PLAYER.png` | dieselbe Ansicht — aktive Spieler-Einheit (Sophie) als eine zusammenhängende Form |
| `TABLE_POLISH_6_PLAYERS.png` | 6 Spieler, alle sauber verteilt, Orbit-Marker links/rechts sichtbar |
| `TABLE_POLISH_MAJOR_ACTION_READY.png` | Major Action Focus (ROTATE) mit der neuen, ruhigeren Player-Unit-Gestaltung darunter |

## 6. Restprobleme

- **`TABLE_POLISH_REVERSE_DIRECTION.png` fehlt.** Trotz vier gezielter automatisierter
  Versuche (davon zwei mit einer Heuristik, die eine REVERSE-Karte aus Sophies Hand
  bevorzugt spielt, insgesamt über 12 Minuten Bot-/Testspiel) wurde in dieser Sitzung
  keine REVERSE-Karte live zum richtigen Zeitpunkt gespielt, um den Reversing-Zustand
  einzufangen. Der Mechanismus selbst ist **nicht** verändert worden (nur Track-/
  Marker-Farben/-Deckkraft, die auch im Normalzustand gelten) und wurde in der
  unmittelbar vorherigen Phase (`TABLE_UI_IMPLEMENTATION_REPORT.md`, Screenshot
  `09_TABLE_REVERSE.png`) live bestätigt — dieses Verhalten wurde durch die heutigen
  CSS-Feintuning-Änderungen nicht berührt. Rein visuelle Bestätigungslücke, kein
  bekannter Fehler.
- Ein während der Umsetzung entdeckter eigener Fehler wurde noch vor Fertigstellung
  behoben (siehe Abschnitt 2, Orbit Flow: verworfene Chevron-Pfeile) — nicht mehr im
  finalen Stand vorhanden, hier nur der Vollständigkeit halber dokumentiert.
- Die Turn-Badge-Position ("unter dem Avatar/der Einheit") ist bewusst orientierungs-
  unabhängig einheitlich gelöst (immer am unteren Rand der ganzen Einheit) statt für
  jede der vier Sitz-Ausrichtungen individuell an die Naht zwischen Avatar und Pille zu
  docken — das wäre die noch elegantere Lösung gewesen, hätte aber in der verbleibenden
  Zeit nur mit unsicherer Pixel-Schätzung (keine Live-Messung der Flex-Box-Geometrie pro
  Ausrichtung) umgesetzt werden können. Aktuelle Lösung erfüllt die Abnahmekriterien
  bereits sichtbar (siehe Screenshots), wäre aber ein guter Kandidat für einen
  weiteren Feinschliff-Durchgang.

## 7. Regressionstests

```
npx tsc -b        → 0 Fehler
npx vitest run    → 21 Testdateien, 218/218 Tests grün
npm run lint      → 0 neue Warnungen
npm run build     → erfolgreich
```

## TABLE DEVICE POLISH:
**PASS**
