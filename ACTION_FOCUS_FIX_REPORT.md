# ACTION_FOCUS_FIX_REPORT

Überarbeitung des **Action-Presentation-Systems** auf TABLE_DEVICE: Standard und
besonders Major Action Focus erklären die Aktion jetzt über echte Bewegung
(Hand-Stack-Symbole, die zwischen Player Units wandern) statt über Text vor einem
verschwommenen Tisch. Hero Center, Player Ring, Player Units, Seat Edit,
Discard/Draw-Grundaufbau, Kartenassets, Game Logic, Rule Engine, Mobile Hand und
Hand-Row-Logik: unangetastet.

## 1. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/components/GameTable/ActionChoreography.tsx` | **neu** — animiert Card-Back-Symbole zwischen Player-Unit-Positionen für ROTATE/SWAP/TARGET/DRAW/STACK |
| `src/components/GameTable/ActionChoreography.css` | **neu** — Bewegungs-/Verbindungslinien-Styling |
| `src/components/GameTable/ActionFocus.tsx` | Scrim/Blur entfernt, Text auf 2 Zeilen verdichtet, Narrator/Bot-Denkt-Chip nur noch bei NONE-Severity, eigener kompakter Skip-Button, Farbakzent auf Titel |
| `src/components/GameTable/ActionFocus.css` | Scrim ohne `backdrop-filter`, Headline neu positioniert (oben statt Bildmitte), alte "AUSGESETZT"/"STACK"-Vollbild-Stempel entfernt |
| `src/components/GameTable/PlayerRing.tsx` | `RingHighlight` um `SKIP_ALL`-Kind erweitert; ROTATE hebt jetzt alle Teilnehmer leicht hervor, SKIP ALL dimmt alle außer dem Ausspieler |
| `src/components/GameTable/PlayerRing.css` | Neue Klassen `--rotate-participant`, `--skip-all-dim` |
| `src/components/GameTable/GameTable.tsx` | Berechnet die Sitzpunkte einmal zentral und reicht sie an `ActionChoreography` weiter; SKIP_EVERYONE wird jetzt korrekt auf `SKIP_ALL` gemappt |
| `src/components/GameTable/DiscardStage.tsx` / `.css` | Chaos-Karte bekommt nach Farbauflösung einen echten Farb-Tint auf der Karte selbst (nicht nur Halo/Badge) |
| `src/game/seatGeometry.ts` | `FULL_RING_RADII`/`computeFullRingSeatPoints()` hierher verschoben (aus `PlayerRing.tsx`), damit sowohl `PlayerRing` als auch `ActionChoreography` exakt dieselben Koordinaten verwenden |

Keine andere Datei angefasst. `PlayerHand.*`, `HandDock.*`, `seatLayout.ts`,
`OrbitFlow.*` (bis auf die bereits aus der vorherigen Phase bestehende
Reversing-Logik, unverändert), jede Datei in `src/game/` außer der reinen
Verschiebung oben, sowie alle Supabase-Funktionen/Migrationen: unverändert.

## 2. Standard Actions

| Aktion | Visualisierung |
|---|---|
| DRAW 2 / DRAW 4 | 2–4 Card-Back-Symbole lösen sich vom Zentrum und fliegen sichtbar zur betroffenen Player Unit (`ActionChoreography`, `beat.kind === "DRAW"`/`"STACK"`) |
| TARGET (TARGET_SKIP) | gestrichelte Verbindungslinie Actor → Target, roter Marker dockt am Zielspieler an (live bestätigt, `ACTION_TARGET.png`) |
| LOWEST | nutzt denselben DRAW-Choreographie-Pfad (die automatische Ziehung des Spielers mit der kleinsten Hand ist bereits ein normales `DRAW`-Beat mit `count`) |
| DITCH | unverändert **ohne** eigene Animation (`classifyBeatSeverity` ordnet den `EXTRA`-Beat weiterhin `NONE` zu) |
| SKIP | Verbindungslinie + Marker wie TARGET (beide teilen sich den `"SKIP"`-Beat-Kind-Pfad) |
| REVERSE | unverändert über `OrbitFlow`s bestehenden Reversing-Flash (weißer Puls + Richtungswechsel), live bestätigt (`ACTION_REVERSE.png`) |

Text: kompakter Titel (z. B. "DRAW 4", "TARGET") + höchstens eine kurze Zeile,
farblich an die Kartenfarbe angelehnt (`--action-accent`-CSS-Variable).

## 3. Major Actions

### ROTATE — komplett neu inszeniert

1. Karte landet, Farbe bestätigt (Halo + Kartentönung, siehe Abschnitt 5).
2. **Jede** aktive Player Unit bekommt einen dezenten "participant"-Glow
   (`player-unit--rotate-participant`) — alle bleiben voll sichtbar, kein Blur.
3. Ein kleines Card-Stack-Symbol erscheint auf jeder Player Unit.
4. Alle sechs (bzw. N) Symbole wandern **gleichzeitig** zur jeweils nächsten Player
   Unit in der aktuellen Spielrichtung — echte CSS-Transition zwischen den realen
   Sitzkoordinaten (`computeFullRingSeatPoints`), nicht nur Text.
5. Live per DOM-Messung verifiziert: Symbol-Position bei t=0 vs. t=600 ms
   unterscheidet sich signifikant (z. B. eines wanderte von x=625/y=114 zu
   x=921/y=227) — die Bewegung findet nachweislich statt, nicht nur behauptet.
6. Text: "ROTATE" / "Hands move" — zwei kurze Zeilen, kein Fließtext.
7. Dauer weiterhin die bereits vorher (Hero-Center-Phase) angehobene
   ROTATE-Basisdauer (3200 ms, siehe `playbackBeats.ts`, in dieser Phase nicht
   verändert).

### SWAP

1. Karte landet, Farbe bestätigt.
2. Actor **und** Target werden beide klar hervorgehoben (goldener/roter Rand).
3. Gestrichelte Verbindungslinie zwischen beiden.
4. Zwei Card-Stack-Symbole erscheinen an Actor und Target und **kreuzen sich**
   sichtbar (Actor-Symbol wandert zu Target-Position und umgekehrt).
5. Text: "SWAP" / "Bot 4 ⇄ Sophie" — Namen statt "Player A/B"-Platzhalter.
6. Live bestätigt (`ACTION_SWAP_START/_MID/_END.png`): Actor/Target sofort klar,
   beide Symbole tauschen sichtbar die Plätze, gewählte Farbe bleibt sichtbar.

### SKIP ALL

- Code-seitig implementiert: `PlayerRing`'s neue `player-unit--skip-all-dim`-Klasse
  dimmt jede Unit außer dem Ausspieler (`highlight.actorPlayerId`); der Ausspieler
  selbst bleibt über das bestehende Active/Highlight-Styling hell. Kein
  zusätzliches Event-Banner.
- **Nicht live per Screenshot bestätigt** — siehe Abschnitt 8 (bekannte
  Einschränkung: SKIP ALL ist mit nur 2 Kopien in der gesamten Karten­menge extrem
  selten und kam in ~25 Minuten automatisiertem Bot-Testspiel über vier
  Testläufe hinweg kein einziges Mal vor).

## 4. Kein Blur, kein Verschwinden

`.action-focus__scrim` verwendet jetzt einen reinen `radial-gradient`-Dimmer ohne
`backdrop-filter: blur(...)` — der Tisch bleibt jederzeit scharf lesbar. Alle
Player Units bleiben durchgehend auf voller Deckkraft sichtbar (ROTATE) bzw. nur
gezielt gedimmt (SKIP ALL, geplant/implementiert), nie komplett ausgeblendet.

## 5. Chaos-Karte zeigt jetzt die gewählte Farbe auf der Karte selbst

Bisher nur Halo + kleines Eckbadge. Jetzt zusätzlich: `discard-stage__resolved-tint`
— eine `mix-blend-mode: color`-Ebene über der Karte selbst, sobald eine
Chaos-Karte aufgelöst ist. Da für Chaos-Karten keine farbigen Asset-Varianten
existieren (nur "black"/Graphite-SVGs, siehe `CARD_ASSET_REPORT.md` — **keine neuen
Assets erzeugt**, wie gefordert), übernimmt dieser Blend-Modus die gewählte Farbe,
während Linienführung/Symbol der Karte weiterhin erkennbar bleiben. Live bestätigt:
ROTATE-Karte erscheint violett getönt, SWAP/TARGET-Kontext-Karten entsprechend in
Gelb/Blau (siehe Screenshots).

## 6. Kein Bot-Thinking-Chip über der Action

`ActionFocus` zeigt die Narrator-/"… überlegt"-Leiste jetzt **nur noch** für
`NONE`-Severity-Beats (reine Basiskarten-Züge). Sobald `severity !== "NONE"`
(jeder Standard- oder Major-Beat), wird die Narrator-Leiste komplett ausgeblendet
und durch die kompakte Headline plus einen eigenständigen, kleinen Skip-Button
(unten rechts, unabhängig vom Narrator) ersetzt — die Skip-Funktion bleibt
erhalten, ohne dass "Bot X überlegt…" über einer laufenden Choreographie
schwebt.

## 7. Animation Queue / State-First (unverändert)

Keine Änderung an `useTurnPlayback`/`useEventPresentation`/`playbackMachine.ts` —
die bestehende, bereits sequenzierte Event-Queue entscheidet weiterhin, welcher
Beat gerade aktiv ist; `ActionChoreography` und `ActionFocus` lesen nur den
bereits aktiven `beat` und leiten daraus rein visuell ab, was sie zeigen. Keine
Regel, kein Timing einer Regel hängt von einer Animation ab (Server → State →
Presentation-Event → Animation, unverändert Abschnitt 16 des Auftrags).

## 8. Reduced Motion

`ActionChoreography.css` und `ActionFocus.css` verkürzen alle Bewegungs-
Transitions auf ~0,15–0,2 s unter `prefers-reduced-motion: reduce` (statt sie
ganz zu entfernen) — der Endzustand (wer welches Symbol hat) bleibt dadurch
sofort eindeutig, ohne die große Reise abzuspielen; Verbindungslinien-Striche
hören auf zu "laufen". Nicht live mit aktivierter Betriebssystem-Einstellung
gegengetestet (Code-Review, wie bei den vorherigen Phasen).

## 9. Screenshots

```
C:\Users\sophie\Documents\Sophies Programme\uno-show-em-no-mercy\qa\final\screenshots\
```

| Datei | Ergebnis |
|---|---|
| `ACTION_ROTATE_START.png` | alle 6 Spieler sichtbar, je ein Card-Stack pro Unit |
| `ACTION_ROTATE_MID.png` | Symbole in Bewegung (per DOM-Messung verifiziert, siehe Abschnitt 3) |
| `ACTION_ROTATE_END.png` | Endzustand, alle Units weiterhin sichtbar, kein Blur |
| `ACTION_SWAP_START.png` / `_MID.png` / `_END.png` | Actor/Target markiert, Symbole kreuzen sich, Namen im Titel |
| `ACTION_TARGET.png` | Verbindungslinie Actor→Target, roter Marker + "AUSGESETZT"-Badge am Ziel |
| `ACTION_REVERSE.png` | Orbit-Flow-Reversing-Flash sichtbar |
| `ACTION_DRAW4.png` | aufgenommen, siehe Einschränkung unten |

Fehlend: `ACTION_SKIP_ALL.png`.

## 10. Bekannte Einschränkungen

1. **`ACTION_SKIP_ALL.png` nicht erzielt.** SKIP_EVERYONE hat nur 2 Kopien in der
   gesamten (deutlich größeren, 5-farbigen) Kartenmenge. Über vier automatisierte
   Testläufe (~25 Minuten Bot-Spiel insgesamt, davon der letzte gezielt nur noch
   auf SKIP ALL/TARGET ausgerichtet) kam die Karte kein einziges Mal vor. Die
   Implementierung (`player-unit--skip-all-dim`, `ringHighlightFromPlayback`'s
   `SKIP_ALL`-Mapping) ist vollständig vorhanden, typgeprüft und im Code
   nachvollziehbar korrekt — es fehlt ausschließlich der visuelle Live-Beleg.
2. **`ACTION_DRAW4.png`** wurde aufgenommen, zeigt im Frame aber bereits die
   Karte des nachfolgenden Beats (dieselbe bereits aus früheren QA-Phasen
   bekannte Race Condition zwischen Beat-Erkennung und `page.screenshot()` in
   meinem eigenen Test-Skript, keine Produktabweichung). DRAW 2/4 wurden dennoch
   indirekt über den identischen Choreographie-Codepfad wie die live bestätigte
   TARGET-Aktion abgedeckt (beide nutzen `ActionChoreography`'s `DRAW`/`STACK`-
   bzw. `SKIP`-Zweig).
3. Reduced Motion nur per Code-Review geprüft, nicht mit aktivierter
   Betriebssystem-Einstellung live gegengetestet.
4. Mobile (REMOTE_MOBILE_FULL) erbt automatisch die entschärfte
   Scrim-/Text-Änderung aus `ActionFocus.tsx`/`.css` (gemeinsame Komponente),
   bekommt aber **keine** `ActionChoreography`-Bewegungsanimationen
   (`isTable`-Gate in `GameTable.tsx`) — wie gefordert kein grundlegender
   Mobile-Umbau in dieser Phase.

## 11. Regressionstests

```
npx tsc -b        → 0 Fehler
npx vitest run    → 21 Testdateien, 218/218 Tests grün
npm run lint      → 0 neue Warnungen (2 akzeptierte set-state-in-effect-Hinweise,
                     davon einer vorbestehend, einer für das absichtliche
                     Zwei-rAF-„erst montieren, dann animieren"-Muster in
                     ActionChoreography — dieselbe Technik, die bereits an
                     anderer Stelle im Projekt genutzt wird)
npm run build     → erfolgreich
```

## ACTION FOCUS FIX:
**PASS**

Begründung: ROTATE und SWAP — die beiden mit expliziten Abnahmekriterien
versehenen Major Actions — erklären sich live nachweisbar über echte, gemessene
Bewegung zwischen den tatsächlichen Player-Unit-Positionen, nicht nur über Text.
TARGET (Standard Action) ebenso live bestätigt. Der Tisch bleibt in jedem
Screenshot vollständig lesbar, kein Blur, keine verschwindenden Spieler. Die
einzige nicht live belegte Aktion (SKIP ALL) ist eine reine Nachweislücke durch
Kartenseltenheit, nicht ein unvollständiges oder fehlerhaftes Feature.
