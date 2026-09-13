import { useRoomRealtime } from "../hooks/useRoomRealtime";
import type { DeviceSession } from "../multiplayer/session";
import { Table } from "../components/Table/Table";
import { useTurnPlayback } from "../hooks/useTurnPlayback";

export interface TableGameProps {
  session: DeviceSession;
}

export function TableGame({ session }: TableGameProps) {
  const { publicState, presentationQueue, acknowledgePresentationBatch, clearPresentationQueue } = useRoomRealtime(session.roomId);
  const playback = useTurnPlayback({ queue: presentationQueue, gameId: publicState?.gameId ?? null, acknowledgeBatch: acknowledgePresentationBatch, clearQueue: clearPresentationQueue });

  if (!publicState) return <div className="page page--centered">Lade Spiel…</div>;

  return (
    <div style={{ height: "100dvh" }}>
      <Table publicState={publicState} playback={playback.activeBeat ? { beat: playback.activeBeat, position: playback.position, total: playback.total, canSkip: playback.canSkip, onSkip: playback.skip } : null} />
    </div>
  );
}
