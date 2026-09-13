import { useMemo } from "react";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import type { DeviceSession } from "../multiplayer/session";
import { Table } from "../components/Table/Table";
import { useTurnPlayback } from "../hooks/useTurnPlayback";

export interface TableGameProps {
  session: DeviceSession;
}

export function TableGame({ session }: TableGameProps) {
  const { publicState, presentationQueue, acknowledgePresentationBatch, clearPresentationQueue } = useRoomRealtime(session.roomId);
  const botPlayerIds = useMemo(() => publicState?.players.filter((player) => player.type === "BOT").map((player) => player.playerId) ?? [], [publicState?.players]);
  const playback = useTurnPlayback({ queue: presentationQueue, gameId: publicState?.gameId ?? null, acknowledgeBatch: acknowledgePresentationBatch, clearQueue: clearPresentationQueue, botPlayerIds });

  if (!publicState) return <div className="page page--centered">Lade Spiel…</div>;

  return (
    <div style={{ height: "100dvh" }}>
      <Table publicState={publicState} playback={playback.visibleBeat ? { beat: playback.visibleBeat, position: playback.position, total: playback.total, canSkip: playback.canSkip, onSkip: playback.skip, active: !!playback.activeBeat } : null} />
    </div>
  );
}
