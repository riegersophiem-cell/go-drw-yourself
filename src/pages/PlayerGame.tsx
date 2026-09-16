import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dispatchAction, leaveRoom, removePlayer } from "../multiplayer/api";
import { clearSession, type DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { usePendingAction } from "../hooks/usePendingAction";
import { useTurnPlayback } from "../hooks/useTurnPlayback";
import { isSameLogicalAction } from "../multiplayer/pendingAction";
import { PlayerHand } from "../components/PlayerHand/PlayerHand";
import { GameTable } from "../components/GameTable/GameTable";
import { HandDock } from "../components/GameTable/HandDock";
import { WinnerOverlay } from "../components/WinnerOverlay/WinnerOverlay";
import type { GameAction } from "../game/actions";
import type { CardColor } from "../game/types";
import { useIsRoomHost } from "../hooks/useIsRoomHost";
import { useHasTableDevice } from "../hooks/useHasTableDevice";
import { ThemeSwitch } from "../theme/ThemeSwitch";
import "./PlayerGame.css";

const COLOR_CHOICES: { color: CardColor; hex: string; label: string }[] = [
  { color: "RED", hex: "#e5484d", label: "Rot" },
  { color: "BLUE", hex: "#3b82f6", label: "Blau" },
  { color: "GREEN", hex: "#22c55e", label: "Grün" },
  { color: "YELLOW", hex: "#eab308", label: "Gelb" },
  { color: "VIOLET", hex: "#7047EB", label: "Violett" },
];
const COLOR_ORDER: Record<CardColor, number> = { RED: 0, YELLOW: 1, GREEN: 2, BLUE: 3, VIOLET: 4, WILD: 5 };

export interface PlayerGameProps { session: DeviceSession; }

export function PlayerGame({ session }: PlayerGameProps) {
  const navigate = useNavigate();
  const { publicState, privateState, players, presentationQueue, acknowledgePresentationBatch, clearPresentationQueue } = useRoomRealtime(session.roomId, session);
  const botPlayerIds = useMemo(() => publicState?.players.filter((player) => player.type === "BOT").map((player) => player.playerId) ?? [], [publicState?.players]);
  const playback = useTurnPlayback({ queue: presentationQueue, gameId: publicState?.gameId ?? null, acknowledgeBatch: acknowledgePresentationBatch, clearQueue: clearPresentationQueue, botPlayerIds });
  const { isHost } = useIsRoomHost(session);
  const hasTableDevice = useHasTableDevice(session.roomId);
  type PendingGameAction = { action: GameAction; expectedGameId: string | null; expectedVersion: number };
  const pendingAction = usePendingAction<PendingGameAction>();
  const [selected, setSelected] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [sorted, setSorted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handOpen, setHandOpen] = useState(true);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const [acknowledgedTurn, setAcknowledgedTurn] = useState<string | null>(null);
  const [handOnly, setHandOnly] = useState(false);

  const isMyTurn = publicState?.currentPlayerId === session.playerId;
  const needsColor = isMyTurn && publicState?.phase === "WAITING_FOR_COLOR";
  const needsSwapTarget = isMyTurn && publicState?.phase === "WAITING_FOR_SWAP_TARGET";
  const needsSkipTarget = isMyTurn && publicState?.phase === "WAITING_FOR_SKIP_TARGET";
  const needsExtraDiscard = isMyTurn && publicState?.phase === "WAITING_FOR_EXTRA_DISCARD";
  const selectionLocked = needsSwapTarget || needsSkipTarget || needsColor;
  const attentionTurn = isMyTurn && publicState?.phase === "WAITING_FOR_PLAY" && !playback.isPlaying
    ? `${publicState.gameId}:${publicState.version}`
    : null;
  const needsTurnAttention = attentionTurn !== null && acknowledgedTurn !== attentionTurn;

  useEffect(() => {
    if (!needsTurnAttention || !attentionTurn) return;
    const acknowledge = () => setAcknowledgedTurn(attentionTurn);
    window.addEventListener("mousemove", acknowledge, { once: true });
    window.addEventListener("pointerdown", acknowledge, { once: true });
    window.addEventListener("touchstart", acknowledge, { once: true, passive: true });
    return () => {
      window.removeEventListener("mousemove", acknowledge);
      window.removeEventListener("pointerdown", acknowledge);
      window.removeEventListener("touchstart", acknowledge);
    };
  }, [attentionTurn, needsTurnAttention]);

  const effectiveHandOnly = handOnly && hasTableDevice;

  const otherActiveCandidates = useMemo(() => publicState?.players.filter((p) => p.playerId !== session.playerId && !p.eliminated) ?? [], [publicState, session.playerId]);
  const displayedHand = useMemo(() => {
    if (!privateState || !sorted) return privateState?.ownHand ?? [];
    return [...privateState.ownHand].sort((a, b) => COLOR_ORDER[a.def.color] - COLOR_ORDER[b.def.color] || a.def.type.localeCompare(b.def.type));
  }, [privateState, sorted]);

  async function runAction(action: GameAction, retry = false) {
    if (!publicState || playback.isPlaying) return;
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
    // COLOR ROULETTE has no color choice at all - the engine picks the next
    // player, color and direction at random server-side (see rulesEngine.ts's
    // applyColorRoulette). Showing a color picker for it would be pure
    // theater with no effect, so it's excluded from the generic WILD gate.
    if (card.def.color === "WILD" && card.def.type !== "WILD_COLOR_ROULETTE") { setShowColorPicker(true); return; }
    void runAction({ type: "PLAY_CARD", cardInstanceId: selected });
  }

  function chooseColor(color: CardColor) {
    if (needsColor) { void runAction({ type: "CHOOSE_COLOR", color }); return; }
    if (selected) void runAction({ type: "PLAY_CARD", cardInstanceId: selected, chosenColor: color });
  }

  async function handleDeparture(targetPlayerId: string, mode: "LEAVE" | "REMOVE") {
    if (!publicState) return;
    const target = publicState.players.find((player) => player.playerId === targetPlayerId);
    const question = mode === "LEAVE"
      ? (isHost ? "Spiel wirklich aufgeben? Die Hostrolle geht an den nächsten Spieler." : "Spiel wirklich aufgeben?")
      : `${target?.displayName ?? "Spieler"} wirklich aus dem laufenden Spiel entfernen?`;
    if (!window.confirm(question)) return;
    setRemovingPlayerId(targetPlayerId); setError(null);
    const context = { actionId: crypto.randomUUID(), expectedGameId: publicState.gameId ?? null, expectedVersion: publicState.version };
    try {
      if (mode === "LEAVE") await leaveRoom(session.deviceId, session.sessionToken, context);
      else await removePlayer(session.deviceId, session.sessionToken, targetPlayerId, context);
      if (mode === "LEAVE") { clearSession(); navigate("/"); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRemovingPlayerId(null); }
  }

  if (!publicState) return <div className="page page--centered">Lade Spiel…</div>;
  // While a bot chain is being narrated, the board shown to GameTable follows
  // the beat currently on screen instead of jumping straight to the final
  // live state (see presentationState.ts — this is the bot-turn-timing fix).
  // Everything else (isMyTurn, legal moves, hand data) keeps using the real
  // publicState/privateState: those already gate on `!playback.isPlaying`.
  const tableState = playback.presentationState ?? publicState;
  const ownPublicPlayer = publicState.players.find((player) => player.playerId === session.playerId);
  if (ownPublicPlayer?.eliminated && !ownPublicPlayer.connected) return <div className="page page--centered"><div className="panel"><h1>Du bist nicht mehr im Spiel</h1><p>Die übrigen Spieler spielen ohne dich weiter.</p><button className="btn btn--primary" onClick={() => { clearSession(); navigate("/"); }}>Zur Startseite</button></div></div>;
  // Checked before the eliminated-spectator branch and the privateState
  // loading gate below: becoming eliminated is exactly how a round often
  // ends (mercy rule, last player standing), and that same commit deletes
  // the player's private_player_views row - so gating this on privateState
  // meant the very player whose elimination just ended the game got stuck
  // forever on "Du bist ausgeschieden" instead of ever seeing who won.
  if (publicState.phase === "GAME_OVER" && !playback.isPlaying && presentationQueue.length === 0) {
    const winnerName = publicState.players.find((p) => p.playerId === publicState.winnerPlayerId)?.displayName ?? "?";
    return <WinnerOverlay session={session} winnerName={winnerName} players={players} gameId={publicState.gameId ?? null} version={publicState.version} />;
  }
  if (ownPublicPlayer?.eliminated) return <main className="player-game player-game--spectating"><div className="player-game__board"><GameTable publicState={tableState} mode="REMOTE_MOBILE_FULL" playback={playback.visibleBeat ? { beat: playback.visibleBeat, position: playback.position, total: playback.total, canSkip: playback.canSkip, onSkip: playback.skip, active: !!playback.activeBeat } : null} /></div><div className="player-game__spectator-note"><strong>Du bist ausgeschieden.</strong><span>Die Runde läuft weiter.</span><button type="button" onClick={() => void handleDeparture(session.playerId!, "LEAVE")}>Spiel verlassen</button></div></main>;
  if (!privateState) return <div className="page page--centered">Lade Spiel…</div>;

  const canUseMainActions = handOpen && isMyTurn && !busy && !playback.isPlaying && !needsColor && !needsSwapTarget && !needsSkipTarget && !needsExtraDiscard;
  const legalIds = needsExtraDiscard ? privateState.ownHand.map((card) => card.instanceId) : isMyTurn ? privateState.legalMoves : [];

  return (
    <main className={`player-game ${handOpen ? "" : "player-game--hand-collapsed"} ${effectiveHandOnly ? "player-game--hand-only" : ""} ${needsTurnAttention ? "player-game--turn-attention" : ""}`}>
      <header className="player-game__topbar">
        <div className="player-game__brand"><strong>GO DR*W<br />YOURSELF</strong><span>Swap it. Stack it. Make it someone else&apos;s problem.</span></div>
        <div className="player-game__room"><span>Raum</span><strong>{session.roomCode}</strong></div>
        <div className="player-game__top-actions">
          {hasTableDevice && <div className="player-game__view-switch" aria-label="Ansicht wählen">
            <button type="button" aria-pressed={!effectiveHandOnly} onClick={() => setHandOnly(false)}>Vollständige Ansicht</button>
            <button type="button" aria-pressed={effectiveHandOnly} onClick={() => { setHandOpen(true); setHandOnly(true); }}>Nur meine Hand</button>
          </div>}
          <div className="player-game__meta"><span aria-hidden="true">♙</span><strong>{publicState.players.filter((player) => !player.eliminated).length} / 8</strong></div>
          <ThemeSwitch />
          <button type="button" onClick={() => void handleDeparture(session.playerId!, "LEAVE")}>Aufgeben</button>
        </div>
      </header>

      <div className="player-game__board"><GameTable publicState={tableState} mode="REMOTE_MOBILE_FULL" ownPlayerId={session.playerId ?? undefined} canRemovePlayers={isHost && !playback.isPlaying} removingPlayerId={removingPlayerId} onRemovePlayer={(playerId) => void handleDeparture(playerId, "REMOVE")} playback={playback.visibleBeat ? { beat: playback.visibleBeat, position: playback.position, total: playback.total, canSkip: playback.canSkip, onSkip: playback.skip, active: !!playback.activeBeat } : null} /></div>

      <HandDock className="player-game__dock" aria-label="Deine Karten und Aktionen">
        {effectiveHandOnly && <div className="player-game__hand-only-status" role="status">
          <strong>{isMyTurn ? "Du bist dran" : `${publicState.players.find((player) => player.playerId === publicState.currentPlayerId)?.displayName ?? "Nächster Spieler"} ist dran`}</strong>
          <span>{publicState.pendingEffect?.type === "DRAW_STACK" ? `Aktiver Ziehstapel: +${publicState.pendingEffect.amount}` : `${privateState.ownHand.length} Karten auf deiner Hand`}</span>
        </div>}
        <button className="player-game__hand-toggle" type="button" aria-expanded={handOpen} onClick={() => setHandOpen((open) => !open)}>{handOpen ? "⌄ Hand ausblenden" : "⌃ Karten anzeigen"}</button>
        {error && <div className="player-game__retry"><p>{error}</p>{pendingAction.pending && <><button onClick={() => pendingAction.pending && void runAction(pendingAction.pending.action.action, true)} disabled={busy}>Erneut versuchen</button><button onClick={() => { pendingAction.cancel(); setError(null); }} disabled={busy}>Abbrechen</button></>}</div>}
        {(showColorPicker || needsColor) && <div className="player-game__choice"><strong>Wähle eine Farbe</strong><div>{COLOR_CHOICES.map((choice) => <button key={choice.color} disabled={playback.isPlaying} style={{ background: choice.hex }} aria-label={choice.label} onClick={() => chooseColor(choice.color)} />)}</div></div>}
        {needsSwapTarget && <div className="player-game__choice"><strong>Hand tauschen mit</strong><div className="player-game__targets">{otherActiveCandidates.map((p) => <button key={p.playerId} disabled={playback.isPlaying} onClick={() => void runAction({ type: "CHOOSE_SWAP_TARGET", targetPlayerId: p.playerId })}>{p.displayName} · {p.cardCount}</button>)}</div></div>}
        {needsSkipTarget && <div className="player-game__choice"><strong>Spieler aussetzen</strong><div className="player-game__targets">{otherActiveCandidates.map((p) => <button key={p.playerId} disabled={playback.isPlaying} onClick={() => void runAction({ type: "CHOOSE_SKIP_TARGET", targetPlayerId: p.playerId })}>{p.displayName} · {p.cardCount}</button>)}</div></div>}
        {needsExtraDiscard && <p className="player-game__instruction">Wähle eine zusätzliche Karte zum Abwerfen.</p>}

        {handOpen && <>
          <div className={`player-game__hand-wrap ${selectionLocked || showColorPicker ? "player-game__hand-wrap--receded" : ""}`}>
            <button className={`player-game__sort ${sorted ? "player-game__sort--active" : ""}`} type="button" onClick={() => setSorted((value) => !value)} aria-pressed={sorted}><span aria-hidden="true">⇅</span> Sortieren</button>
            <PlayerHand cards={displayedHand} legalInstanceIds={legalIds} selectedInstanceId={selected} disabled={!isMyTurn || busy || playback.isPlaying || selectionLocked || showColorPicker} onSelect={handleSelect} />
          </div>
          <div className="player-game__actions"><button className={`player-game__play ${selected ? "player-game__play--ready" : ""}`} disabled={!canUseMainActions || !selected} onClick={playSelected}><span aria-hidden="true">▶</span>Karte spielen</button><button className="player-game__draw" disabled={!canUseMainActions} onClick={() => void runAction({ type: "DRAW_CARD" })}><span aria-hidden="true">▣</span>Karte ziehen</button></div></>}
      </HandDock>
    </main>
  );
}
