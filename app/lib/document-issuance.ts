export type IssuePayload = Record<string, unknown> & { user_id: string; document_type: string };
export type IssueResult = { id: string; document_number: string };
type Intent = { user_id: string; request_id: string; payload: IssuePayload; result?: IssueResult };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export class IssuanceError extends Error {}

const key = (userId: string) => {
  if (!userId.trim()) throw new IssuanceError("Connexion requise pour émettre un document.");
  return `alek-issuance-v1:${encodeURIComponent(userId)}`;
};

export function readIssueIntent(storage: Storage, userId: string): Intent | null {
  const raw = storage.getItem(key(userId));
  if (!raw) return null;
  let value: Intent;
  try { value = JSON.parse(raw); } catch { throw new IssuanceError("La demande locale est illisible. Vérifiez l’historique avant toute nouvelle émission."); }
  if (!value || value.user_id !== userId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.request_id)
    || value.payload?.user_id !== userId || !["devis", "facture"].includes(value.payload.document_type)
    || (value.result !== undefined && (!value.result || typeof value.result.id !== "string" || !value.result.id
      || typeof value.result.document_number !== "string" || !value.result.document_number))) {
    throw new IssuanceError("La demande locale ne correspond pas au compte actif. Aucune nouvelle émission n’est lancée.");
  }
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function beginIssue(storage: Storage, userId: string, payload: IssuePayload): Intent {
  if (payload.user_id !== userId) throw new IssuanceError("Le compte a changé. Rechargez la page.");
  const previous = readIssueIntent(storage, userId);
  if (previous) {
    if (canonical(previous.payload) !== canonical(payload)) {
      throw new IssuanceError(previous.result
        ? "Ce document a déjà été émis. Utilisez Nouveau devis ou Nouvelle facture pour commencer un autre document."
        : "Une émission reste à vérifier. Reprenez la demande précédente avant de modifier ou d’émettre un autre document.");
    }
    return previous;
  }
  const intent: Intent = { user_id: userId, request_id: crypto.randomUUID(), payload: JSON.parse(JSON.stringify(payload)) };
  // Persist before the RPC; an unavailable browser store must not create an untracked invoice.
  storage.setItem(key(userId), JSON.stringify(intent));
  return intent;
}

export function completeIssue(storage: Storage, userId: string, requestId: string, result: IssueResult) {
  const intent = readIssueIntent(storage, userId);
  if (!intent || intent.request_id !== requestId) throw new IssuanceError("La demande locale a changé. Consultez l’historique.");
  if (!result.id || !result.document_number) throw new IssuanceError("La réponse d’émission est incomplète. Reprenez la même demande.");
  storage.setItem(key(userId), JSON.stringify({ ...intent, result }));
}

export function issueRpcArgs(intent: Intent) {
  return { p_payload: { ...intent.payload, idempotency_key: intent.request_id } };
}

export function rejectIssue(storage: Storage, userId: string, requestId: string, code: unknown) {
  // Only definite transaction rejections release the intent, never network/timeout errors.
  if (!["22023", "22007", "23514", "42501"].includes(String(code))) return;
  const intent = readIssueIntent(storage, userId);
  if (intent?.request_id === requestId && !intent.result) storage.removeItem(key(userId));
}

export function startNewIssue(storage: Storage, userId: string) {
  const intent = readIssueIntent(storage, userId);
  if (intent && !intent.result) throw new IssuanceError("Une émission est en attente de confirmation. Reprenez-la avant de créer un autre document.");
  storage.removeItem(key(userId));
}
