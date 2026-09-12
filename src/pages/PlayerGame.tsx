import { useMemo, useState } from "react";
import { dispatchAction } from "../multiplayer/api";
import type { DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { usePendingAction } from "../hooks/usePendingAction";
import { isSameLogicalAction } from "../multiplayer/pendingAction";
import { PlayerHand } from "../components/PlayerHand/PlayerHand";
import { Table } from "../components/Table/Table";
import { WinnerOverlay } from "../components/WinnerOverlay/WinnerOverlay";
import type { GameAction } from "../game/actions";
import type { CardColor } from "../game/types";
import "./PlayerGame.css";

const COLOR_CHOICES: { color: CardColor; hex: string; label: string }[] = [
  { color: "RED", hex: "#e5484d", label: "Rot" },
  { color: "BLUE", hex: "#3b82f6", label: "Blau" },
  { color: "GREEN", hex: "#22c55e", label: "Grün" },
  { color: "YELLOW", hex: "#eab308", label: "Gelb" },
];
const COLOR_ORDER: Record<CardColor, number> = { RED: 0, YELLOW: 1, GREEN: 2, BLUE: 3, WILD: 4 };

export interface PlayerGameProps { session: DeviceSession; }

export function PlayerGame({ session }: PlayerGameProps) {
  const { publicState, privateState, players } = useRoomRealtime(session.roomId, session);
  type PendingGameAction = { action: GameAction; expectedGameId: string | null; expectedVersion: number };
  const pendingAction = usePendingAction<PendingGameAction>();
  const [selected, setSelected] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMyTurn = publicState?.currentPlayerId === session.playerId;
  const needsColor = isMyTurn && publicState?.phase === "WAITING_FOR_COLOR";
  const needsSwapTarget = isMyTurn && publicState?.phase === "WAITING_FOR_SWAP_TARGET";
  const needsSkipTarget = isMyTurn && publicState?.phase === "WAITING_FOR_SKIP_TARGET";
  const needsExtraDiscard = isMyTurn && publicState?.phase === "WAITING_FOR_EXTRA_DISCARD";
  const selectionLocked = needsSwapTarget || needsSkipTarget || needsColor;

  const otherActiveCandidates = useMemo(() => publicState?.players.filter((p) => p.playerId !== session.playerId && !p.eliminated) ?? [], [publicState, session.playerId]);
  const displayedHand = useMemo(() => {
    if (!privateState || !sorted) return privateState?.ownHand ?? [];
    return [...privateState.ownHand].sort((a, b) => COLOR_ORDER[a.def.color] - COLOR_ORDER[b.def.color] || a.def.type.localeCompare(b.def.type));
  }, [privateState, sorted]);

  async function runAction(action: GameAction, retry = false) {
    if (!publicState) return;
    const existing = pendingAction.pending;
    const request = retry && existing && isSameLogicalAction(existing.action.action, action) ? existing.action : { action, expectedGameId: publicState.gameId ?? null, expectedVersion: publicState.version };
    const pending = pendingAction.begin(request, retry && request === existing?.action);
    setBusy(true); setError(null);
    try {
      await dispatchAction(session.deviceId, session.sessionToken, pending.action.action, { actionId: pending.actionId, expectedGameId: pending.action.expectedGameId, expectedVersion: pending.action.expectedVersion });
      pendingAction.complete(pending.actionId);
      setSelected(null); setShowColorPicker(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  function handleSelect(instanceId: string) {
    if (!isMyTurn || busy || selectionLocked) return;
    if (needsExtraDiscard) { void runAction({ type: "DISCARD_EXTRA_CARD", cardInstanceId: instanceId }); return; }
    setSelected((current) => current === instanceId ? null : instanceId);
    setShowColorPicker(false);
  }

  function playSelected() {
    if (!selected || !privateState) return;
    const card = privateState.ownHand.find((item) => item.instanceId === selected);
    if (!card) return;
    if (card.def.color === "WILD") { setShowColorPicker(true); return; }
    void runAction({ type: "PLAY_CARD", cardInstanceId: selected });
  }

  function chooseColor(color: CardColor) {
    if (needsColor) { void runAction({ type: "CHOOSE_COLOR", color }); return; }
    if (selected) void runAction({ type: "PLAY_CARD", cardInstanceId: selected, chosenColor: color });
  }

  if (!publicState || !privateState) return <div className="page page--centered">Lade Spiel…</div>;
  if (publicState.phase === "GAME_OVER") {
    const winnerName = publicState.players.find((p) => p.playerId === publicState.winnerPlayerId)?.displayName ?? "?";
    return <WinnerOverlay session={session} winnerName={winnerName} players={players} gameId={publicState.gameId ?? null} version={publicState.version} />;
  }

  const canUseMainActions = isMyTurn && !busy && !needsColor && !needsSwapTarget && !needsSkipTarget && !needsExtraDiscard;
  const legalIds = needsExtraDiscard ? privateState.ownHand.map((card) => card.instanceId) : isMyTurn ? privateState.legalMoves : [];

  return (
    <main className="player-game">
      <header className="player-game__topbar">
        <div className="player-game__brand"><strong>GO DR*W<br />YOURSELF</strong><span>Swap it. Stack it. Make it someone else&apos;s problem.</span></div>
        <div className="player-game__room"><span>Raum</span><strong>{session.roomCode}</strong></div>
        <div className="player-game__meta"><span aria-hidden="true">♙</span><strong>{publicState.players.length} / 8</strong></div>
      </header>

      <div className="player-game__board"><Table publicState={publicState} compact ownPlayerId={session.playerId ?? undefined} /></div>

      <section className="player-game__dock" aria-label="Deine Karten und Aktionen">
        <div className="player-game__dock-glow" />
        {error && <div className="player-game__retry"><p>{error}</p>{pendingAction.pending && <><button onClick={() => pendingAction.pending && void runAction(pendingAction.pending.action.action, true)} disabled={busy}>Erneut versuchen</button><button onClick={() => { pendingAction.cancel(); setError(null); }} disabled={busy}>Abbrechen</button></>}</div>}
        {(showColorPicker || needsColor) && <div className="player-game__choice"><strong>Wähle eine Farbe</strong><div>{COLOR_CHOICES.map((choice) => <button key={choice.color} style={{ background: choice.hex }} aria-label={choice.label} onClick={() => chooseColor(choice.color)} />)}</div></div>}
        {needsSwapTarget && <div className="player-game__choice"><strong>Hand tauschen mit</strong><div className="player-game__targets">{otherActiveCandidates.map((p) => <button key={p.playerId} onClick={() => void runAction({ type: "CHOOSE_SWAP_TARGET", targetPlayerId: p.playerId })}>{p.displayName} · {p.cardCount}</button>)}</div></div>}
        {needsSkipTarget && <div className="player-game__choice"><strong>Spieler aussetzen</strong><div className="player-game__targets">{otherActiveCandidates.map((p) => <button key={p.playerId} onClick={() => void runAction({ type: "CHOOSE_SKIP_TARGET", targetPlayerId: p.playerId })}>{p.displayName} · {p.cardCount}</button>)}</div></div>}
        {needsExtraDiscard && <p className="player-game__instruction">Wähle eine zusätzliche Karte zum Abwerfen.</p>}

        <button className={`player-game__sort ${sorted ? "player-game__sort--active" : ""}`} type="button" onClick={() => setSorted((value) => !value)}><span aria-hidden="true">⇅</span> Sortieren</button>
        <div className={`player-game__hand-wrap ${selectionLocked || showColorPicker ? "player-game__hand-wrap--receded" : ""}`}>
          <PlayerHand cards={displayedHand} legalInstanceIds={legalIds} selectedInstanceId={selected} disabled={!isMyTurn || busy || selectionLocked || showColorPicker} onSelect={handleSelect} />
        </div>
        <div className="player-game__actions">
          <button className="player-game__play" disabled={!canUseMainActions || !selected} onClick={playSelected}><span aria-hidden="true">▶</span>Karte spielen</button>
          <button className="player-game__draw" disabled={!canUseMainActions} onClick={() => void runAction({ type: "DRAW_CARD" })}><span aria-hidden="true">▣</span>Karte ziehen</button>
        </div>
      </section>
    </main>
  );
}
