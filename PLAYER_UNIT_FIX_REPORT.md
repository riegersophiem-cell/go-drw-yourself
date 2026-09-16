# PLAYER_UNIT_FIX_REPORT

Ersetzt ausschließlich die großen grauen Player Cards auf **TABLE_DEVICE** durch eine
kompakte, avatar-dominante Darstellung (großer Avatar im Vordergrund + kleine
angehängte Info-Pille für Name/Rolle/Kartenanzahl). Kein Redesign von Hero Center,
Discard/Draw-Verhältnis, Orbit Logic, Game Logic, Hand Layout, Mobile Hand,
Kartenassets oder Rule Engine — ausschließlich Player Units + deren States.

## 1. Wiederverwendete alte Komponente / Layoutprinzip

Wie in Abschnitt 1 des Auftrags gefordert, zuerst im Git-Verlauf gesucht statt neu zu
erfinden. Fündig geworden in Commit `43874f6` ("Make the player avatar the dominant
visual, replace the status rail with avatar-attached effect stamps") — genau die
gewünschte Grundidee: ein großer, freigestellter Avatar (194×194px) wird per negativem
Margin über eine kleine dunkle Glas-Pille (Name + Rolle/Anzahl) gezogen, sodass der
Avatar der Hauptfokus ist und die Pille wie eine daran befestigte Infofläche wirkt.

Diese alte `Table.tsx`/`Table.css`-Komponente selbst existiert nicht mehr (im Zuge des
TABLE_DEVICE-Neubaus gelöscht, siehe `TABLE_UI_IMPLEMENTATION_REPORT.md`) und ist nicht
direkt mit dem neuen `GameTable`/`PlayerRing`-System kompatibel (anderes Props-Modell,
andere Sitzplatz-Mathematik). Das **Layoutprinzip** wurde daher exakt rekonstruiert,
nicht neu erfunden — siehe Abschnitt 2.

**Unterschied zur alten Version, bewusst gewählt**: Die alte Komponente kannte nur eine
einzige, feste Ausrichtung (Avatar immer links, Pille immer rechts, egal an welcher
Sitzposition). Der aktuelle Auftrag (Abschnitt 7) verlangt ausdrücklich orientierungs-
abhängige Layouts ("nicht alle Seats stumpf mit identischem horizontalem Layout
behandeln") — das ist eine bewusste Erweiterung des alten Prinzips um eine
Center-Ausrichtung, keine Abweichung von der verbindlichen visuellen Hierarchie.

## 2. Rekonstruierte / neue Teile

- **`seatOrientation()`** (neu, `PlayerRing.tsx`): bestimmt aus der bereits vorhandenen
  Sitzposition (`leftPct`/`topPct` aus `computeSeatPoints()`, unverändert), auf welcher
  Tischseite ein Sitz liegt (`left`/`right`/`top`/`bottom`) — die dominante Achsen-
  Abweichung vom Zentrum entscheidet. Rein abgeleitet aus bestehenden Daten, keine neue
  Sitzlogik, keine Hardcodierung pro Spielerzahl.
- **`.player-unit`-Klassenfamilie** (neu, `PlayerRing.css`): CSS-Rekonstruktion des alten
  Avatar-Übergriff-Prinzips, doppelt so kompakt wie das Original (Avatar
  `clamp(64px,6.2vw,88px)` statt fix 194px — passend zur bereits verkleinerten
  Hero-Center-Geometrie aus `HERO_CENTER_FIX_REPORT.md`), mit vier Ausrichtungs-
  varianten statt nur einer.

## 3. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/GameTable/PlayerRing.tsx` | `seatOrientation()`-Helper ergänzt; `renderPlayer()` verzweigt jetzt nach `variant`: `"full"` rendert die neue `player-unit`-Struktur, `"compact"` (Mobile) rendert **unverändert** die bisherige Markup-Struktur |
| `src/components/GameTable/PlayerRing.css` | alte `.player-ring__seat--full`-Regeln (großer grauer Kasten) entfernt; neue `.player-unit*`-Regelfamilie ergänzt. `.player-ring__seat--compact` (Mobile) **unverändert** |

Keine andere Datei angefasst. `GameTable.tsx`, `DiscardStage.tsx`, `OrbitFlow.tsx`,
`ActionFocus.tsx`, `CenterHalo.tsx`, `HandDock.tsx`, `PlayerHand.tsx`, jede `.ts`-Datei
in `src/game/` sowie alle Supabase-Funktionen/Migrationen: unangetastet.

## 4. Vorher/Nachher

| | Vorher | Nachher |
|---|---|---|
| Avatar | 42px, in einer Ecke der Karte | `clamp(64px, 6.2vw, 88px)`, dominant, über die Pille gezogen |
| Info-Fläche | großer grauer/weißer Kasten, `clamp(96px,12vw,138px)` breit, Avatar+Text nebeneinander in fester Spaltenbreite | kleine Glas-Pille, `min-width:84px, max-width:118px`, reiner Inhalt (Name + Rolle · Anzahl) |
| Ausrichtung | immer identisch (Avatar oben, Text darunter) | vier Varianten, abhängig von der Sitzposition relativ zum Zentrum — Avatar lehnt sich immer zur Tischmitte |
| Active-Status | Rand-Glow um die ganze große Karte | kompaktes "AM ZUG"/"DEIN ZUG"-Badge, an der Pille angedockt (exakt wie im alten Vorbild) |
| Status (Skip/Draw/Highlight) | Border/Badge auf der großen Karte | dieselben Badges, jetzt auf die kleine Pille bezogen |

## 5. Status-States — Prüfung

Alle im Auftrag (Abschnitt 8) geforderten States sind weiterhin über dieselben Props/
Highlight-Mechanismen abgedeckt, nur auf die neue, kleinere Pille bezogen statt auf die
große Karte:

- **ACTIVE**: `.player-unit--active` → goldener Pill-Rand + Glow + "AM ZUG"-Badge.
- **BOT**: `.player-unit--bot` (Avatar-Fallback-Verlauf lila statt grau).
- **DISCONNECTED**: `.player-unit__presence--offline` (Status-Punkt am Avatar, unverändert vom bisherigen Mechanismus übernommen).
- **TARGETED / SWAP-/ROTATE-Teilnehmer**: `.player-unit--highlight-actor` / `--highlight-target` (aus `GameTable`s bestehendem `highlight`-Prop, unverändert).
- **SKIPPED**: `.player-unit--skipped` (Graustufen-Filter) + `AUSGESETZT`-Badge.
- **DRAW EFFECT**: `.player-unit--draw-effect` (blauer Pill-Rand) + `+N`-Badge.

Keine dieser States wurde als großes Panel umgesetzt — ausschließlich Badge/Border/
Filter auf der kleinen Pille bzw. am Avatar, wie gefordert.

## 6. Action Focus — Prüfung

Nicht verändert (`ActionFocus.tsx`/`ActionFocus.css` unangetastet). Live geprüft:

- **ROTATE** (Major Action): alle 6 Player Units bleiben sichtbar unter dem Scrim (siehe `07_TABLE_ROTATE.png`) — der bereits vorhandene Scrim-Mechanismus dimmt gleichmäßig, verdeckt keine Einheit vollständig.
- **STANDARD Action**: Player Units bleiben unverändert normal sichtbar, keine Kollision mit der kompakteren Darstellung.
- **SWAP**: Highlight-Klassen (`--highlight-actor`/`--highlight-target`) funktionieren strukturell identisch wie zuvor, da `GameTable`s `highlight`-Objekt unverändert an `PlayerRing` durchgereicht wird.

## 7. Seat Edit Mode — Prüfung

Live getestet (3-Spieler-Raum, Tisch-Gerät in eigenem Tab): Sitzordnung aktiviert,
Bot 2 und Bot 3 per Tap-Tap getauscht — die komplette Player Unit (Avatar + Pille als
ein `<article>`-Element) wurde als Ganzes an die neue Position verschoben, exakt wie
zuvor. Keine Änderung an `handleSeatTap`/`swapSeats`/`resolveSeatOrder` — der Klick-
Handler sitzt weiterhin auf dem äußeren `<article>`, unabhängig vom inneren Markup.

## 8. Responsive-Verhalten

Avatar- und Pillen-Größen nutzen `clamp()` mit `vw`-Anteil, verhalten sich also
zwischen den getesteten Auflösungen konsistent proportional zur (bereits in
`HERO_CENTER_FIX_REPORT.md` verkleinerten) Tischfläche:

| Auflösung | Ergebnis |
|---|---|
| 1024×768 | PASS — keine Kollision, alle Namen/Zahlen lesbar |
| 1366×768 | PASS |
| 1920×1080 | PASS |
| 6 Spieler (1280×800) | PASS — kein Sitz kollidiert mit einem anderen oder dem Hero Center |
| Langer Name ("Maximiliane-Alexandra") | PASS — Ellipsis nach ca. 12 Zeichen, Pille wird nicht breiter (`max-width: 118px` bleibt hart) |

Mobile (`REMOTE_MOBILE_FULL`, `variant="compact"`) bewusst **nicht** angefasst — bei
320/360/390/430px unverändert zum vorherigen Stand (Code-Pfad komplett getrennt).

## 9. Ein während der Umsetzung gefundener und behobener eigener Fehler

Die erste Implementierung hatte einen echten, live sichtbaren Bug: die Info-Pille
schrumpfte auf ihre reine Text-Breite (`min-width:0` erlaubte das), während der
Avatar-Überlapp (ursprünglich -32% der Avatar-Breite) als fester Betrag unabhängig von
der tatsächlichen Pillenbreite abgezogen wurde — bei einer sehr schmalen Pille deckte
der (höher liegende) Avatar dadurch einen Großteil des Namens ab. Ergebnis: Namen wie
"Bot 4" waren bis auf ein einzelnes Zeichen verdeckt. Behoben durch:
1. `min-width: 84px` auf der Pille (verhindert das Zusammenschrumpfen unter eine
   nutzbare Breite),
2. Überlapp von 32%/30% auf 20%/18% reduziert,
3. zusätzliches Innenpolster auf der vom Avatar überlappten Pillenseite (z. B.
   `padding-right` bei linksseitigen Sitzen), damit der Avatar nur den leeren
   Pillenrand, nie den Text selbst, verdeckt.

Vor diesem Fix hätte der Abnahmetest (Abschnitt 16 des Auftrags) FAIL ergeben — nach
dem Fix sind alle Namen auf allen getesteten Auflösungen vollständig lesbar (siehe
Screenshots).

## 10. Screenshots

```
C:\Users\sophie\Documents\Sophies Programme\uno-show-em-no-mercy\qa\final\screenshots\
```

| Datei | Inhalt |
|---|---|
| `TABLE_PLAYER_UNITS_4_PLAYERS.png` | 4 Spieler, alle vier Ausrichtungen (links/rechts/oben/unten) sichtbar |
| `TABLE_PLAYER_UNITS_6_PLAYERS.png` | 6 Spieler, keine Kollisionen |
| `TABLE_PLAYER_UNITS_ACTIVE.png` | aktiver Spieler mit "AM ZUG"-Badge |
| `TABLE_PLAYER_UNITS_MAJOR_ACTION.png` | ROTATE (Major Action) — alle Units bleiben unter dem Scrim sichtbar |
| `TABLE_PLAYER_UNITS_LONG_NAME.png` | langer Name, sauber per Ellipsis gekürzt, Pille bleibt kompakt |

## 11. Restprobleme

Keine bekannten. `06_TABLE_SWAP.png` (nicht Teil der geforderten Screenshot-Liste dieser
Phase) traf durch eine bereits aus der vorherigen QA-Phase bekannte Race Condition im
Capture-Skript selbst den falschen Folge-Beat — kein Produktfehler, nur eine
Kapture-Ungenauigkeit meines eigenen Test-Tools, betrifft die Player-Unit-Änderung
dieser Phase nicht.

## 12. Regressionstests

```
npx tsc -b        → 0 Fehler
npx vitest run    → 21 Testdateien, 218/218 Tests grün
npm run lint      → 0 neue Warnungen
npm run build     → erfolgreich
```

## Status

**PASS** — Avatar ist der klare Hauptfokus, die Info-Fläche ist deutlich kleiner als die
vorherigen grauen Kästen, der Player Ring wirkt spürbar leichter, Hero Center bleibt
unverändert dominant, alle Status-States funktionieren, 6 Spieler passen sauber, Major
Actions und Seat Edit funktionieren weiterhin unverändert.
