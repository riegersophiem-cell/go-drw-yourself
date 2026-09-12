import { useRoomRealtime } from "../hooks/useRoomRealtime";
import type { DeviceSession } from "../multiplayer/session";
import { Table } from "../components/Table/Table";

export interface TableGameProps {
  session: DeviceSession;
}

export function TableGame({ session }: TableGameProps) {
  const { publicState } = useRoomRealtime(session.roomId);

  if (!publicState) return <div className="page page--centered">Lade Spiel…</div>;

  return (
    <div style={{ height: "100dvh" }}>
      <Table publicState={publicState} />
    </div>
  );
}
