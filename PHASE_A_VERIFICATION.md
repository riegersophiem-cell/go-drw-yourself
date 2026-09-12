# PHASE A — Bestand bestätigen

Datum: 2026-09-12 (Folgesession zu AUDIT_REPORT.md)
Ausgangs-Commit des Audits: `1298468`
Aktueller Commit bei Prüfungsbeginn: `1298468` (identisch)
Uncommittete Änderungen bei Prüfungsbeginn: nur `AUDIT_REPORT.md` (neu, unversioniert) — keine
Code-Änderungen. Working Tree ansonsten sauber.
In dieser Phase wurde **keine Zeile Projektcode verändert**. Alle Tests liefen gegen einen eigens
angelegten Testraum (`2EUJAG` / `4801235f-a833-44e2-939e-3607ad954bdd`, Spielerin „AuditSophie" +
1 Bot), niemals gegen ein laufendes Spiel Dritter.

---

## 1. Build & Tests (unverändert seit Audit)

```
npm run build   → tsc -b && vite build   → 0 Fehler, dist/ erzeugt
npm test        → vitest run             → 20/20 Tests grün
```

Keine Abweichung zum Audit-Zeitpunkt.

---

## 2. Ergebnistabelle

| Befund | Status | Beleg |
|---|---|---|
| **BUG-001** — verlorene Serverfehlermeldungen | **bestätigt** | Reproduziert über die tatsächlich installierte `@supabase/supabase-js@2.116.0` (per `node -e` aus `package-lock.json` verifiziert), Aufruf identisch zu `src/multiplayer/api.ts::invoke()`. Bei `NOT_ENOUGH_PLAYERS` liefert der rohe HTTP-Call den korrekten JSON-Body (`{"error":{"code":"NOT_ENOUGH_PLAYERS","message":"Mindestens 2 Spieler nötig."}}`, Status 400), aber `client.functions.invoke()` liefert `data:null`, `error.name:"FunctionsHttpError"`, `error.message:"Edge Function returned a non-2xx status code"` — der eigentliche Body ist nur über `error.context.json()` erreichbar (verifiziert: liefert exakt `{code, message}`). Zusätzlich geprüft: ein nicht existierender Function-Name liefert `FunctionsFetchError` (kein `.context`, andere `.name`) — die Fix-Logik muss also mindestens zwei Fehlerklassen unterscheiden. **Wichtige Ergänzung:** Der zuvor im Audit genutzte Reproduktionsweg über die UI („Spiel starten" mit 1 Spieler) ist **nicht mehr direkt nachstellbar**, da der Button clientseitig korrekt deaktiviert ist (`disabled: true`, per DOM-Check bestätigt) — ebenso sind `NOT_HOST`/`CARD_NOT_PLAYABLE` in der aktuellen UI durch ausgeblendete bzw. deaktivierte Buttons weitgehend abgeschirmt. Der Bug ist real und wirkt sich aus, sobald ein Fehler *trotzdem* durchkommt (Race Conditions, `STALE_GAME_STATE`, Netzwerkfehler) — er ist also seltener sichtbar als ursprünglich angenommen, aber unverändert vorhanden und beim ersten tatsächlichen Auftreten unverändert kryptisch. |
| **UX-002** — abgeschnittene Handkarten (375×812) | **bestätigt, unverändert** | Exakt dieselben Messwerte wie im Audit: `fanRect.top=692, height=104, scrollHeight=143`, `window.innerHeight=812`, `document.documentElement.scrollHeight=812` (keine Seiten-Scrollmöglichkeit), `.player-game { overflow: hidden }`. 23px der äußeren, angehobenen Fächerkarten sind unerreichbar abgeschnitten — reproduziert mit bereits 7 Karten (Spielstart), verstärkt sich mit wachsender Hand. |
| **UX-004** — Erkennbarkeit spielbarer Karten | **bestätigt, Einschätzung bestätigt** | `.uno-card--disabled { filter: grayscale(0.6) brightness(0.6) }` unverändert. Im Live-Screenshot bei gemischter Kartenfarbpalette ist der Unterschied vorhanden, aber moderat — bei von Natur aus dunkleren Karten (z. B. Blau/Dunkelrot) optisch subtiler als bei hellen (Gelb/Grün). Kein hartes Bedienbarkeits-Blocker (Karten sind über den Serverstatus ohnehin nicht spielbar, nur die visuelle Unterscheidung ist schwächer als ideal), daher weiterhin P2 wie im Audit eingestuft, nicht P1/P0. |
| **FUNC-002** — Reconnect-Screen beim direkten Raumbeitritt | **bestätigt, unverändert** | Code-Read bestätigt: `src/pages/RoomPage.tsx` Zeilen 20–32 unverändert, ruft bei jedem Mount unbedingt `reconnect()` auf. Live erneut reproduziert: frischer Raum-Erstellungs-Flow zeigt „Verbinde…" (sichtbarer Ladezustand) vor der Lobby. Zusätzlich beobachtet (gleiche Ursachenklasse, nicht separat gezählt): `Lobby.tsx`'s `isHost`-Ermittlung ist ebenfalls ein separater asynchroner Fetch und zeigt kurzzeitig „Warte, bis der Host das Spiel startet…", bevor sie sich als Host-Ansicht korrigiert. |
| **FUNC-003** — Session-Kollision zwischen Tabs | **bestätigt (Code-Analyse), nicht erneut live durchgespielt** | `src/multiplayer/session.ts` unverändert (`localStorage`, originweit, nicht tab-isoliert). Die Mechanik ist identisch zur bereits im Audit live demonstrierten Kollision (zweiter Tab überschreibt die Session des ersten). Da der Code seit dem Audit unverändert ist (per `git diff` bestätigt), wurde die Mehrfach-Tab-Choreografie in dieser Phase nicht erneut nachgestellt, um keine Zeit auf eine bereits belegte Reproduktion zu verwenden — Einstufung bleibt „bestätigt" auf Basis von Code-Unveränderheit + vorheriger Live-Demonstration. |
| **UX-001/BOT-001** — unsichtbare Bot-Zugfolgen | **bestätigt (Architektur unverändert)** | `supabase/functions/dispatch-action/index.ts` (und identisch `start-game`, `next-round`, `replace-with-bot`) ruft `runBotTurnsUntilHumanOrOver(...)` auf und broadcastet **erst danach, ein einziges Mal**, über `persistAndBroadcast`. Live an einem 2-Spieler-Testraum reproduziert: ein einzelner Bot-Zug (Denkzeit 500–1200 ms) dauert inkl. Netzwerk ca. 2,3–3,0 s bis zur Antwort; die komplette Kette ist erst im Response sichtbar. Ein echter 2-Bot-Ketten-Test war im laufenden Testraum nicht mehr möglich (Bots können nur in der `LOBBY`-Phase hinzugefügt werden, das Spiel lief bereits) — die Architektur-Aussage (genau ein Broadcast nach der gesamten Schleife) ist aber durch die unveränderte Codestelle eindeutig belegt, unabhängig von der Bot-Anzahl. |

---

## 3. Zusatzprüfung: Reconnect mit ausstehender Ziehstrafe / Skip-Markierung

Gezielt im Testraum nachgestellt (Punkt 5 des Auftrags):

- **Ausstehende Ziehstrafe (`pendingEffect.DRAW_STACK`):** Bot spielte `WILD_DRAW_4` als Antwort auf
  Sophies `DRAW_2`, wodurch eine +4-Strafe auf Sophie offen blieb (`currentPlayerId` blieb bei ihr).
  Ein anschließender `reconnect`-Aufruf für Sophies Device lieferte **korrekt** den vollständigen
  `pendingEffect` (`{"type":"DRAW_STACK","amount":4,"sourcePlayerId":"...","allowedResponseDefIds":[...]}`)
  zurück. Der nachfolgende `get_private_state`-Aufruf (das, was der Client nach einem Reconnect
  tatsächlich lädt) zeigte ebenfalls den korrekten `pendingEffect` sowie ein korrekt leeres
  `legalMoves` (Sophie besaß keine der vier konkreten `WILD_DRAW_4`-Karteninstanzen, die laut
  aktuell bewusst strikter Stacking-Regel — `TODO_VERIFY_OFFICIAL_RULE`, kein typübergreifendes
  Stacken — allein zulässig gewesen wären). **Ergebnis: PASS**, keine Diskrepanz gefunden.
- **Ausstehende Skip-Markierung (`pendingSkipTargets`):** Sophie spielte `TARGET_SKIP` und wählte
  Bot 2 als Ziel. Da der Testraum nur 2 Spieler hatte, ist Bot 2 in einem 2-Spieler-Spiel *immer*
  der unmittelbar nächste Zug — die Markierung wurde dadurch **im selben Serveraufruf** gesetzt und
  sofort wieder konsumiert (korrektes Verhalten, kein Bug: „nächster eigener Zug" ist bei nur zwei
  Spielern zwangsläufig der übernächste Zug insgesamt). Ein über mehrere Züge hinweg tatsächlich
  *offen bleibendes* `pendingSkipTargets` ließ sich in einem 2-Spieler-Raum daher nicht erzeugen.
  Dies wird bereits durch zwei dedizierte Unit-Tests mit 3 bzw. 4 Spielern abgedeckt
  (`tests/rulesEngine.test.ts`, Suiten „TARGET_SKIP" und „ROTATE_HANDS"), die exakt diesen
  mehrzügigen Persistenz-Fall serverseitig prüfen und bestehen. Da `reconnect`/`get_private_state`
  das Feld `pendingSkipTargets` strukturell identisch zum bereits verifizierten `pendingEffect`
  durchreichen (keine Sonderbehandlung im Code), ist die Schlussfolgerung „Reconnect erhält die
  Markierung korrekt" mit hoher Zuversicht, aber **nicht 1:1 live in einem 3-Spieler-Reconnect-Fall
  bestätigt** — als **ungeprüft (Restrisiko gering)** eingestuft, nicht als vollständig bestätigt.

---

## 4. Dependency-Advisories — Prüfung gegen tatsächliche Nutzung

`npm audit --json` ausgewertet: **alle 28 Meldungen** (1 low, 11 moderate, 15 high, 1 critical)
gehen ausschließlich auf den Abhängigkeitsbaum von `vercel` (Dev-Dependency, nur für
`npx vercel deploy` genutzt) zurück — u. a. über `@vercel/node`, `@vercel/static-config`,
`path-to-regexp`, `undici`, `tar`, `js-yaml`, `smol-toml`, `ajv`, `minimatch`. Verifiziert:

```
grep -rn "from \"tar\"|from \"undici\"|from \"path-to-regexp\"|..." src supabase  → keine Treffer
grep -l "path-to-regexp|js-yaml|smol-toml" dist/assets/*.js                      → keine Treffer
```

Keines dieser Pakete wird von Anwendungs- oder Edge-Function-Code importiert, keines landet im
ausgelieferten Browser-Bundle (`dist/`). Die Advisories betreffen ausschließlich lokale
Deploy-Tooling-Ausführung auf dem Entwickler-Rechner, nicht die produktiv ausgelieferte App oder
die Supabase-Runtime. **Kein Force-Upgrade empfohlen** — falls überhaupt gehandelt werden soll, käme
ausschließlich ein gezieltes `vercel`-Versions-Update infrage (eigenes, von den anderen Paketen
getrenntes Vorhaben, nicht Teil dieses Auftrags).

---

## 5. Minimaler Eingriff für Paket 1 (Verständliche Fehler)

**Betroffene Datei:** ausschließlich `src/multiplayer/api.ts`, Funktion `invoke()` (10 Zeilen).
Keine andere Datei muss geändert werden — jeder Aufrufer (`Lobby.tsx`, `PlayerGame.tsx`,
`WinnerOverlay.tsx`, `Join.tsx`) ruft ausnahmslos über diese eine Funktion.

**Minimale Änderung (Beschreibung, noch nicht umgesetzt):**
1. Bei `error?.name === "FunctionsHttpError"`: `error.context` (ein `Response`-Objekt) klonen und
   per `.json()` lesen; bei Erfolg `data.error.message` bzw. `data.error.code` als Nachricht werfen.
2. Schlägt das JSON-Parsing fehl (leerer/ungültiger Body) **oder** ist `error.name` etwas anderes
   (`FunctionsFetchError`/`FunctionsRelayError`, kein `.context` vorhanden) → generische, aber
   deutsche Netzwerk-Fallback-Meldung werfen (nicht die rohe `supabase-js`-Meldung).
3. Der bereits vorhandene zweite Zweig (`data?.error` bei technisch erfolgreichem 2xx-Response mit
   Fehler-Body) bleibt unverändert bestehen.

Keine Änderung an Regeln, Berechtigungen, Edge-Function-Antwortformaten oder Fehlercodes selbst —
ausschließlich an der clientseitigen Auswertung einer bereits korrekt vom Server gelieferten
Antwort.

**Abnahmekriterien:**
- `NOT_ENOUGH_PLAYERS` (Start mit 1 Spieler, testweise Button-Disable clientseitig umgangen oder via
  direktem Funktionsaufruf) zeigt „Mindestens 2 Spieler nötig." statt der generischen Meldung.
- `NOT_HOST` (Nicht-Host versucht host-only Aktion) zeigt die passende deutsche Meldung.
- `CARD_NOT_PLAYABLE` (erzwungener Spielversuch einer nicht passenden Karte) zeigt „Diese Karte
  kannst du gerade nicht spielen."
- `STALE_GAME_STATE` (Aktion mit veralteter `expectedVersion`, sofern/wo verwendet) zeigt „Der
  Spielstand hat sich geändert. Bitte synchronisieren."
- Ein echter Netzwerkfehler (z. B. Funktionsname falsch/nicht erreichbar) zeigt eine verständliche,
  aber generische deutsche Meldung — nicht die rohe `supabase-js`-Fehlermeldung und keinen
  ungefangenen Absturz.
- `npm run build` und `npm test` bleiben fehlerfrei.

**Rückweg:** Einzelner, in sich abgeschlossener Commit, der ausschließlich `invoke()` in
`api.ts` ändert — `git revert` dieses einen Commits stellt den heutigen Zustand ohne Nebenwirkungen
wieder her, da keine andere Datei, kein Datenmodell und keine Edge Function berührt wird.

---

## Offene Punkte / Restrisiken für die Freigabeentscheidung

- FUNC-003 wurde in dieser Phase nicht erneut live nachgestellt (nur Code-Bestätigung + vorherige
  Live-Demonstration) — falls gewünscht, kann dies vor Paket 3 gezielt nachgeholt werden.
- Die Skip-Markierungs-Persistenz über einen echten Reconnect hinweg ist bei ≥3 Spielern nicht live,
  sondern nur strukturell/durch Unit-Tests abgesichert (siehe Abschnitt 3) — geringes Restrisiko.
- UX-001/BOT-001 „Fühlbarkeit" bei echten Mehrfach-Bot-Ketten wurde nicht erneut mit einem frischen
  3-Bot-Lobby-Raum nachgemessen, da der bestehende Testraum das Spiel bereits gestartet hatte
  (Bots lassen sich nach Spielstart nicht mehr hinzufügen). Architektur-Befund ist davon unabhängig
  eindeutig durch den Code belegt.
