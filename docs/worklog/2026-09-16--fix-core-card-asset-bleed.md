# fix/core-card-asset-bleed

## Ziel
Ein vom Nutzer gemeldeter Rendering-Fehler (Karte links "zu weit ausgeschnitten", weißer/farbiger Rand sichtbar) sollte geprüft und — falls an weiteren Karten vorhanden — überall behoben werden.

## Stand
Fix angewendet, verifiziert, lokal. **Nicht committet/gepusht/deployed.**

## Entscheidungen + Begründung
- **Root Cause war kein CSS-Bug, sondern ein Asset-Export-Fehler**: `core_red_circle.png` (und weitere CORE-Dateien) haben auf der linken Kante einen sichtbaren Farbstich einer NACHBARFARBE (z. B. blauer Schimmer auf der roten Karte, grüner Schimmer auf der blauen Karte) — typisch für ein Sprite-Sheet-Crop, bei dem die Ausschnittgrenze knapp daneben lag und ein paar Pixel der Nachbarkarte mit eingeschnitten wurden. CSS (`object-fit: contain`, `aspect-ratio: 5/7`) wurde geprüft und ist korrekt; das Problem steckte in den PNG-Pixeln selbst.
- **Vollständiger Audit aller 80 finalen Assets** (`/public/assets/cards/final/png/`) per Skript: Kantenfarbe gegen die für die Farbe kanonische Hue (rot=0°, blau=216°, grün=144°, gold=48°, violett=270°, dieselben Werte wie in der früheren Hue-Shift-Phase) geprüft. Ergebnis: **nur ROT (5 Dateien) und BLAU (5 Dateien) der CORE-Familie hatten einen echten, sichtbar falschen Farbstich** auf der linken Kante. GOLD/VIOLETT-Verdachtsfälle waren beim visuellen Gegencheck sauber (nur die eigene erwartete Glow-Farbe, keine fremde Farbe) — bewusst NICHT angefasst, um kein funktionierendes Bild zu riskieren. GRÜN hatte nur einen kaum wahrnehmbaren (~3%) Farbstich im Hintergrundweiß, der sich als der normale, im ganzen Bild einheitliche kühle Off-White-Ton herausstellte (kein Defekt) — ebenfalls nicht angefasst.
- **Reparaturmethode**: pro betroffener Datei die kontaminierten Pixel (Sättigung > Schwelle UND Farbton weit von der eigenen kanonischen Farbe entfernt, nur linke Bildhälfte) erkannt und zeilenweise mit dem nächsten sauberen Pixel derselben Zeile aufgefüllt ("nearest clean neighbour in row") — dadurch bleibt die Rundung der Kartenecke exakt erhalten (kein Versatz), anders als ein erster Versuch mit Links-Rechts-Spiegelung, der an der oberen Ecke sichtbare Treppenstufen erzeugte, weil die Karte im Canvas nicht exakt zentriert ist.
- **Bildgröße unverändert**: keine Crop-Verkleinerung, nur In-Place-Pixelkorrektur — nichts an Mapping/Code musste angepasst werden.
- Alle 10 Originale vor dem Überschreiben nach `public/assets/cards/deprecated/final-core-bleed-fix-originals/` gesichert (bestehendes `deprecated/`-Muster aus der vorherigen Card-Asset-Phase wiederverwendet).

## Offene Punkte (max. 3)
1. Die Ursache liegt vermutlich im Export-Workflow der Kartenassets (Sprite-Sheet-Crop) — falls der Nutzer weitere neue Kartenvarianten liefert, lohnt sich derselbe Kanten-Scan vorab.
2. Grünes Hintergrundweiß hat einen leicht kühlen Ton (nicht neutral #fff) — augenscheinlich Absicht/Konsistenz im ganzen Bild, aber nicht aktiv mit dem Referenz-Weiß anderer Farben abgeglichen.
3. Nur CORE-Familie geprüft (Audit-Skript lief nur auf `core_*`-Dateien, da der gemeldete Fehler dort auftrat) — ACTION/CHAOS-Dateien wurden in der vorherigen Phase bereits separat validiert (CARD_ASSET_UPDATE_REPORT.md), aber nicht mit demselben Kantenscan.

## Relevante Dateien/Pfade
- `public/assets/cards/final/png/core_red_*.png` (5) und `core_blue_*.png` (5) — gefixt
- `public/assets/cards/deprecated/final-core-bleed-fix-originals/` (neu) — Originale vor dem Fix
- Audit-/Fix-Skripte (Scratchpad, nicht Teil des Repos): `scan_edges.py`, `measure_bleed.py`, `fix_bleed_v2.py` unter `%TEMP%\claude\...\scratchpad\card_audit\`

## Verworfen & warum
- Reiner Spalten-Crop + Rand-Wiederholung (erster Versuch) — hat die gerade linke Kante sauber gemacht, aber die obere Ecke (variable Kontaminationsbreite) nicht vollständig erfasst.
- Horizontale Spiegelung zur Reparatur — erzeugte sichtbare Treppenstufen-Artefakte, weil die Karte nicht exakt im Canvas zentriert ist.

## Befehle zum Reproduzieren
Kein npm-Test deckt Pixelinhalte ab (nur Dateiexistenz, s. `tests/cardAssets.test.ts`). Verifikation war visuell:
```bash
npx vitest run tests/cardAssets.test.ts
```
Live-Check: `http://localhost:5173/assets/cards/final/png/core_red_circle.png` direkt im Browser öffnen und Ränder prüfen.
