# CARD ASSET REPORT

## Ergebnis

Das aktive Kartensystem von **GO DR*W YOURSELF** verwendet ein gemeinsames, eigenständiges Designsystem mit den Familien BASIC, ACTION und CHAOS. Rot, Blau, Grün, Gelb und Violett (`#7047EB`) sind vollständig integriert. SVG ist das primäre Browserformat; jedes Motiv besitzt einen PNG-Fallback in 750 × 1050 px.

BASIC-Karten zeigen ausschließlich eine große weiße geometrische Form auf dem farbigen Kartenkörper. Auf ihrer sichtbaren Vorderseite stehen weder Logo noch Familie, Kartenname oder Untertitel. Die Klartextbedeutung bleibt nur unsichtbar als SVG-Metadatum und `aria-label` für Barrierefreiheit erhalten.

## Asset-Inventar

Für jede Kombination in der folgenden Matrix existieren gleichnamige `.svg`- und `.png`-Dateien mit dem Präfix `gdy_`.

| Familie | Farben | Dateinamen je Farbe |
| --- | --- | --- |
| BASIC | `red`, `blue`, `green`, `yellow`, `violet` | `pass`, `link`, `pulse`, `arc` |
| ACTION | `red`, `blue`, `green`, `yellow`, `violet` | `shove`, `target`, `lowest`, `ditch`, `draw_2`, `draw_4`, `skip`, `reverse`, `drop_all` |
| CHAOS | `black` | `swap`, `rotate`, `skip_all`, `wild_reverse_draw_4`, `wild_draw_6`, `wild_draw_10`, `color_roulette` |

Damit umfasst der verbindliche Katalog 72 Vorderseiten, jeweils als SVG und PNG. Zusätzlich vorhanden sind:

- `gdy_card_back` als einheitliche Rückseite
- fünf `gdy_[color]_draw_1` für die Kompatibilität mit dem bestehenden Regelmodell
- `gdy_black_wild` und `gdy_black_wild_draw_4` für bereits gespeicherte ältere Runden

Insgesamt liegen **80 SVG-Dateien und 80 PNG-Dateien** vor.

## Ordnerstruktur

```text
public/assets/cards/
├── svg/       # aktive SVG-Master
├── png/       # aktive PNG-Fallbacks
├── overview/  # Designboard als SVG und PNG
└── archive/v1 # vorherige, nicht mehr referenzierte Kartenassets
```

Die Übersicht heißt `gdy_card_system_overview.svg` beziehungsweise `gdy_card_system_overview.png`. Sie zeigt jeden verbindlichen Kartentyp mindestens einmal und alle fünf regulären Farben.

## Integration

- `src/components/Card/cardArt.ts` ist die zentrale Zuordnung von Regelform zu Assetdatei.
- `src/components/Card/Card.tsx` rendert SVG über `<picture>` und verwendet PNG als echten Fallback.
- Hand, Ablagestapel, Animationen, Vorschau-/Displaykarten und verdeckte Karten laufen weiterhin ausschließlich durch `Card` und verwenden damit dasselbe System.
- `SWAP_HAND` und `ROTATE_HANDS` verwenden unabhängig von ihrer historischen internen Farbe die schwarze CHAOS-Gestaltung.
- Neue Spiele enthalten Violett und reguläre `DRAW_4`-Karten. Bot-Farbwahl, Farbauswahl, Ereignisvalidierung, Sortierung und Wiedergabetexte kennen Violett.

## Archivierte Modelle

Die 68 vorherigen SVG-Dateien wurden nach `public/assets/cards/archive/v1/` verschoben. Der aktive Renderer referenziert diesen Ordner nicht mehr. Die alten Dateien bleiben ausschließlich als nachvollziehbarer Rückweg erhalten.

## Reproduzierbarkeit

`design/generate_card_assets.py` erzeugt SVG-Master, PNG-Fallbacks und beide Übersichtsdateien aus denselben Design-Tokens. Dadurch bleiben Farben, Typografie, Familienmerkmale und Benennung synchron.

## Kompatibilität

`DRAW_1`, `WILD` und `WILD_DRAW_4` bleiben im Typmodell, damit laufende oder gespeicherte ältere Runden weiterhin gerendert und abgeschlossen werden können. Sie werden optisch vollständig im neuen System dargestellt und erzeugen keine Mischung mit dem alten Kartenstil.

## Prüfung

- Visuelle Prüfung des Gesamtboards sowie der Karten in einer echten lokalen Partie
- SVG-Primärpfad und PNG-Fallback in `Card` integriert
- Vollständige automatisierte Testsuite zuletzt grün
- Produktions-Build erfolgreich
- Lint erfolgreich; nur zwei bereits bestehende React-Hinweise in `RoomPage.tsx` und `Table.tsx`
