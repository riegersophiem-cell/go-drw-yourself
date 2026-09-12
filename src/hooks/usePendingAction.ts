import { useRef, useState } from "react";
import { beginPendingAction, completePendingAction, type PendingAction } from "../multiplayer/pendingAction";

export function usePendingAction<TAction>() {
  const pendingRef = useRef<PendingAction<TAction> | null>(null);
  const [pending, setPending] = useState<PendingAction<TAction> | null>(null);

  function begin(action: TAction, retry = false): PendingAction<TAction> {
    const next = beginPendingAction(pendingRef.current, action, retry);
    pendingRef.current = next;
    setPending(next);
    return next;
  }

  function complete(actionId: string) {
    const next = completePendingAction(pendingRef.current, actionId);
    pendingRef.current = next;
    setPending(next);
  }

  function cancel() {
    pendingRef.current = null;
    setPending(null);
  }

  return { pending, begin, complete, cancel };
}
