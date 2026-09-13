import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
import { sha256Hex } from "./persist.ts";

export interface AuthedDevice {
  deviceId: string;
  roomId: string;
  role: string;
  playerId: string | null;
}

/** Verifies a device's session token server-side. Never trust a client-supplied deviceId/playerId without this. */
export async function authenticateDevice(admin: SupabaseClient, deviceId: string, sessionToken: string): Promise<AuthedDevice> {
  const { data: device, error } = await admin.from("devices").select("*").eq("device_id", deviceId).eq("connected", true).single();
  if (error || !device) throw new Error("UNKNOWN_DEVICE");

  const hash = await sha256Hex(sessionToken);
  if (hash !== device.session_token_hash) throw new Error("INVALID_SESSION");

  return { deviceId: device.device_id, roomId: device.room_id, role: device.role, playerId: device.player_id };
}
