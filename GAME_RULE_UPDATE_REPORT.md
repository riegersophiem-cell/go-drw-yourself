# GAME_RULE_UPDATE_REPORT — Regel-/Kartensystem-Update auf 5 Farben + Basic/Core Action/Chaos

Scope dieses Durchgangs: **ausschließlich** Spielregeln, Kartentypen,
Deckzusammensetzung, Zug-/Effektlogik und die textliche Spielanleitung
(`README.md`). Keine UI-, Asset-, Animations- oder Styling-Arbeit. Nichts
wurde committed, gepusht oder deployed — siehe Abschnitt "Status" am Ende.

## Hinweis: parallele Arbeit im selben Repo

Während dieser Sitzung lief erkennbar eine zweite, unabhängige Session am
Karten-/Asset-System (`CARD_ASSET_REPORT.md`, `public/assets/cards/**`,
`src/components/Card/*`, `src/pages/PlayerGame.tsx`). Diese wurde **nicht**
angefasst. Erfreulich: Deren Kategorisierung (BASIC/ACTION/CHAOS mit exakt
den Anzeigenamen PASS/LINK/PULSE/ARC/SHOVE/TARGET/LOWEST/DITCH/SWAP/ROTATE/
SKIP ALL/…) deckt sich vollständig mit der hier unabhängig umgesetzten
Logik-Kategorisierung — beide Stände sind konsistent zueinander.

Bereits vor Beginn dieser Sitzung war ein kleiner Teil schon vorbereitet
(vermutlich aus einem vorherigen, kompaktierten Gesprächsabschnitt): `VIOLET`
war bereits zu `CardColor` und zur `COLORS`-Liste in `cards.ts` sowie zu den
Bot-Farbzählungen hinzugefügt. Ebenso war der neue farbige Kartentyp
`DRAW_4` (unterschieden von der farblosen Chaos-Karte `WILD_DRAW_4`) bereits
vollständig verdrahtet (Typ, Deckgenerierung mit `draw4PerColor: 1`,
`isDrawCard`, `drawAmountOf`, Event-Validierung, Bot-Priorität). Diese
Vorarbeit wurde übernommen und nicht rückgängig gemacht; die einzige
Korrektur daran: die dort **ohne Markierung erfundene** Kopienzahl
`draw4PerColor: 1` wurde nachträglich mit `TODO_DEFINE_COLORED_ACTION_COPY_COUNT`
kommentiert (siehe unten).

## 1. Neue reguläre Farbe: VIOLET

`#7047EB` (verbindlicher Wert für spätere UI-Arbeit, hier nirgends visuell
verwendet). VIOLET ist jetzt überall wie RED/BLUE/GREEN/YELLOW eine
vollwertige reguläre Farbe:

- `cards.ts`: `COLORS`-Array (Deckgenerierung) enthält VIOLET.
- `botStrategy.ts`: `chosenColorFor()`-Zähler enthält VIOLET.
- `rulesEngine.ts`: Matching/`isPlayable`/`chooseColor` sind bereits generisch
  über `CardColor` und kannten nie eine hartcodierte Liste von genau 4
  Farben — keine Änderung nötig, nur verifiziert.
- `gameEvents.ts`: `COLORS`-Set für Event-Validierung enthielt VIOLET bereits.
- Kein Ort im Regelkern geht mehr (oder ging je) von exakt 4 Farben aus.

Kein UI-Code wurde angefasst; die Farbauswahl-Buttons in `PlayerGame.tsx`
gehören zur separaten UI-Arbeit der parallelen Session.

## 2. Neue Kartenfamilien

Die 22 `CardType`-Werte selbst bleiben unverändert (Umbenennung hätte in
Asset-Dateinamen durchgeschlagen, ausdrücklich außerhalb des Scopes). Neu
ist ausschließlich ihre **Regelfamilien-Zugehörigkeit**, jetzt explizit als
exportierte Konstanten in `src/game/types.ts`:

- `PLAIN_SYMBOL_TYPES` (Basic/PASS·LINK·PULSE·ARC) — **von 5 auf 4 Einträge
  reduziert**: `DIAMOND` (SHOVE) wurde entfernt und ist jetzt Core Action.
- `CORE_ACTION_TYPES` (neu, SHOVE·TARGET·LOWEST·DITCH): `DIAMOND`,
  `TARGET_SKIP`, `GIVE_TWO_TO_LOWEST`, `DISCARD_ONE_EXTRA`.
- `CHAOS_TYPES` (neu): `SWAP_HAND`, `ROTATE_HANDS`, `SKIP_EVERYONE`,
  `WILD_REVERSE_DRAW_4`, `WILD_DRAW_6`, `WILD_DRAW_10`,
  `WILD_COLOR_ROULETTE`, `WILD`, `WILD_DRAW_4`.

## 3. Deckzusammensetzung (`src/game/cards.ts`)

Restrukturiert, alle Zahlen aus `COUNTS` abgeleitet, keine Hardcodes:

| Familie | Aufbau | Ergebnis |
|---|---|---|
| Basic | 4 Typen × 5 Farben × `basicPerColor: 4` | **20 je Typ, 80 gesamt** ✅ |
| Core Action | 4 Typen × 5 Farben × `coreActionPerColor: 2` | **10 je Typ, 40 gesamt** ✅ |

Beide Werte sind testabgesichert (`tests/cardFamilies.test.ts`).

**Chaos-Familie umgezogen:** `SWAP_HAND` und `ROTATE_HANDS` waren zuvor pro
Farbe generierte Karten (`rotateHandsPerColor: 1` × 5 Farben = 5;
`formerNumberPerColor: 2` × 5 Farben = 10). Sie werden jetzt **farblos**
(`color: "WILD"`) und als flache Gesamtzahl erzeugt — die Gesamtstückzahl
wurde dabei bewusst **beibehalten statt neu erfunden**: `rotateHandsTotal: 5`,
`swapHandTotal: 10`.

`SKIP_EVERYONE` war schon zuvor farblos (`color: "WILD"`), keine Änderung an
seiner Kopienzahl nötig.

Weitere farbige Action-Karten (`DRAW_1`, `DRAW_2`, `DRAW_4`, `SKIP`,
`REVERSE`, `DISCARD_ALL`) wurden **nicht** in ihrer Kopienzahl verändert —
sie erhalten VIOLET automatisch über das erweiterte `COLORS`-Array. Für
`DRAW_4` bestand bereits eine (unmarkierte) Zahl aus der Vorarbeit; siehe
TODO unten.

## 4. Farbauflösung von Chaos-Karten (SWAP / ROTATE / SKIP ALL)

**Zentrale Erkenntnis:** Die bestehende Architektur benötigte für die neue
"Farbe-vor-Auflösung"-Regel **keine neue Phase und keinen neuen Code-Pfad**.
`playCard()` prüft bereits generisch `isWildDefinition(def)` (`color ===
"WILD"`) und verzögert dann zwingend auf `WAITING_FOR_COLOR`, bevor
`finalizePlay()` je die SWAP/ROTATE/SKIP-ALL-spezifische Logik erreicht.
Sobald `SWAP_HAND`/`ROTATE_HANDS` farblos sind, greift dieser bereits
vorhandene Mechanismus automatisch:

- **SWAP:** `playCard` (farblos, keine `chosenColor`) → `WAITING_FOR_COLOR`
  → `chooseColor()` setzt `activeColor` → `finalizePlay()` erreicht jetzt
  erst den `SWAP_HAND`-Zweig → `WAITING_FOR_SWAP_TARGET` → `chooseSwapTarget()`
  tauscht die Hände. Die vor dem Tausch gewählte Farbe bleibt in
  `activeColor` erhalten (wird von keinem der beiden Schritte überschrieben).
- **ROTATE:** identischer Mechanismus; die Rotation (`rotateHandsAllPlayers`)
  läuft jetzt erst innerhalb des zweiten `finalizePlay()`-Aufrufs (nach der
  Farbwahl), nie vorher — per Test verifiziert (Handzuordnung ist vor der
  Farbwahl noch unverändert).
- **SKIP ALL:** war bereits farblos und hat rechnerisch **bereits vorher**
  exakt das geforderte Verhalten geliefert: `stepsToAdvance = Anzahl aktiver
  Spieler` bedeutet, ausgehend vom Ausspieler landet man nach genau so vielen
  Schritten zwangsläufig wieder bei sich selbst. Es musste nichts an der
  Effekt-Logik geändert werden — nur die Familienzugehörigkeit ist jetzt
  explizit dokumentiert.

Für Bots: `chooseBotAction()`/`chosenColorFor()` behandelten "wähle eine
Farbe für eine farblose Karte" bereits generisch für jede `color === "WILD"`
Karte (inkl. VIOLET in der Zählung) — SWAP/ROTATE/SKIP ALL laufen für Bots
dadurch automatisch mit Farbwahl, ohne Sonderfall-Code.

**Ein echter Bug wurde dabei gefunden und behoben:** In
`gameEventDerivation.ts` wurde das `HANDS_ROTATED`-Ereignis bisher immer
sofort beim `PLAY_CARD`-Event ausgelöst, sobald `card.type === "ROTATE_HANDS"`
— das war vor dieser Änderung korrekt, weil ROTATE_HANDS nie verzögert
wurde. Jetzt, da ROTATE_HANDS farblos ist und die Auflösung oft erst beim
separaten `CHOOSE_COLOR`-Schritt passiert, hätte dieses Ereignis fälschlich
gemeldet, dass die Hände bereits rotiert seien, obwohl das erst beim
nachfolgenden Zug geschieht. Behoben: Das `PLAY_CARD`-Ereignis meldet
`HANDS_ROTATED` nur noch, wenn die Farbe im selben Aufruf sofort mitgegeben
wurde (Bot-Pfad); der `CHOOSE_COLOR`-Zweig meldet es zusätzlich für den
verzögerten (menschlichen) Pfad, anhand der noch obenliegenden Karte im
Ablagestapel.

## 5. SHOVE (`DIAMOND`)

Umkategorisiert von Basic zu Core Action (Metadaten/Dokumentation). Die
tatsächliche Spiellogik ist **unverändert**: `DIAMOND` hatte nie einen
Effekt-Zweig in `applyImmediateEffectsAndAdvance()` und verhält sich weiter
wie eine reine Matching-Karte. **`TODO_DEFINE_SHOVE_EFFECT`** — kein Effekt
wurde erfunden, wie vom Auftrag verlangt. Die Kopienzahl (2 je Farbe, 10
gesamt) war bereits korrekt und musste nicht geändert werden.

## 6. TARGET, LOWEST, DITCH

Alle drei bereits vorher korrekt implementiert, keine Logikänderung nötig,
nur Familien-Umbenennung in der Dokumentation:

- **TARGET** (`TARGET_SKIP`): Marker in `pendingSkipTargets`, überlebt
  Reconnect (liegt direkt im persistierten `GameState`), wird erst beim
  tatsächlichen nächsten eigenen Zug des Ziels konsumiert und entfernt.
  Bereits testabgesichert.
- **LOWEST** (`GIVE_TWO_TO_LOWEST`): löst automatisch beim Ausspielen auf.
  Gleichstand-Regel weiterhin `TODO_DEFINE_LOWEST_HAND_TIE_RULE` (Platzhalter:
  Sitzreihenfolge) — wie im Auftrag gefordert **nicht** erfunden.
- **DITCH** (`DISCARD_ONE_EXTRA`): läuft bereits über einen eigenen Aktionstyp
  `DISCARD_EXTRA_CARD`, der `playCard`/`applyImmediateEffectsAndAdvance`
  strukturell nie durchläuft — die zusätzliche Karte kann dadurch gar keinen
  Effekt auslösen. Das ist stärker als ein `suppressEffect`-Flag (es gibt
  keinen Effekt-Pfad, der unterdrückt werden müsste) und wurde deshalb
  **nicht** durch ein zusätzliches Flag ersetzt.

## 7. Aktive Farbe / Matching (`isPlayable`, Reconnect)

`isPlayable()`, `getLegalMoves()`, `chooseColor()` unterschieden nie
zwischen "genau 4 Farben" — sie arbeiten bereits rein über `CardColor` und
`state.activeColor`. Keine Änderung nötig, per Test verifiziert (VIOLET
matcht wie jede andere Farbe, siehe `cardFamilies.test.ts`).

**Game-State-Felder für die spätere UI (Abschnitt 10 des Auftrags):** Es
waren **keine neuen Felder nötig**. Die geforderte Trennung existiert
bereits vollständig:

- `topDiscard` (`PublicGameState`) — die tatsächliche obenliegende Karte
  inkl. ihrer intrinsischen Farbe (z. B. `"WILD"` für jede Chaos-Karte).
- `activeColor` — die aktuell gültige Spielfarbe (nach Chaos-Auflösung die
  gewählte Farbe).

Eine UI kann daraus ableiten: "obenliegende Karte ist Chaos" (`topDiscard.color
=== "WILD"` bzw. `CHAOS_TYPES.includes(topDiscard.type)`) und "welche Farbe
wurde gewählt" (`activeColor`) — unabhängig voneinander. Ein zusätzliches
`resolvedChosenColor`-Feld wäre redundant gewesen.

**Reconnect-Sicherheit:** `activeColor`, `pendingSkipTargets`,
`pendingSwapPlayerId`, `pendingExtraDiscardPlayerId` liegen alle direkt auf
dem persistierten `GameState` (keine separate, veraltbare Zwischenschicht).
Ein Reconnect liest denselben State neu ein und berechnet Projektionen
(`toPublicGameState`, `getLegalMoves`) rein aus diesem State — per Test
verifiziert (`cardFamilies.test.ts`: gewählte Farbe übersteht eine
Projektions-Neuberechnung unverändert, exakt wie der bestehende
`getLegalMoves`-Reconnect-Test in `rulesEngine.test.ts`).

## 8. Geänderte Dateien

- `src/game/types.ts` — Farbdoku, Familien-Konstanten (`CORE_ACTION_TYPES`,
  `CHAOS_TYPES`), `PLAIN_SYMBOL_TYPES` ohne `DIAMOND`.
- `src/game/cards.ts` — `COUNTS` neu strukturiert (Basic/Core Action getrennt
  gezählt), SWAP/ROTATE aus der Farbschleife entfernt und als farblose
  Flatzahl generiert, TODO-Markierung für `draw4PerColor`.
- `src/game/gameEventDerivation.ts` — `HANDS_ROTATED`-Bug für den verzögerten
  Chaos-Pfad behoben.
- `src/game/rulesEngine.ts`, `src/game/botStrategy.ts`,
  `src/game/gameEvents.ts` — **keine Änderung** in dieser Sitzung nötig
  (VIOLET/`DRAW_4` waren bereits vorbereitet; SWAP/ROTATE/SKIP-ALL-Verhalten
  ergibt sich automatisch aus der Farbumstellung in `cards.ts`).
- `tests/rulesEngine.test.ts` — SWAP_HAND-Test auf den zweistufigen Ablauf
  (Farbe vor Ziel) umgestellt; neue Tests für ROTATE_HANDS-Farbwahl-vor-
  Rotation und SKIP_EVERYONE (Farbwahl + sofortiger erneuter Zug).
- `tests/cardFamilies.test.ts` — neu: Deckzusammensetzung, Farbfamilien,
  VIOLET-Matching, Bot-VIOLET, Reconnect-Persistenz der aktiven Farbe.
- `README.md` — Regel-Abschnitt vollständig überarbeitet (5 Farben, drei
  Kartenfamilien, neue Chaos-Regeln, offene TODOs); widersprüchliche
  Alttexte (SWAP/ROTATE als "einfache" Farbkarten, SHOVE nirgends erwähnt)
  entfernt.

## 9. Tests

`npm test` — **176/176 grün** (15 vorher bestehende Dateien + neue
`tests/cardFamilies.test.ts`, 25 neue/geänderte Tests insgesamt). `npx tsc -b`
sauber. `npm run lint` — nur die zwei bereits vorher bekannten, unveränderten
Warnungen (`RoomPage.tsx`, `Table.tsx`; beide UI, nicht Teil dieser Änderung).

Abgedeckt (Abschnitt 22 des Auftrags):

- ✅ VIOLET wird wie jede andere reguläre Farbe akzeptiert (Matching, ist
  keine Wild-Farbe)
- ✅ Basic Deck = exakt 80, je Typ 20
- ✅ Core Action Deck = exakt 40, je Typ 10
- ✅ SWAP ist Chaos (farblos in jeder gedealten Kopie)
- ✅ ROTATE ist Chaos (farblos in jeder gedealten Kopie)
- ✅ SKIP ALL ist Chaos (farblos in jeder gedealten Kopie)
- ✅ SHOVE ist Core Action (nicht mehr in `PLAIN_SYMBOL_TYPES`)
- ✅ SWAP fordert Farbwahl vor Tausch (inkl. Fall: sofortige Farbe wie beim
  Bot-Pfad)
- ✅ ROTATE fordert Farbwahl vor Rotation (Hände unverändert vor der Wahl)
- ✅ SKIP ALL wählt Farbe und gibt demselben Spieler sofort erneut den Zug
- ✅ gewählte Farbe bleibt nach SWAP/ROTATE/SKIP ALL aktiv
- ✅ Bots können VIOLET wählen (Präferenztest) und spielen (Regel-Akzeptanz)
- ✅ Reconnect/Projektions-Neuberechnung behält die aktive Farbe
- ✅ TARGET-Marker wird korrekt verbraucht (bereits vorhandener Test)
- ✅ DITCH löst keinen Effekt aus (bereits vorhandener Test)

## 10. Offene TODOs (nicht erfunden, bewusst offen gelassen)

- **`TODO_DEFINE_LOWEST_HAND_TIE_RULE`** (`rulesEngine.ts`,
  `applyGiveTwoToLowest`) — Gleichstand bei den wenigsten Karten, aktuell
  Sitzreihenfolge als reiner Platzhalter.
- **`TODO_DEFINE_SHOVE_EFFECT`** (`types.ts`, `DIAMOND`) — kein Effekt
  definiert; Karte verhält sich wie eine reine Matching-Karte, bis eine
  offizielle Regel feststeht.
- **`TODO_DEFINE_COLORED_ACTION_COPY_COUNT`** (`cards.ts`,
  `draw4PerColor: 1`) — die Kopienzahl für den neuen farbigen "Draw 4" war
  bereits vor dieser Sitzung ohne Markierung im Code hinterlegt; hier
  nachträglich als unbestätigt gekennzeichnet, wie im Auftrag verlangt,
  statt sie kommentarlos zu übernehmen oder eigenmächtig zu ändern.
- Vorbestehend, unverändert: `TODO_VERIFY_OFFICIAL_RULE` für Draw 1/Draw 6/
  Draw 10/Skip Everyone/Wild Reverse Draw 4/Wild Color Roulette/Discard All
  sowie die Mercy-Rule-Schwelle (siehe README, unverändert von dieser
  Sitzung).

## Status

- ✅ 5 reguläre Farben inkl. Violett vollständig unterstützt
- ✅ Basic/Core Action/Chaos korrekt getrennt (80/40/Chaos-Flatzahlen)
- ✅ SWAP/ROTATE/SKIP ALL funktionieren korrekt als Chaos mit verpflichtender
  Farbwahl vor der Auflösung
- ✅ Alte 4-Farben-Annahmen entfernt (es gab ohnehin keine hartcodierte
  4er-Prüfung in der Regel-Engine selbst — nur die Farblisten in `cards.ts`/
  `botStrategy.ts` mussten erweitert werden)
- ✅ Relevante Tests bestehen (176/176)
- ✅ Rulebook (`README.md`) aktualisiert
- ✅ **UI wurde NICHT angepasst** — keine Datei unter `src/components/Card/`,
  `src/pages/PlayerGame.tsx`, `src/components/Table/`, keine CSS-Datei, keine
  neuen Assets von dieser Sitzung berührt
- ✅ **Keine neuen Designs implementiert** — reine Regel-/Datenebene
- ✅ **Nichts committed** — `git status` zeigt alle Änderungen dieser Sitzung
  weiterhin als uncommitted im Arbeitsverzeichnis
- ✅ **Nichts gepusht**
- ✅ **Nichts deployed**
