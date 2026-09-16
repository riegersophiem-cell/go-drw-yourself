# UNO Show 'Em No Mercy — Multiplayer

Digitale Multiplayer-Version von UNO Show 'Em No Mercy. Jeder Mensch nutzt sein
eigenes Smartphone (nur eigene Hand sichtbar), dazu ein gemeinsames
Tisch-Gerät (nur öffentliche Infos) und optional Bots (kein eigenes Gerät,
aber eine echte geheime Hand).

## Architektur

```
Handy 1 (Spieler) ──┐
Handy 2 (Spieler) ──┤     Supabase Edge Functions        Supabase Postgres
Tablet (Tisch)    ──┼──▶  (autoritative Rule Engine)  ──▶  + Realtime Broadcast
                     │
Bots existieren nur serverseitig, kein eigenes Gerät
```

Kein Gerät kommuniziert je direkt mit einem anderen — jede Aktion geht über
eine Edge Function, die den `src/game/*`-Regelkern ausführt und danach genau
die Sichten verteilt, die ein Gerät sehen darf.

### Sicherheitsmodell (Priorität 1 im Lastenheft)

- `game_states` (die vollständige Wahrheit inkl. aller Hände) hat RLS **ohne
  jede Policy** — kein Client kann diese Tabelle je direkt lesen, nur Edge
  Functions mit dem Service-Role-Key.
- `public_game_views` enthält nur, was jedes Gerät sehen darf (Kartenzahl,
  wer dran ist, oberste Ablagekarte, …) und ist frei lesbar.
- `private_player_views` (die eigene Hand) ist ebenfalls per RLS komplett
  gesperrt. Der einzige Weg, sie zu lesen, ist die Postgres-Funktion
  `get_private_state(device_id, session_token)`, die den Session-Token
  serverseitig prüft, bevor sie genau eine Zeile zurückgibt.
- Realtime wird nur für ein "Zustand hat sich geändert"-Signal auf dem
  öffentlichen Kanal genutzt (enthält keine Geheimnisse). Jedes Gerät holt
  danach explizit seine eigene private Sicht über die RPC ab — eine fremde
  Hand kann so nie über eine Realtime-Payload durchsickern.
- Lokal (Browser) wird ausschließlich `{roomId, deviceId, sessionToken}`
  gespeichert — nie Kartendaten. Ein Reload kann das Spiel daher nie
  zerstören oder Karten offenlegen.

## Status: live und eingerichtet

Deployed unter **https://uno-show-em-no-mercy-nu.vercel.app** (Vercel-Projekt
`uno-show-em-no-mercy` im Team `gaming24`).

Ein Supabase-Projekt ist bereits eingerichtet und voll funktionsfähig:

- Projekt: `uno-show-em-no-mercy` (Ref `ohhhjegpfudbqcpajguc`, Org `smrieger291102-rgb's Org`, Region eu-west-1)
- `.env` ist bereits mit `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` befüllt
  (dieselben Werte liegen als Vercel-Production-Env-Vars)
- Migrationen `0001`–`0004` sind eingespielt (`0004_match_score.sql` fügt
  `players.wins` für den rundenübergreifenden Match-Score hinzu)
- Alle 9 Edge Functions sind deployed: `create-room`, `join-room`, `add-bot`,
  `remove-bot`, `start-game`, `next-round`, `dispatch-action`, `reconnect`,
  `replace-with-bot`
- Live end-to-end getestet (lokal und auf der Produktions-URL): Raum
  erstellen, beitreten (Spieler + Tisch), Bot hinzufügen/entfernen, Spiel
  starten, alle neuen Sonderkarten spielen, Wild-Farbwahl, automatischer
  Bot-Zug, Sicherheitsmodell — alles gegen die echte Datenbank bestätigt.

`npm install` ist bereits ausgeführt. Einfach `npm run dev` starten.

### Spielregeln (Farben, Kartenfamilien, Deckzusammensetzung)

Das Spiel wurde gemäß dem `UNO_No_Mercy_UI_UX_Final_Claude_Brief.pdf` auf ein
neues Karten-/Symbolsystem umgestellt — die ehemaligen Zahlenkarten 0–9 zeigen
keine Ziffern mehr. Interne Typ-Bezeichner (`CardType` in `src/game/types.ts`)
sind aus den ursprünglichen Zahlenkarten abgeleitet und bleiben unverändert
(Umbenennung würde in Asset-Dateinamen durchschlagen); maßgeblich für Spieler
sind die Anzeigenamen.

**5 reguläre Spielfarben:** Rot, Blau, Grün, Gelb und **Violett** (`#7047EB`).
Violett ist eine vollwertige reguläre Farbe — überall gleichbehandelt wie die
anderen vier (Matching, Farbwahl, Validierung, Deckgenerierung, Bot-Logik).

Es gibt drei Kartenfamilien:

**BASIC** (4 Typen, je 5 Farben × 4 Kopien = 20, insgesamt 80) — reine
Matching-Karten ohne Effekt:

| Anzeigename | interner Typ |
|---|---|
| PASS | `TRIANGLE` |
| LINK | `SQUARE` |
| PULSE | `CIRCLE` |
| ARC | `SEMICIRCLE` |

**CORE ACTION** (4 Typen, je 5 Farben × 2 Kopien = 10, insgesamt 40):

| Anzeigename | interner Typ | Funktion |
|---|---|---|
| SHOVE | `DIAMOND` | **TODO_DEFINE_SHOVE_EFFECT** — kein Effekt definiert, verhält sich aktuell wie eine reine Matching-Karte |
| TARGET | `TARGET_SKIP` | gewählter Spieler setzt seinen **nächsten eigenen** Zug aus (persistiert über `pendingSkipTargets`, überlebt Reconnect) |
| LOWEST | `GIVE_TWO_TO_LOWEST` | Spieler mit den wenigsten Karten zieht automatisch 2 (Gleichstand: `TODO_DEFINE_LOWEST_HAND_TIE_RULE`, aktuell Sitzreihenfolge) |
| DITCH | `DISCARD_ONE_EXTRA` | danach eine zusätzliche Karte wirkungslos abwerfen (eigener `DISCARD_EXTRA_CARD`-Action-Pfad, umgeht die normale Effekt-Pipeline bewusst) |

Weitere reguläre (farbige, nicht Chaos) Action-Karten ohne Farbwahl:
`DRAW_1`/`DRAW_2`/`DRAW_4`/`SKIP`/`REVERSE`/`DISCARD_ALL` (DROP ALL). Deren
genaue Kopienzahlen sind teils `TODO_VERIFY_OFFICIAL_RULE` bzw. für `DRAW_4`
`TODO_DEFINE_COLORED_ACTION_COPY_COUNT` (siehe `src/game/cards.ts`).

**CHAOS** (farblos — keine feste Ausgangsfarbe, immer spielbar, erzwingt bei
jeder Auflösung zuerst eine neue reguläre Farbwahl):

| Anzeigename | interner Typ | Ablauf |
|---|---|---|
| SWAP | `SWAP_HAND` | Farbe wählen → dann Zielspieler wählen → komplette Hand tauschen → gewählte Farbe bleibt aktiv |
| ROTATE | `ROTATE_HANDS` | Farbe wählen → dann rotieren alle aktiven Hände (Bots eingeschlossen) gleichzeitig in Spielrichtung → gewählte Farbe bleibt aktiv |
| SKIP ALL | `SKIP_EVERYONE` | Farbe wählen → alle anderen aktiven Spieler werden übersprungen → derselbe Spieler ist sofort erneut am Zug unter der gewählten Farbe |
| REVERSE +4, WILD DRAW 6, WILD DRAW 10, COLOR ROULETTE, WILD, WILD DRAW 4 | `WILD_REVERSE_DRAW_4`/`WILD_DRAW_6`/`WILD_DRAW_10`/`WILD_COLOR_ROULETTE`/`WILD`/`WILD_DRAW_4` | wie gehabt: Farbe wählen, dann Effekt |

`SWAP_HAND` und `ROTATE_HANDS` waren zuvor reguläre Farbkarten und sind jetzt
Teil der Chaos-Familie (farblos, mit Farbwahl vor der Auflösung) — die
Gesamtstückzahl blieb dabei erhalten (5× ROTATE, 10× SWAP), nur nicht mehr
pro Farbe vervielfacht.

Aktionskarten und Chaos-Karten erhalten ihren dezenten holografischen Rand
direkt aus dem verbindlichen SVG-/PNG-Asset-System. Jede Karte trägt außerdem
einen `aria-label`/`title` mit Klartext-Bedeutung. Vollständiges Inventar,
Ordner und Kompatibilitätsregeln stehen in `CARD_ASSET_REPORT.md`.

Zusätzlich umgesetzt: Bots vor Spielstart aus der Lobby entfernbar, Gewinner-
Screen mit `Spiel verlassen` / `Nächste Runde` / `Neues Spiel erstellen`
(`next-round` Edge Function hält Lobby/Bots/Sitzordnung/Match-Score, ein
neues Spiel startet stattdessen einen neuen Raum), Spieler-Bildschirm zeigt
jetzt Hand + kompletten Tisch kombiniert.

Das Ereignis-/Animations-System läuft als getrennte clientseitige
Präsentationsschicht über dem autoritativen Spielzustand. Karten in Hand,
Ablagestapel und Zugwiedergabe werden dabei über dieselbe `Card`-Komponente
und damit aus denselben finalen Assets gerendert.

### Setup von Grund auf (z. B. für ein eigenes/neues Supabase-Projekt)

```bash
npm install
```

1. Erstelle ein Supabase-Projekt unter https://supabase.com.
2. Kopiere `.env.example` zu `.env` und trage `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` ein (Projekteinstellungen → API → Legacy anon key).
3. Migration einspielen (Supabase CLI, hier als Dev-Dependency installiert):
   ```bash
   SUPABASE_ACCESS_TOKEN=<dein-personal-access-token> npx supabase link --project-ref <dein-projekt-ref>
   SUPABASE_ACCESS_TOKEN=<dein-personal-access-token> npx supabase db push
   ```
4. Edge Functions deployen:
   ```bash
   SUPABASE_ACCESS_TOKEN=<dein-personal-access-token> npx supabase functions deploy create-room join-room add-bot remove-bot start-game next-round dispatch-action reconnect replace-with-bot
   ```
5. Dev-Server starten:
   ```bash
   npm run dev
   ```

### Tests

```bash
npm test
```

Die Rule-Engine-Tests (`tests/rulesEngine.test.ts`, `tests/cardFamilies.test.ts`)
laufen komplett ohne Supabase — Zugreihenfolge, Reverse/Skip, Draw-Stacking,
SWAP/ROTATE/SKIP ALL inklusive der verpflichtenden Farbwahl (auch mit
Violett), 0er-Rotation (inkl. Bots, im und gegen den Uhrzeigersinn),
Deckzusammensetzung (80 Basic / 40 Core Action, je Typ exakt gezählt), Mercy
Rule und Sieg sind abgedeckt.

## Spielablauf

1. **Neues Spiel** auf der Startseite → Name eingeben → Raum-Code entsteht.
2. Andere Geräte öffnen `/join/<CODE>` und wählen: Spieler / Spieltisch /
   Zuschauer.
3. Host fügt in der Lobby bei Bedarf Bots hinzu und startet das Spiel.
4. Spieler-Geräte zeigen nur die eigene Hand, das Tischgerät zeigt den
   öffentlichen Spielstand (Landscape empfohlen).

## Bekannte Lücken / TODO_VERIFY_OFFICIAL_RULE

Einige Kartenzahlen und Detailregeln von UNO Show 'Em No Mercy sind nicht
zweifelsfrei belegt und wurden konfigurierbar statt hart codiert umgesetzt
(siehe `src/game/cards.ts` und `src/game/types.ts` → `RulesetConfig`,
`turnManager.ts` → `checkMercyRule`). Vor einem "echten" Turnier sollten
diese gegen die offizielle Anleitung geprüft werden:

- genaue Stückzahlen für Draw 6 / Draw 10 / Skip Everyone / Wild Reverse
  Draw 4 / Wild Color Roulette / Discard All / den neuen farbigen Draw 4
  (`TODO_DEFINE_COLORED_ACTION_COPY_COUNT`)
- `TODO_DEFINE_SHOVE_EFFECT`: SHOVE (`DIAMOND`) hat noch keinen definierten
  Effekt und verhält sich aktuell wie eine reine Matching-Karte
- `TODO_DEFINE_LOWEST_HAND_TIE_RULE`: Gleichstand bei LOWEST ist nicht
  definiert, aktuell Sitzreihenfolge als Platzhalter
- ob Draw-Stacking über verschiedene Kartentypen hinweg erlaubt ist
- exakter Schwellenwert und Wirkung der Mercy Rule

Nicht (noch) umgesetzt, weil sie ein echtes Supabase-Projekt zum Testen
brauchen: automatische Verbindungserkennung bei Disconnect (aktuell nur
manuelles "Durch Bot ersetzen" durch den Host), QR-Code-Beitritt, Debug-Panel,
vollautomatisierter E2E-Test (Ablauf ist in Abschnitt 41 des Lastenhefts
manuell nachvollziehbar).
