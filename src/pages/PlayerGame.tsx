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

const COLOR_CHOICES: { color: CardColor; hex: string }[] = [
  { color: "RED", hex: "#e5484d" },
  { color: "BLUE", hex: "#3b82f6" },
  { color: "GREEN", hex: "#22c55e" },
  { color: "YELLOW", hex: "#eab308" },
];

export interface PlayerGameProps {
  session: DeviceSession;
}

export function PlayerGame({ session }: PlayerGameProps) {
  const { publicState, privateState, players } = useRoomRealtime(session.roomId, session);
  type PendingGameAction = {
    action: GameAction;
    expectedGameId: string | null;
    expectedVersion: number;
  };
  const pendingAction = usePendingAction<PendingGameAction>();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMyTurn = publicState?.currentPlayerId === session.playerId;
  const needsColor = isMyTurn && publicState?.phase === "WAITING_FOR_COLOR";
  const needsSwapTarget = isMyTurn && publicState?.phase === "WAITING_FOR_SWAP_TARGET";
  const needsSkipTarget = isMyTurn && publicState?.phase === "WAITING_FOR_SKIP_TARGET";
  const needsExtraDiscard = isMyTurn && publicState?.phase === "WAITING_FOR_EXTRA_DISCARD";

  const otherActiveCandidates = useMemo(
    () => publicState?.players.filter((p) => p.playerId !== session.playerId && !p.eliminated) ?? [],
    [publicState, session.playerId],
  );

  async function runAction(action: GameAction, retry = false) {
    if (!publicState) return;
    const existing = pendingAction.pending;
    const request = retry && existing && isSameLogicalAction(existing.action.action, action)
      ? existing.action
      : { action, expectedGameId: publicState.gameId ?? null, expectedVersion: publicState.version };
    const pending = pendingAction.begin(request, retry && request === existing?.action);
    setBusy(true);
    setError(null);
    try {
      await dispatchAction(session.deviceId, session.sessionToken, pending.action.action, {
        actionId: pending.actionId,
        expectedGameId: pending.action.expectedGameId,
        expectedVersion: pending.action.expectedVersion,
      });
      pendingAction.complete(pending.actionId);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function retryPendingAction() {
    if (pendingAction.pending) void runAction(pendingAction.pending.action.action, true);
  }

  function cancelPendingAction() {
    pendingAction.cancel();
    setError(null);
  }

  function handleSelect(instanceId: string) {
    if (!isMyTurn || busy) return;

    if (needsExtraDiscard) {
      void runAction({ type: "DISCARD_EXTRA_CARD", cardInstanceId: instanceId });
      return;
    }

    const def = privateState?.ownHand.find((c) => c.instanceId === instanceId)?.def;
    if (!def) return;

    if (def.color === "WILD") {
      setSelected(instanceId);
      return;
    }
    void runAction({ type: "PLAY_CARD", cardInstanceId: instanceId });
  }

  if (!publicState || !privateState) return <div className="page page--centered">Lade Spiel…</div>;

  if (publicState.phase === "GAME_OVER") {
    const winnerName = publicState.players.find((p) => p.playerId === publicState.winnerPlayerId)?.displayName ?? "?";
    return <WinnerOverlay session={session} winnerName={winnerName} players={players} gameId={publicState.gameId ?? null} version={publicState.version} />;
  }

  return (
    <div className="player-game">
      <div className="player-game__topbar">
        <span>Raum {session.roomCode}</span>
        <span>{isMyTurn ? "Du bist dran!" : ""}</span>
      </div>

      <div className="player-game__board">
        <Table publicState={publicState} compact ownPlayerId={session.playerId ?? undefined} />
      </div>

      {error && (
        <div className="player-game__retry">
          <p className="error-text">{error}</p>
          {pendingAction.pending && (
            <>
              <button className="btn btn--secondary" onClick={retryPendingAction} disabled={busy}>Erneut versuchen</button>
              <button className="btn btn--secondary" onClick={cancelPendingAction} disabled={busy}>Abbrechen</button>
            </>
          )}
        </div>
      )}

      {selected && (
        <div className="color-picker">
          <p>Wähle eine Farbe:</p>
          <div className="color-picker__options">
            {COLOR_CHOICES.map((c) => (
              <button key={c.color} className="color-picker__swatch" style={{ background: c.hex }} onClick={() => void runAction({ type: "PLAY_CARD", cardInstanceId: selected, chosenColor: c.color })} />
            ))}
          </div>
        </div>
      )}

      {needsSwapTarget && (
        <div className="color-picker">
          <p>Mit wem möchtest du deine Hand tauschen?</p>
          <div className="swap-picker__options">
            {otherActiveCandidates.map((p) => (
              <button key={p.playerId} className="btn btn--secondary" onClick={() => void runAction({ type: "CHOOSE_SWAP_TARGET", targetPlayerId: p.playerId })}>
                {p.displayName} — {p.cardCount} Karten
              </button>
            ))}
          </div>
        </div>
      )}

      {needsSkipTarget && (
        <div className="color-picker">
          <p>Wer soll seinen nächsten Zug aussetzen?</p>
          <div className="swap-picker__options">
            {otherActiveCandidates.map((p) => (
              <button key={p.playerId} className="btn btn--secondary" onClick={() => void runAction({ type: "CHOOSE_SKIP_TARGET", targetPlayerId: p.playerId })}>
                {p.displayName} — {p.cardCount} Karten
              </button>
            ))}
          </div>
        </div>
      )}

      {needsExtraDiscard && <p className="player-game__status">Wähle eine zusätzliche Karte zum Abwerfen (ohne Effekt).</p>}

      {isMyTurn && !needsColor && !needsSwapTarget && !needsSkipTarget && !needsExtraDiscard && (
        <button className="btn btn--secondary player-game__draw" disabled={busy} onClick={() => void runAction({ type: "DRAW_CARD" })}>
          Ziehen
        </button>
      )}

      <div className={`player-game__hand-wrap ${needsSwapTarget || needsSkipTarget || needsColor || !!selected ? "player-game__hand-wrap--receded" : ""}`}>
        <PlayerHand
          cards={privateState.ownHand}
          legalInstanceIds={needsExtraDiscard ? privateState.ownHand.map((c) => c.instanceId) : isMyTurn ? privateState.legalMoves : []}
          selectedInstanceId={selected}
          disabled={!isMyTurn || busy || needsSwapTarget || needsSkipTarget || needsColor || !!selected}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
