export const LEGACY_DRAFT_KEY = "alek-draft-v2";
const ACCOUNT_DRAFT_PREFIX = "alek-draft-v3:";

export type DraftData = Record<string, unknown> & { user_id?: string };

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function accountDraftKey(userId: string): string {
  if (!userId.trim()) throw new Error("A draft requires an authenticated account ID.");
  return `${ACCOUNT_DRAFT_PREFIX}${encodeURIComponent(userId)}`;
}

function parseDraft(raw: string | null): DraftData | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as DraftData
      : null;
  } catch {
    return null;
  }
}

export function loadAccountDraft(storage: DraftStorage, userId: string): DraftData | null {
  const key = accountDraftKey(userId);
  const accountDraft = parseDraft(storage.getItem(key));
  if (accountDraft) return accountDraft.user_id === userId ? accountDraft : null;

  // A legacy draft without an owner is kept in place and never shown to an account.
  const legacyDraft = parseDraft(storage.getItem(LEGACY_DRAFT_KEY));
  if (!legacyDraft || legacyDraft.user_id !== userId) return null;

  const migrated = { ...legacyDraft, user_id: userId };
  storage.setItem(key, JSON.stringify(migrated));
  return migrated;
}

export function saveAccountDraft(storage: DraftStorage, userId: string, draft: DraftData): void {
  storage.setItem(accountDraftKey(userId), JSON.stringify({ ...draft, user_id: userId }));
}
