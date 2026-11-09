import test from "node:test";
import assert from "node:assert/strict";
import { accountDraftKey, LEGACY_DRAFT_KEY, loadAccountDraft, saveAccountDraft } from "../app/lib/document-drafts.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test("drafts are stored and loaded only under the matching account key", () => {
  const storage = new MemoryStorage();
  saveAccountDraft(storage, "user/one", { clientName: "Client A" });
  saveAccountDraft(storage, "user-two", { clientName: "Client B" });
  assert.notEqual(accountDraftKey("user/one"), accountDraftKey("user-two"));
  assert.equal(loadAccountDraft(storage, "user/one").clientName, "Client A");
  assert.equal(loadAccountDraft(storage, "user-two").clientName, "Client B");
  assert.equal(loadAccountDraft(storage, "other-user"), null);
});

test("draft helpers reject an empty account identity", () => {
  const storage = new MemoryStorage();
  assert.throws(() => saveAccountDraft(storage, "", { clientName: "No account" }));
  assert.throws(() => loadAccountDraft(storage, " "));
  assert.equal(storage.values.size, 0);
});

test("legacy draft without an owner stays untouched and is never exposed", () => {
  const storage = new MemoryStorage();
  const legacy = JSON.stringify({ clientName: "Compte inconnu" });
  storage.setItem(LEGACY_DRAFT_KEY, legacy);
  assert.equal(loadAccountDraft(storage, "current-user"), null);
  assert.equal(storage.getItem(LEGACY_DRAFT_KEY), legacy);
  assert.equal(storage.getItem(accountDraftKey("current-user")), null);
});

test("legacy draft migrates only when its explicit owner matches", () => {
  const storage = new MemoryStorage();
  const legacy = JSON.stringify({ user_id: "owner-1", clientName: "Client attribué" });
  storage.setItem(LEGACY_DRAFT_KEY, legacy);
  assert.equal(loadAccountDraft(storage, "owner-2"), null);
  assert.equal(loadAccountDraft(storage, "owner-1").clientName, "Client attribué");
  assert.equal(storage.getItem(LEGACY_DRAFT_KEY), legacy);
});
