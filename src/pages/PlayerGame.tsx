import { useMemo, useState } from "react";
import { dispatchAction } from "../multiplayer/api";
import type { DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { PlayerHand } from "../components/PlayerHand/PlayerHand";
import { Table } from "../components/Table/Table";
import { WinnerOverlay } from "../components/WinnerOverlay/WinnerOverlay";
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

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleSelect(instanceId: string) {
    if (!isMyTurn || busy) return;

    if (needsExtraDiscard) {
      act(() => dispatchAction(session.deviceId, session.sessionToken, { type: "DISCARD_EXTRA_CARD", cardInstanceId: instanceId }));
      return;
    }

    const def = privateState?.ownHand.find((c) => c.instanceId === instanceId)?.def;
    if (!def) return;

    if (def.color === "WILD") {
      setSelected(instanceId); // wait for color choice below
      return;
    }
    act(() => dispatchAction(session.deviceId, session.sessionToken, { type: "PLAY_CARD", cardInstanceId: instanceId }));
  }

  if (!publicState || !privateState) return <div className="page page--centered">Lade Spiel…</div>;

  if (publicState.phase === "GAME_OVER") {
    const winnerName = publicState.players.find((p) => p.playerId === publicState.winnerPlayerId)?.displayName ?? "?";
    return <WinnerOverlay session={session} winnerName={winnerName} players={players} />;
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

      {error && <p className="error-text">{error}</p>}

      {selected && (
        <div className="color-picker">
          <p>Wähle eine Farbe:</p>
          <div className="color-picker__options">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c.color}
                className="color-picker__swatch"
                style={{ background: c.hex }}
                onClick={() => act(() => dispatchAction(session.deviceId, session.sessionToken, { type: "PLAY_CARD", cardInstanceId: selected, chosenColor: c.color }))}
              />
            ))}
          </div>
        </div>
      )}

      {needsSwapTarget && (
        <div className="color-picker">
          <p>Mit wem möchtest du deine Hand tauschen?</p>
          <div className="swap-picker__options">
            {otherActiveCandidates.map((p) => (
              <button
                key={p.playerId}
                className="btn btn--secondary"
                onClick={() => act(() => dispatchAction(session.deviceId, session.sessionToken, { type: "CHOOSE_SWAP_TARGET", targetPlayerId: p.playerId }))}
              >
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
              <button
                key={p.playerId}
                className="btn btn--secondary"
                onClick={() => act(() => dispatchAction(session.deviceId, session.sessionToken, { type: "CHOOSE_SKIP_TARGET", targetPlayerId: p.playerId }))}
              >
                {p.displayName} — {p.cardCount} Karten
              </button>
            ))}
          </div>
        </div>
      )}

      {needsExtraDiscard && <p className="player-game__status">Wähle eine zusätzliche Karte zum Abwerfen (ohne Effekt).</p>}

      {isMyTurn && !needsColor && !needsSwapTarget && !needsSkipTarget && !needsExtraDiscard && (
        <button
          className="btn btn--secondary player-game__draw"
          disabled={busy}
          onClick={() => act(() => dispatchAction(session.deviceId, session.sessionToken, { type: "DRAW_CARD" }))}
        >
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
