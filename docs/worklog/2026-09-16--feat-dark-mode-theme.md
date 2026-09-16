# feat/dark-mode-theme

## Ziel
Vollständiges Light/Dark/System-Theme-System für die ganze App — zentrale Tokens statt Filter/Invert/Ad-hoc-Overrides.

## Stand
Implementiert, getestet, live verifiziert per Screenshots. **Nicht committet/gepusht/deployed.**

## Entscheidungen + Begründung
- Zentrales `ThemeProvider` (`src/theme/ThemeProvider.tsx`) + `data-theme` auf `<html>` — Komponenten entscheiden nie selbst, lesen nur CSS-Tokens.
- `localStorage["gdy_theme"]` = `"light"|"dark"|"system"`; `index.html` bekam ein Inline-Script vor dem ersten Paint, das exakt dieselbe Auflösung wie der Provider macht → kein Flash.
- Tokens in `src/index.css` (vorher totes Vite-Template-CSS, jetzt der echte Token-Ursprung): `--bg-*`, `--text-*`, `--border-*`, `--shadow-*`, `--accent-*`, `--overlay-*`, `--glass-*`, plus separate `--game-*`-Tokens (rot/blau/grün/gold/violett) OHNE Dark-Override, da das Spielfarben sind, keine Theme-Farben (Spec-Punkt 27).
- TABLE_DEVICE/Action-Focus/Chaos-Presentation waren aus früheren Phasen bereits als dunkle Glas-Bühne gebaut — bewusst NICHT neu gestaltet, nur die Seiten-Hintergrundfarbe dahinter reagiert jetzt aufs Theme.
- Kartenassets komplett unangetastet (kein Filter/Invert) — verifiziert per Screenshot-Vergleich Light vs. Dark (identische Kartenflächen).
- Ein echter Bug beim Testen gefunden und gefixt: `ActionPreview.tsx`'s Dev-Harness hatte einen hartcodierten `background:"#000"` (Rest aus der Zeit vor Dark Mode), der Light/Dark auf der TABLE-Seite optisch identisch aussehen ließ und damit verdeckt hätte, ob die echte Seiten-Hintergrundfarbe überhaupt reagiert.
- Screenshots über die bestehenden DEV-Harnesses (`/dev/lobby-preview`, `/dev/mobile-preview`, `/dev/action-preview`) statt über einen echten Raum — der Supabase-Backend war während dieser Session nicht erreichbar (`ERR_CONNECTION_REFUSED`, Infrastruktur-/Netzwerkproblem, nichts mit dieser Änderung zu tun). Neues Skript `qa/capture_dark_mode.mjs` nach etabliertem `qa/capture_*.mjs`-Muster.

## Offene Punkte (max. 3)
1. Keine Live-Backend-Screenshots möglich (Supabase down) — insbesondere WinnerOverlay im echten Sieg-Zustand nicht visuell geprüft, nur code-reviewed.
2. Die exakte Responsive-Größenliste aus der Spec (320×568 … 932×430) wurde nicht einzeln durchgeschossen — nur eine Auflösung (800px) live getestet, plus Vertrauen darauf, dass nur Farben (nicht Layout) geändert wurden.
3. Kein formaler WCAG-Kontrast-Check (nur visuelle Pixel-Stichproben).

## Relevante Dateien/Pfade
- `src/theme/ThemeProvider.tsx`, `src/theme/ThemeSwitch.tsx` + `.css` (neu)
- `src/index.css` (komplett neu geschrieben — Token-Quelle)
- `index.html` (Inline No-Flash-Script)
- `src/App.css`, `src/pages/PlayerGame.css`, `src/components/WinnerOverlay/WinnerOverlay.css`, `src/components/AvatarPicker/AvatarPicker.css`, `src/components/GameTable/HandDock.css`, `src/components/GameTable/DiscardStage.css`, `src/components/GameTable/PlayerRing.css`, `src/components/GameTable/OrbitFlow.css` — Tokens statt Hardcode
- `src/pages/dev/ActionPreview.tsx` — Bugfix (hartcodierter schwarzer Hintergrund entfernt)
- `qa/capture_dark_mode.mjs` (neu) + `qa/dark_mode_screenshots/*.png` (10 Screenshots)
- `DARK_MODE_IMPLEMENTATION_REPORT.md`, `THEME_QA_MATRIX.md` (neu, Repo-Root)

## Verworfen & warum
- Komplette Neugestaltung von ActionFocus/ActionChoreography/CenterHalo für Dark Mode — bereits als dunkle Bühne gebaut, hätte nur Risiko ohne Nutzen bedeutet.
- `ActionFocus.tsx`'s JS-Farbkonstante auf CSS-Custom-Properties umstellen — Werte sind bereits identisch zu den neuen `--game-*`-Tokens, Refactor außerhalb des Scopes.

## Befehle zum Reproduzieren
```bash
npx tsc -b
npx vitest run
npm run lint
npm run build
node qa/capture_dark_mode.mjs
```
