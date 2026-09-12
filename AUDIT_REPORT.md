# AUDIT_REPORT — GO DR*W YOURSELF

Datum: 2026-09-12
Geprüfte Version: Git-Commit `1298468` (aktueller Stand nach Karten-Redesign/Rebranding)
Methodik: Statische Code-Analyse + Live-Test gegen das echte, deployte Supabase-Backend
(Projekt `ohhhjegpfudbqcpajguc`) über `npm run dev`, gesteuert über 3 parallele Browser-Sessions
(Sophie/Host, Max, Tischgerät) plus gezielte direkte API-Aufrufe zur präzisen Reproduktion
einzelner Spielzustände (Draw-Stack, Bot-Ketten). Keine Code-Änderungen wurden vorgenommen.

---

# 1. Executive Summary

Das Fundament ist solide: Die Rule Engine ist sauber von Transport/UI getrennt, serverautoritativ
implementiert und durch 20 automatisierte Tests abgedeckt (alle grün). Der komplette
Multiplayer-Kreislauf (Lobby → Spielstart → Zug → Bot-Zug → Sieg) funktioniert Ende-zu-Ende gegen
die echte Datenbank, inklusive Draw-Stacking, Zielauswahl-Karten und Sicherheitsmodell (keine
fremden Handkarten erreichen je einen falschen Client). Es gibt keine Build- oder TypeScript-Fehler.

Die größten Lücken liegen nicht in der Spiellogik, sondern in drei Bereichen: (1) **Fehlermeldungen
werden system­bedingt nie in ihrer eigentlichen, freundlichen Form angezeigt** — jede
Server-Ablehnung erscheint als kryptisches „Edge Function returned a non-2xx status code"; (2) **es
gibt keinerlei Kartenbewegungs-Animation** — Zustände springen instant, mehrere Bot-Züge in Folge
sind für andere Clients komplett unsichtbar und erscheinen als ein einziger Sprung; (3) das aktuelle
Kartendesign ist bewusst minimalistisch (Icon + Farbe, kein Name/Untertitel, kein Kartentitel) und
liegt damit erkennbar unter dem neu definierten „Clean Premium"-Standard mit Namen/Untertitel.

Die neue 20-Karten-Taxonomie aus diesem Auftrag (PASS/LINK/PULSE/SHOVE/ARC,
TARGET/LOWEST/DITCH/SWAP/ROTATE, DRAW 2/DRAW 4/SKIP/REVERSE/SKIP ALL/DROP ALL,
WILD DRAW 6/10/REVERSE DRAW 4/COLOR ROULETTE) lässt sich **nicht zweifelsfrei** auf die im Code
vorhandenen internen Typnamen (`TRIANGLE`, `TARGET_SKIP`, `GIVE_TWO_TO_LOWEST`, `SWAP_HAND`,
`ROTATE_HANDS`, `SKIP_EVERYONE`, `DISCARD_ALL`, `DRAW_1` …) mappen — die Mechaniken hinter
TARGET/LOWEST/DITCH/SWAP/ROTATE sind bereits korrekt implementiert, aber unter alten Namen, und
`DRAW_1` sowie die farblose `WILD`-Karte kommen in der neuen Taxonomie gar nicht mehr vor. Das ist
in Phase 7 im Detail dokumentiert statt geraten.

---

# 2. Was bereits gut funktioniert

- **Rule Engine ist sauber und vollständig getestet.** `src/game/rulesEngine.ts` kennt keine
  UI-Abhängigkeit, alle 20 Tests in `tests/rulesEngine.test.ts` sind grün (Zugreihenfolge,
  Reverse/Skip, Draw-Stacking inkl. Summierung, TARGET_SKIP als *persistente* Markierung statt
  simplem Skip, GIVE_TWO_TO_LOWEST mit Ziel-Ermittlung zum Auflösungszeitpunkt, DISCARD_ONE_EXTRA
  mit garantiert unterdrücktem Zweiteffekt, SWAP_HAND, ROTATE_HANDS inkl. Bots und beider
  Richtungen, Mercy Rule, Sieg).
- **Sicherheitsmodell hält, was es verspricht.** Live gegen die echte DB verifiziert: Direkter
  `SELECT` auf `game_states` und `private_player_views` liefert leer; `get_private_state` gibt nur
  mit korrektem Session-Token exakt die eigene Hand zurück, mit falschem Token einen Fehler.
- **Draw-Stacking funktioniert korrekt und ist gut sichtbar.** Live getestet: Bot spielt
  `WILD_DRAW_4`, `STRAFE: +4` erscheint sofort und deutlich auf dem Tisch, Sophie zieht beim
  Aufnehmen exakt 4 Karten (6→10), der Pending-Effect wird danach korrekt zurückgesetzt, der Zug
  rückt richtig weiter.
- **Realtime-Sync der Lobby funktioniert einwandfrei.** Spieler-Beitritt, Bot-Hinzufügen und
  Bot-Entfernen erscheinen sofort auf allen verbundenen Geräten (getestet mit 3 gleichzeitigen
  Sessions).
- **Rollenauswahl beim Beitreten** (Spieler/Spieltisch/Zuschauer) mit progressivem Namensfeld nur
  bei „Spieler" funktioniert genau wie vorgesehen.
- **Tisch-Ansicht (Vollbild, Landscape) ist bereits nah am Zielbild:** kreisförmige Spieleranordnung,
  aktueller Spieler klar hervorgehoben, keine privaten Karteninhalte sichtbar, dunkler,
  aufgeräumter Look ohne Debug-Dashboard-Charakter.
- **Bot-Entfernung in der Lobby funktioniert** (server- und UI-seitig bestätigt über direkten
  API-Aufruf mit Host-Session — 200 OK, Bot verschwindet).
- **Aufgefächerte Hand-Darstellung ist vorhanden** und nicht mehr die alte flache, überlappende
  Reihe — Karten rotieren und heben sich zur Kante hin an, wie gefordert.
- **Aktionskarten sind optisch von reinen Symbolkarten unterschieden** (holografischer
  Farbverlaufsrahmen nur auf Karten mit Regeleffekt) — Mechanismus korrekt verifiziert
  (`uno-card--action`-Klasse sitzt exakt auf den richtigen Kartentypen, nicht auf `TRIANGLE` /
  `SQUARE` / `CIRCLE` / `DIAMOND` / `SEMICIRCLE`).
- **Jede Karte hat einen Klartext-Accessible-Name** (`aria-label`/`title`), unabhängig vom Icon —
  erfüllt die Barrierefreiheits-Anforderung.
- Build (`npm run build`) und Tests (`npm test`) laufen beide fehlerfrei durch.

---

# 3. Kritische Fehler (P0)

### ID: BUG-001
**Bereich:** Fehlerbehandlung (systemweit)
**Ist:** Jede Fehlermeldung, die eine Edge Function mit einem Nicht-2xx-HTTP-Status zurückgibt
(also praktisch jede — `NOT_HOST`, `NOT_ENOUGH_PLAYERS`, `CARD_NOT_PLAYABLE`, `INVALID_SWAP_TARGET`,
`STALE_GAME_STATE` usw.), erscheint im UI ausschließlich als:
`Edge Function returned a non-2xx status code`
**Soll:** Die sorgfältig übersetzten, verständlichen deutschen Meldungen aus `src/game/errors.ts`
bzw. den einzelnen `errorResponse(...)`-Aufrufen in den Edge Functions.
**Ursache (verifiziert im Code):** `src/multiplayer/api.ts`, Funktion `invoke()`:
```ts
const { data, error } = await supabase.functions.invoke(fn, { body });
if (error) throw error;                      // ← wirft HIER bereits bei jedem Nicht-2xx-Status
if (data?.error) throw new Error(data.error.message ?? data.error.code); // wird nie erreicht
```
`supabase-js` liefert bei einem Nicht-2xx-Status einen `FunctionsHttpError` mit generischer
`.message` und setzt `data` auf `null` — die zweite Zeile, die die eigentliche JSON-Fehlermeldung
auslesen würde, wird dadurch nie erreicht.
**Live reproduziert:** „Spiel starten" mit nur 1 Spieler (frische, unkorrumpierte Session) zeigt
exakt diesen generischen Text statt „Mindestens 2 Spieler nötig."
**Betroffene Dateien:** `src/multiplayer/api.ts` (zentrale `invoke()`-Funktion — ein einziger Fix
behebt alle Aufrufer: Lobby, PlayerGame, WinnerOverlay, Join).
**Priorität:** P0
**Aufwand:** LOW
**Empfohlene Änderung:** Im `catch`/Error-Zweig von `invoke()` bei einem `FunctionsHttpError` den
tatsächlichen Response-Body auslesen (`error.context.json()` bzw. äquivalent) und dessen
`error.message` verwenden, bevor auf den generischen Text zurückgefallen wird.
**NOCH NICHT UMGESETZT.**

---

# 4. Funktionale Abweichungen (P1)

### ID: FUNC-001
**Bereich:** Kartensystem — Taxonomie/Namen
**Ist:** Interne Typnamen sind `TRIANGLE, SQUARE, CIRCLE, DIAMOND, SEMICIRCLE` (Basic),
`TARGET_SKIP, GIVE_TWO_TO_LOWEST, DISCARD_ONE_EXTRA, SWAP_HAND, ROTATE_HANDS` (Action), plus
weiterhin `SKIP, REVERSE, DRAW_1, DRAW_2, WILD, WILD_DRAW_4/6/10, SKIP_EVERYONE, DISCARD_ALL,
WILD_REVERSE_DRAW_4, WILD_COLOR_ROULETTE`.
**Soll (dieser Auftrag):** `PASS, LINK, PULSE, SHOVE, ARC` (Basic) / `TARGET, LOWEST, DITCH, SWAP,
ROTATE` (Action) / `DRAW 2, DRAW 4, SKIP, REVERSE, SKIP ALL, DROP ALL` (Standard Action) /
`WILD DRAW 6, WILD DRAW 10, WILD REVERSE DRAW 4, COLOR ROULETTE` (Chaos/Wild).
**Befund:** Die **Mechanik** hinter TARGET/LOWEST/DITCH/SWAP/ROTATE ist bereits korrekt
implementiert (siehe Abschnitt 8 — alles PASS) — es handelt sich um eine **Umbenennung**, nicht um
fehlende Logik. Für die 5 Basic-Karten (PASS/LINK/PULSE/SHOVE/ARC) lässt sich **keine eindeutige
1:1-Zuordnung** zu TRIANGLE/SQUARE/CIRCLE/DIAMOND/SEMICIRCLE herstellen, ohne eine Regel zu
erfinden — dafür fehlt eine offizielle Mapping-Tabelle oder das Asset-Paket.
**Zusätzlicher Fund:** `DRAW_1` (Farbkarte, 2× pro Farbe im Deck) taucht in der neuen Taxonomie
**gar nicht** auf. Die farblose reine `WILD`-Karte (nur Farbwahl, kein Zieheffekt) ebenfalls nicht.
Umgekehrt taucht in der neuen Taxonomie eine **farbige** „DRAW 2 / DRAW 4" unter „Standard Action"
auf (nicht unter Chaos/Wild) — aktuell existiert nur eine farblose `WILD_DRAW_4`, keine farbige
Version.
**Betroffene Dateien:** `src/game/types.ts`, `src/game/cards.ts`, `src/components/Card/CardIcons.tsx`
**Priorität:** P1
**Aufwand:** MEDIUM (reine Umbenennung + Klärung der zwei offenen Fragen oben)
**Empfohlene Änderung:** Offizielle Mapping-Tabelle bzw. Master-Asset-Paket anfordern, bevor
Typnamen umbenannt werden, um keine Regel zu erfinden (`TODO_DEFINE_CARD_NAME_MAPPING`).
**NOCH NICHT UMGESETZT.**

### ID: FUNC-002
**Bereich:** Lobby → Raum betreten
**Ist:** `RoomPage` ruft bei **jedem** Mount — auch unmittelbar nach `create-room`/`join-room`, wo
Status und alle Daten bereits bekannt sind — die `reconnect`-Edge-Function auf und zeigt bis zur
Antwort einen vollflächigen „Verbinde…"-Ladebildschirm.
**Soll:** Kein sichtbarer Ladebildschirm beim direkten Weg Neues-Spiel/Beitreten → Lobby; „Verbinde…"
ist nur für echte Reconnects (Seiten-Reload) sinnvoll.
**Ursache:** `src/pages/RoomPage.tsx`, Zeilen 20–32 — unterscheidet nicht zwischen frischer
Navigation (Session gerade erst erzeugt) und echtem Reload/Reconnect.
**Betroffene Dateien:** `src/pages/RoomPage.tsx`, `src/pages/Home.tsx`, `src/pages/Join.tsx`
**Priorität:** P1
**Aufwand:** LOW
**Empfohlene Änderung:** Bekannten Status (immer `LOBBY` direkt nach erfolgreichem Create/Join) per
Router-State an `RoomPage` mitgeben und den `reconnect()`-Call nur ausführen, wenn dieser State
fehlt.
**NOCH NICHT UMGESETZT.**

### ID: FUNC-003
**Bereich:** Session-Persistenz / Mehrere Tabs im selben Browser
**Ist:** Die Session (`{roomId, deviceId, sessionToken, role, playerId}`) liegt in `localStorage`,
das **pro Origin, nicht pro Tab** gilt. Öffnet man testweise mehrere Rollen im selben Browser in
verschiedenen Tabs (ein sehr gängiges Vorgehen, um Multiplayer ohne mehrere Geräte zu testen),
überschreibt jeder neue Beitritt die Session des vorherigen Tabs. Ein bereits offener Tab merkt
davon zunächst nichts (React-State bleibt im Speicher), aber ein Reload dieses Tabs lädt dann die
falsche, fremde Session.
**Soll:** Getrennte Devices/Browser sind der Produktivfall und funktionieren korrekt (mit echten
Geräten kein Problem). Für den in der Praxis sehr verbreiteten Test-/Vorführ-Fall „mehrere Tabs auf
einem Laptop" wäre Isolation pro Tab wünschenswert.
**Betroffene Dateien:** `src/multiplayer/session.ts`
**Priorität:** P1 (kein Produktivbug, aber ein reales Robustheits-/Testbarkeitsproblem)
**Aufwand:** LOW
**Empfohlene Änderung:** `sessionStorage` statt `localStorage` verwenden — bleibt bei Reload
desselben Tabs erhalten (erfüllt weiterhin „Reload zerstört das Spiel nicht"), ist aber nicht mehr
tab-übergreifend geteilt.
**NOCH NICHT UMGESETZT.**

---

# 5. UI-/UX-Abweichungen (P1/P2)

### ID: UX-001
**Bereich:** Bot-Zug-Wahrnehmung / Zustandssprünge
**Ist:** `dispatch-action` führt serverseitig **alle** nachfolgenden Bot-Züge in einer Schleife
(`runBotTurnsUntilHumanOrOver`) komplett durch und broadcastet den State genau **einmal**, erst
danach (`persistAndBroadcast` wird nur nach der Schleife aufgerufen, siehe
`supabase/functions/dispatch-action/index.ts` Zeilen 40–42). Für alle Clients außer dem gerade
handelnden Spieler ist eine Kette von z. B. 2–3 Bot-Zügen dadurch **komplett unsichtbar** — der
Tisch „springt" nach einer Pause direkt in den Endzustand mehrerer Züge weiter.
**Soll:** Jeder einzelne Zug (auch Bot-Züge) soll für alle Geräte einzeln nachvollziehbar sein.
**Priorität:** P1
**Aufwand:** HIGH (verlangt Zwischen-Broadcasts pro Bot-Zug statt eines Sammel-Broadcasts —
architekturell nicht trivial, siehe Abschnitt 13)
**NOCH NICHT UMGESETZT.**

### ID: UX-002
**Bereich:** Eigene Hand — vertikales Clipping (Mobile Portrait)
**Ist:** Auf 375×812 liegt `.player-hand__fan` bei y=692 mit `scrollHeight=143px`, aber
`.player-game` hat `overflow: hidden` und endet exakt bei `812px` — die durch den Fächer-Effekt nach
unten „absackenden" äußeren Karten werden am unteren Rand ca. 20–25px abgeschnitten, ohne dass
irgendein Scrollen dies zugänglich macht (bestätigt: `document.documentElement.scrollHeight ===
window.innerHeight`, keine Seiten-Scrollmöglichkeit vorhanden).
**Soll:** Vollständige Sichtbarkeit jeder Handkarte auf Smartphone-Portrait (375×812, 390×844,
430×932).
**Betroffene Dateien:** `src/pages/PlayerGame.css` (`.player-game { overflow: hidden }`),
`src/components/PlayerHand/PlayerHand.tsx` (Fächer-Rise-Werte)
**Priorität:** P1
**Aufwand:** LOW–MEDIUM
**Empfohlene Änderung:** Entweder Fächer-Rise auf kleinen Viewports reduzieren, oder der
`.player-game__board`/`.player-hand`-Höhenaufteilung mehr Raum für die Hand zuweisen, oder
`overflow: hidden` gegen `overflow-y: auto` auf dem äußeren Container tauschen.
**NOCH NICHT UMGESETZT.**

### ID: UX-003
**Bereich:** Tisch-Layout — vertikaler Leerraum
**Ist:** Auf hohen/schmalen Viewports (getestet 375×812 eingebettet, sehr ausgeprägt bei
768×1024/Tablet) entsteht zwischen dem oberen Spieler-Badge und der Tischmitte sowie zwischen
Tischmitte und dem unteren Rand ein sehr großer, ungenutzter grüner Leerraum — die
Ellipsen-Platzierung (`seatStyle` in `Table.tsx`, feste Prozentwerte `rx=44, ry=40`) skaliert nicht
mit dem tatsächlich verfügbaren Platz.
**Soll:** „Table Layout Hierarchy/Spacing" ohne große funktionslose Leerflächen (Phase 11).
**Betroffene Dateien:** `src/components/Table/Table.tsx`, `src/components/Table/Table.css`
**Priorität:** P2
**Aufwand:** MEDIUM
**NOCH NICHT UMGESETZT.**

### ID: UX-004
**Bereich:** Disabled-Karten-Kontrast
**Ist:** Nicht spielbare Karten (`.uno-card--disabled`: `grayscale(0.6) brightness(0.6)`) sind visuell
nur leicht gedimmt und im Live-Test auf den ersten Blick kaum von spielbaren Karten zu
unterscheiden.
**Soll:** „Spielbare Karten müssen auswählbar bleiben" / nicht spielbare klar erkennbar reduziert.
**Betroffene Dateien:** `src/components/Card/Card.css`
**Priorität:** P2
**Aufwand:** LOW
**NOCH NICHT UMGESETZT.**

### ID: UX-005
**Bereich:** Zielauswahl-Phasen (Handtausch/Skip/Farbwahl)
**Ist:** Bereits im vorherigen Durchgang behoben und **live re-verifiziert**: `legalMoves` ist
außerhalb von `WAITING_FOR_PLAY` korrekt leer, die Hand wird während der Auswahlphase sichtbar
ausgegraut (`player-game__hand-wrap--receded`). **Kein offener Punkt mehr**, hier nur zur
Vollständigkeit dokumentiert, da explizit in der Aufgabenliste (Phase 5) genannt.
**Priorität:** —
**Status:** PASS (bereits erledigt vor diesem Audit)

---

# 6. Karten-Design-Abweichungen (Ist vs. Soll)

**Klassifikation (Phase 6):** Die Karte ist **(A) vollständig CSS-generiert** — Kartenkörper via
CSS-Gradient/Border, Icon als inline gerendertes React/SVG (`CardIcons.tsx`), **keine** externen
Bild-Assets (`.svg`/`.png`) für Karten im Projekt vorhanden (`find`-Suche über gesamtes Repo:
keine Treffer außer `favicon.svg`/`icons.svg`, unabhängig vom Kartensystem).

| Merkmal | Ist | Soll (Clean Premium) | Abweichung |
|---|---|---|---|
| Kartenkörper | Dunkler Verlauf, `--card-color` je Farbe | dunkler Kartenkörper | ✅ erfüllt |
| Rahmen | 3px weiß (normal) / holografischer Verlauf (Aktionskarten) | subtiler Hologlow | teilweise — Glow ist ein reiner CSS-`border-image`, kein weicher Leucht-Schatten |
| Icon-Größe | 62% der Kartenfläche, ein zentrales Icon | große, klare Icons | ✅ erfüllt |
| **Kartenname** | **nicht vorhanden** | **erforderlich** | ❌ fehlt vollständig |
| **Untertitel** | **nicht vorhanden** | **erforderlich** | ❌ fehlt vollständig |
| Typografie | keine sichtbare Schrift auf der Karte selbst | moderne Sans-Serif für Name/Untertitel | ❌ nicht anwendbar (kein Text vorhanden) |
| Farbflächen | 5 feste Hex-Werte je Farbe | satte Farbakzente | ✅ erfüllt |
| Konsistenz | einheitlich über alle Kartentypen | — | ✅ erfüllt |
| Lesbarkeit (Icon+Farbe) | gut, im Live-Test auf 375px-Breite noch erkennbar, aber einzelne Icons (z. B. TARGET_SKIP, GIVE_TWO_TO_LOWEST) wirken bei 72×104px recht klein/unklar in der Detailform | klar lesbar | teilweise |
| Premium-Wirkung | dezent, funktional, aber ohne Namen wirkt die Karte eher wie ein reines Symbol-Icon als wie eine vollwertige „Spielkarte" | moderne Party-Game-Wirkung | teilweise |

**Wichtigster Einzelbefund:** Der größte Ist/Soll-Unterschied ist nicht die Optik der Icons selbst,
sondern das komplette Fehlen von Kartenname und Untertitel — beides ist im neuen Standard explizit
gefordert, in der aktuellen Komponente aber architektonisch gar nicht vorgesehen (`Card.tsx` rendert
ausschließlich einen einzelnen Icon-Container, keinen Text-Slot).

Die 5 genannten Masterkarten (RED PASS, BLUE SWAP, GREEN LOWEST, YELLOW ROTATE, WILD COLOR
ROULETTE) sowie ein Asset-Paket dazu wurden in diesem Projektverzeichnis **nicht gefunden** — falls
sie als Anhang zur Verfügung stehen, sind sie mir aktuell nicht zugänglich; ich habe sie daher nur
nach der textuellen Beschreibung in diesem Auftrag bewertet, nicht pixelgenau verglichen.

---

# 7. Animationsprobleme (mit aktuellen Timings)

Aktuell gemessene/im Code verifizierte Werte:

```
CARD_PLAY_ANIMATION      = 0 ms   (kein Flug/Bewegung — Karte verschwindet aus der Hand,
                                    erscheint beim nächsten Re-Fetch direkt auf dem Ablagestapel)
BOT_THINK_DELAY          = 500–1200 ms  (botLoop.ts, BOT_THINK_MIN_MS/MAX_MS — zufällig pro Zug)
BOT_CARD_ANIMATION       = 0 ms   (identisch zu Spieler-Zügen: kein Flug)
TURN_ADVANCE_DELAY       = 0 ms   (sofortiger State-Sprung, kein Übergangs-Timing)
HAND_ROTATE/SWAP_PULSE   = 900 ms (Table.css table-board-pulse/-center-pulse — EINZIGE
                                    vorhandene "Aktions-Animation" im ganzen Projekt, siehe unten)
MULTI-BOT-CHAIN VISIBILITY = 0 ms für Zwischenzüge (siehe UX-001) — nur der Endzustand nach
                                    N × 500–1200 ms erscheint
```

**Vorhandene Animation (einzige Ausnahme):** `useHandShufflePulse` in `Table.tsx` löst bei
`ROTATE_HANDS`/`SWAP_HAND` einen 900ms CSS-Puls auf allen Spieler-Badges plus einen
Center-Scale-Puls aus — bewusst als "gerade genug Feedback" dokumentiert, kein echtes
Event-/Choreografie-System.

**Nicht vorhanden (0 ms / kein visuelles Feedback):**
- Kartenflug vom Spieler zum Ablagestapel (weder Mensch noch Bot)
- Ziehanimation (Karten vom Ziehstapel zur Hand)
- Skip-Animation / „AUSGESETZT"-Stempel-Erscheinen (Stempel selbst ist statisch vorhanden, siehe
  `table-board__skip-stamp`, aber ohne Ein-/Ausblend-Übergang)
- Winner-Animation (Overlay erscheint sofort, kein Fade/Scale-In)
- Turn-Wechsel-Übergang (State ändert sich ohne jede visuelle Überleitung)

**Soll/Ist-Vergleich (Richtwerte aus diesem Auftrag):**

| Ereignis | Soll | Ist |
|---|---|---|
| Bot initial reaction | 250–500 ms | 500–1200 ms (im Soll-Bereich für die Obergrenze, im Schnitt aber höher/breiter gestreut) |
| Card flight | 450–650 ms | 0 ms (nicht vorhanden) |
| Simple action effect | 400–700 ms | 0 ms (nicht vorhanden) |
| Complex action | 700–1100 ms | 0 ms außer Rotate/Swap-Puls (900 ms, im Zielkorridor) |
| Turn transition | 200–350 ms | 0 ms (nicht vorhanden) |

Die Grundregel „State zuerst, Animation danach" wird bereits eingehalten (jede Zustandsänderung ist
in der DB persistiert, bevor irgendeine Darstellung reagiert) — es gibt schlicht noch keine
Animationsschicht, die auf diese State-Änderungen reagiert.

---

# 8. Spezialkarten — Detailprüfung (Phase 8)

| Karte | Status | Befund |
|---|---|---|
| **TARGET** (`TARGET_SKIP`) | **PASS** | Frei wählbares Ziel, Effekt persistiert korrekt bis zum tatsächlich nächsten eigenen Zug des Ziels (nicht simpler Skip des Folgespielers) — live verifiziert: A→C markiert, B spielt normal dazwischen, C wird beim eigentlichen Erreichen übersprungen, Markierung danach entfernt. Status ist über `pendingSkipTargets` im Public State sichtbar (Tisch zeigt „AUSGESETZT"-Stempel). |
| **LOWEST** (`GIVE_TWO_TO_LOWEST`) | **PASS** | Ziel wird automatisch zum Auflösungszeitpunkt bestimmt (nicht beim Ausspielen), unterscheidet sich klar von normaler `DRAW_2` (eigener Kartentyp, eigenes Icon). Gleichstand-Verhalten ist bewusst als `TODO_DEFINE_LOWEST_HAND_TIE_RULE` markiert (Sitzreihenfolge als Platzhalter) — korrekt, keine erfundene Regel als Tatsache dargestellt. |
| **DITCH** (`DISCARD_ONE_EXTRA`) | **PASS** | Exakt eine zusätzliche Karte wird über einen eigenen Aktionspfad (`DISCARD_EXTRA_CARD`) abgeworfen; per Unit-Test verifiziert, dass eine als Zusatzkarte abgeworfene `DRAW_2` ihren Zieheffekt **nicht** auslöst. |
| **SWAP** (`SWAP_HAND`) | **PASS** | Kompletter Handtausch mit frei wählbarem Ziel, Bots als Ziel möglich (Unit-Test deckt Bot-Ziel ab). |
| **ROTATE** (`ROTATE_HANDS`) | **PASS** | Alle aktiven Hände rotieren korrekt in beide Richtungen, Bots vollständig eingeschlossen (2 dedizierte Unit-Tests für beide Richtungen mit 4 Spielern inkl. 2 Bots). |

Alle fünf Spezialkarten sind **funktional korrekt** — die einzige Abweichung ist die bereits in
Abschnitt 4/FUNC-001 dokumentierte Namensdifferenz zur neuen Taxonomie.

---

# 9. Bot-Probleme

### ID: BOT-001
**Bereich:** Bot-Zug-Kette / Wahrnehmung (Duplikat von UX-001, hier aus Bot-Perspektive)
**Ist:** Da alle Bot-Züge serverseitig in einer Schleife vor dem einzigen Broadcast ablaufen, „fühlen
sich Bot-Züge zu schnell an" nicht, weil die einzelne Denkpause zu kurz wäre (500–1200 ms ist
plausibel), sondern weil **mehrere Bot-Züge hintereinander komplett unsichtbar** sind und erst der
Endzustand erscheint. Aus Sicht eines Table-Geräts oder eines wartenden Mitspielers wirkt das nicht
„zu schnell", sondern wie ein unmotivierter Sprung.
**Ursache:** `supabase/functions/_shared/botLoop.ts` (Schleife) + `dispatch-action/index.ts`
(einziger `persistAndBroadcast`-Aufruf danach), analog `start-game`/`next-round`/`replace-with-bot`.
**Priorität:** P1
**Aufwand:** HIGH
**NOCH NICHT UMGESETZT.**

### ID: BOT-002
**Bereich:** Bot-Denkzeit-Streuung
**Ist:** `BOT_THINK_MIN_MS=500`, `BOT_THINK_MAX_MS=1200` — liegt an der oberen Grenze bzw. leicht
über dem gewünschten Korridor (250–500 ms) für die *erste* Reaktion.
**Priorität:** P2
**Aufwand:** LOW (zwei Konstanten)
**NOCH NICHT UMGESETZT.**

Bot-Entscheidungsqualität selbst (Kartenwahl, Zielwahl) wurde nicht separat geprüft, da außerhalb
des Scopes dieses Audits (reine UX-/Timing-Fragestellung, nicht Spielstärke).

---

# 10. Multiplayer-/Realtime-Probleme

- **Lobby-Realtime: PASS.** Spieler-Beitritt/Bot-Hinzufügen/-Entfernen erscheinen sofort auf allen
  Geräten (`postgres_changes` auf `players`, korrekt in der `supabase_realtime`-Publication).
- **Spielstart-Übergang: PASS.** Alle Geräte wechseln korrekt von Lobby zu Spiel/Tisch-Ansicht,
  sobald `rooms.status` auf `PLAYING` wechselt.
- **Sicherheitsmodell: PASS**, siehe Abschnitt 2.
- **Session-Kollision bei Mehrfach-Tabs: siehe FUNC-003** — kein Bug im engeren Sinn, aber ein
  reales Robustheitsproblem für die naheliegende Testmethode „mehrere Tabs, ein Browser".
- **Broadcast-Granularität: siehe UX-001/BOT-001** — der wichtigste Realtime-Befund dieses Audits.
- Reconnect (`reconnect`-Function) selbst wurde nicht mit einem echten Verbindungsabbruch getestet
  (nur der Lobby-Eintritts-Pfad, siehe FUNC-002), da das außerhalb einer Browser-Automatisierung
  ohne echten Netzwerkabbruch schwer sauber zu simulieren ist. Der Code lädt beim Reconnect den
  öffentlichen State neu; ob `pendingSkipTargets`/`pendingDrawAmount` nach einem echten Abbruch
  korrekt im UI ankommen, konnte in dieser Session nicht abschließend am Gerät verifiziert werden
  (serverseitig ist der Zustand nachweislich korrekt persistiert, da rein DB-basiert).

---

# 11. Responsive Probleme

Getestet: 375×812 (PlayerGame, live), 768×1024 (PlayerGame + TableGame, live). 390×844, 430×932,
1366×768, 1920×1080 wurden aus Zeitgründen nicht einzeln durchprobiert, aber basierend auf den
beiden extremsten getesteten Breakpoints (kleinstes Portrait-Handy und Tablet-Querformat) sind die
strukturellen Probleme bereits sichtbar und dürften sich in den dazwischenliegenden Größen ähnlich
oder abgeschwächt zeigen:

| Breakpoint | Befund |
|---|---|
| 375×812 | Hand-Fächer wird am unteren Rand ~20–25px abgeschnitten (UX-002). Tisch-Ellipse hat spürbaren, aber noch vertretbaren Leerraum. |
| 768×1024 | Hand vollständig sichtbar (kein Clipping). Tisch-Ellipse hat **sehr** großen ungenutzten Leerraum oben/unten (UX-003, hier am deutlichsten). |
| Home/Join-Seiten | Bei allen getesteten Breiten unauffällig, Panel-Layout mit `min(360px, 90vw)` skaliert sauber. |

---

# 12. Asset-Integration (Vorbereitung für später)

- **Aktuelle Rendermethode:** Karten sind zu 100 % CSS/DOM-generiert. Icons liegen als React-Funktionskomponenten
  vor, die inline `<svg>`-Markup zurückgeben (`src/components/Card/CardIcons.tsx`,
  `ICON_BY_TYPE: Record<CardType, () => ReactElement>`), keine `<img>`-Tags, keine externen
  Dateien.
- **Betroffene Komponente für einen Umstieg auf Datei-Assets:** ausschließlich `src/components/Card/Card.tsx`
  — sie ist bereits die einzige Stelle, die Icon + Kartenkörper zusammensetzt. Ein Wechsel auf
  `<img src=".../svg/{type}_{color}.svg">` mit PNG-Fallback würde nur diese eine Datei sowie
  `CardIcons.tsx` (dann obsolet) betreffen; `PlayerHand.tsx`, `Table.tsx` und alle Seiten reichen
  weiterhin nur `CardDefinition` durch und müssten nicht angefasst werden.
- **Für Kartenname/Untertitel (Abschnitt 6):** `Card.tsx` bräuchte einen zusätzlichen Text-Slot
  (zwei `<span>`s analog zum Icon-Slot) plus eine Name/Untertitel-Lookup-Tabelle pro `CardType` —
  architektonisch eine kleine, isolierte Erweiterung, keine Neustrukturierung.
- Vorgeschlagene Struktur `/public/assets/cards/svg` + `/public/assets/cards/png` existiert aktuell
  **nicht** — beide Ordner müssten neu angelegt werden, nichts davon ist heute vorhanden oder
  referenziert.
- Kein Bug, aber notiert: `npm install` meldet 28 Sicherheits-Advisories (1 low, 11 moderate, 15
  high, 1 critical) — nach Prüfung stammen diese ausschließlich aus der `vercel`-CLI-Abhängigkeit
  (Dev-Dependency fürs Deployment, nicht Teil des ausgelieferten Browser-Bundles). Nicht
  spielrelevant, aber der Vollständigkeit halber dokumentiert.

**NOCH NICHTS DAVON UMGESETZT.**

---

# 13. Quick Wins (kleiner Aufwand, großer Effekt)

1. **BUG-001 beheben** (Fehlermeldungen) — einzige Codeänderung in `api.ts`, macht sofort jede
   künftige Fehlermeldung im ganzen Spiel verständlich. Höchster Effekt/Aufwand-Quotient im ganzen
   Report.
2. **FUNC-002** (unnötiges „Verbinde…" bei frischer Navigation) — kleine Änderung, spürbar
   schnelleres Gefühl beim Rauminstieg.
3. **FUNC-003** (`sessionStorage` statt `localStorage`) — eine Zeile Import-Änderung, behebt die
   Mehrfach-Tab-Kollision vollständig.
4. **UX-004** (Kontrast nicht spielbarer Karten) — reiner CSS-Wert.
5. **BOT-002** (Bot-Denkzeit-Konstanten auf 250–500 ms senken) — zwei Zahlenwerte.
6. **UX-002** (Hand-Clipping auf 375px) — lokal begrenzte CSS-Anpassung an `.player-game`/Fächer-Werten.

---

# 14. Größere Refactorings (nur falls wirklich notwendig)

1. **UX-001/BOT-001 — granulare Bot-Zug-Broadcasts.** Um jeden einzelnen Bot-Zug (nicht nur den
   Endzustand einer Kette) sichtbar zu machen, müsste `runBotTurnsUntilHumanOrOver` nach **jedem**
   einzelnen Bot-Zug `persistAndBroadcast` aufrufen statt erst am Ende der Schleife. Das ist
   architektonisch machbar (die Funktion iteriert bereits Zug für Zug), aber erhöht die Anzahl der
   DB-Writes/Broadcasts pro Aktion um den Faktor „Anzahl Bot-Züge in der Kette" — sollte zusammen
   mit der eigentlichen Animationsschicht (siehe unten) geplant werden, nicht isoliert.
2. **Vollständiges Event-/Animationssystem** (aus dem ursprünglichen UI/UX-Brief, bewusst
   zurückgestellt): `CARD_PLAYED`, `CARDS_DRAWN`, `PLAYER_SKIPPED` etc. als eigene, öffentliche
   Realtime-Events statt reiner State-Diffs, plus eine Client-seitige Animations-Queue, die diese
   Events unabhängig vom nächsten State-Update abspielt. Dies ist die Voraussetzung, um die in
   Abschnitt 7 verlangten Timings (Kartenflug, Zieheffekt etc.) sauber umzusetzen, ohne die
   „State zuerst, Animation danach"-Regel zu verletzen.
3. **Kartenname/Untertitel + ggf. Datei-Assets** (Abschnitt 6/12) — kein Pflicht-Refactoring, aber
   sinnvollerweise in einem Zug mit der Icon-Überarbeitung zu erledigen, sobald das Master-Asset-Paket
   vorliegt.

---

# 15. Empfohlene Reihenfolge (Implementierungsplan für Phase 2)

1. BUG-001 (Fehlermeldungen) — sofort, low-risk, betrifft alle folgenden Tests positiv.
2. FUNC-002 + FUNC-003 (Verbinde-Screen, sessionStorage) — beide low-risk, verbessern sofort das
   Testen/Vorführen.
3. UX-004 + BOT-002 (Kontrast, Bot-Timing) — triviale Werteänderungen.
4. UX-002 (Hand-Clipping Mobile) — vor jeder Karten-Redesign-Arbeit fixen, sonst überträgt sich das
   Problem auf neue Assets.
5. Klärung FUNC-001 (Namens-Mapping) mit offizieller Tabelle/Asset-Paket, **bevor** Typnamen
   umbenannt werden.
6. Karten-Redesign (Name/Untertitel-Slot, ggf. Datei-Assets) — nach Punkt 5, damit Namen feststehen.
7. UX-003 (Tisch-Leerraum) — kann parallel zu 6 laufen, ist unabhängig vom Kartendesign.
8. UX-001/BOT-001 + vollständiges Animationssystem — größtes Einzelvorhaben, zuletzt, da es von
   einem stabilen Kartendesign (Punkt 6) profitiert (Animationen brauchen ein fertiges visuelles
   Ziel, zu dem sie hin animieren).

---

## Zusammenfassung der Testabdeckung nach Phasen

| Phase | Ergebnis |
|---|---|
| 2 — Build/Test | PASS (0 Fehler, 20/20 Tests) |
| 4 — Lobby | PASS, mit FUNC-002 (Verbinde-Screen) und FUNC-003 (Tab-Kollision) als Anmerkungen |
| 5 — Kartenhand | PARTIAL (Fächer vorhanden, aber UX-002 Clipping auf kleinem Mobile) |
| 6 — Kartendesign | PARTIAL (Icon/Farbe gut, Name/Untertitel fehlt komplett) |
| 7 — Neues Kartensystem | PARTIAL (Mechanik korrekt, Namen weichen von der neuen Taxonomie ab) |
| 8 — Spezialkarten | PASS (alle 5 funktional korrekt) |
| 9 — Draw Stacking | PASS |
| 10 — Animationen | FAIL (keine Bewegungsanimationen vorhanden, nur ein Rotate/Swap-Puls) |
| 11 — Table UI | PARTIAL (Hierarchie/Look gut, Leerraum-Problem UX-003) |
| 12 — Bot UX | PARTIAL (Denkzeit ok, aber Zug-Kette unsichtbar — BOT-001) |
| 13 — Winner Screen | PASS (per Code-Review + früherer Live-Verifikation; in dieser Session nicht erneut bis zum echten Sieg durchgespielt) |
| 14 — Responsive | PARTIAL (2 von 6 Ziel-Breakpoints live geprüft, beide mit Befunden) |
