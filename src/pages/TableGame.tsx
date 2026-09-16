import { useCallback, useMemo } from "react";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { useSeatLayout } from "../hooks/useSeatLayout";
import type { DeviceSession } from "../multiplayer/session";
import { GameTable } from "../components/GameTable/GameTable";
import { useTurnPlayback } from "../hooks/useTurnPlayback";
import { ThemeSwitch } from "../theme/ThemeSwitch";

export interface TableGameProps {
  session: DeviceSession;
}

export function TableGame({ session }: TableGameProps) {
  const { publicState, presentationQueue, acknowledgePresentationBatch, clearPresentationQueue } = useRoomRealtime(session.roomId);
  const { seatOrder, updateSeatOrder } = useSeatLayout(session.roomId);
  const botPlayerIds = useMemo(() => publicState?.players.filter((player) => player.type === "BOT").map((player) => player.playerId) ?? [], [publicState?.players]);
  const playback = useTurnPlayback({ queue: presentationQueue, gameId: publicState?.gameId ?? null, acknowledgeBatch: acknowledgePresentationBatch, clearQueue: clearPresentationQueue, botPlayerIds });

  const canEditSeats = session.role === "TABLE" || session.role === "HOST_ADMIN";
  const persistSeatOrder = useCallback(
    (newOrder: string[]) => { void updateSeatOrder(session.deviceId, session.sessionToken, newOrder); },
    [session.deviceId, session.sessionToken, updateSeatOrder],
  );

  if (!publicState) return <div className="page page--centered">Lade Spiel…</div>;
  // See PlayerGame.tsx's matching comment / presentationState.ts: follows the
  // currently narrated beat during a bot chain instead of the final result.
  const tableState = playback.presentationState ?? publicState;

  return (
    <div style={{ height: "100dvh" }}>
      <div className="table-game__theme-switch"><ThemeSwitch /></div>
      <GameTable
        publicState={tableState}
        mode="TABLE_DEVICE"
        seatOrder={seatOrder}
        canEditSeats={canEditSeats}
        onPersistSeatOrder={persistSeatOrder}
        playback={playback.visibleBeat ? { beat: playback.visibleBeat, position: playback.position, total: playback.total, canSkip: playback.canSkip, onSkip: playback.skip, active: !!playback.activeBeat } : null}
      />
    </div>
  );
}
