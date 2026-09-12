export interface RequiredMutationContext { actionId: string; expectedGameId: string | null; expectedVersion: number | null }
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function writeMaintenanceEnabled(getEnv: (key: string) => string | undefined = (key) => Deno.env.get(key)): boolean { return getEnv("WRITE_MAINTENANCE") === "true"; }
export function parseMutationContext(body: Record<string, unknown>, allowEmptyExpected: boolean): RequiredMutationContext {
  const { actionId, expectedGameId, expectedVersion } = body;
  if (typeof actionId !== "string" || !UUID_RE.test(actionId)) throw new Error("MISSING_REQUIRED_FIELDS");
  if (allowEmptyExpected) {
    if (expectedGameId !== null || expectedVersion !== null) throw new Error("INVALID_EXPECTED_STATE");
  } else if (typeof expectedGameId !== "string" || !UUID_RE.test(expectedGameId) || !Number.isInteger(expectedVersion) || (expectedVersion as number) < 1) {
    throw new Error("MISSING_REQUIRED_FIELDS");
  }
  return { actionId, expectedGameId: expectedGameId as string | null, expectedVersion: expectedVersion as number | null };
}
