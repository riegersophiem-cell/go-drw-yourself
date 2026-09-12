export interface PendingAction<TAction> {
  actionId: string;
  action: TAction;
}

/**
 * Compares plain action payloads without depending on object key insertion
 * order. Actions in this project contain only JSON primitives.
 */
export function isSameLogicalAction(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) return false;

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
  return leftKeys.every((key) => leftRecord[key] === rightRecord[key]);
}

export function beginPendingAction<TAction>(
  current: PendingAction<TAction> | null,
  action: TAction,
  retry: boolean,
  createActionId: () => string = () => crypto.randomUUID(),
): PendingAction<TAction> {
  if (retry && current && isSameLogicalAction(current.action, action)) return current;
  return { actionId: createActionId(), action };
}

export function completePendingAction<TAction>(current: PendingAction<TAction> | null, actionId: string): PendingAction<TAction> | null {
  return current?.actionId === actionId ? null : current;
}
