import test from 'node:test';
import assert from 'node:assert/strict';
import { beginIssue, completeIssue, readIssueIntent, rejectIssue, startNewIssue } from '../app/lib/document-issuance.ts';
class Store {
  values = new Map();
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k,v) { this.values.set(k,v); }
  removeItem(k) { this.values.delete(k); }
}
const payload = { user_id: 'user-a', document_type: 'facture', services: [{ price: 25, quantity: 2 }], total_ht: 50 };
test('retry after lost response or reload reuses the persisted request and immutable payload', () => {
  const storage = new Store();
  const first = beginIssue(storage, 'user-a', payload);
  const retry = beginIssue(storage, 'user-a', { ...payload });
  assert.equal(first.request_id, retry.request_id);
  assert.deepEqual(readIssueIntent(storage, 'user-a').payload, payload);
  assert.throws(() => beginIssue(storage, 'user-a', { ...payload, total_ht: 1 }), /reprenez/i);
  assert.throws(() => startNewIssue(storage, 'user-a'), /attente/i);
});
test('success survives reload and an intentional new document receives a new request key', () => {
  const storage = new Store();
  const first = beginIssue(storage, 'user-a', payload);
  const result = { id: 'document-1', document_number: 'F-2026-01' };
  completeIssue(storage, 'user-a', first.request_id, result);
  assert.deepEqual(beginIssue(storage, 'user-a', payload).result, result);
  startNewIssue(storage, 'user-a');
  assert.notEqual(beginIssue(storage, 'user-a', payload).request_id, first.request_id);
});
test('ambiguous failures cannot release the pending attempt; a definite rollback can', () => {
  const storage = new Store();
  const intent = beginIssue(storage, 'user-a', payload);
  rejectIssue(storage, 'user-a', intent.request_id, '504');
  assert.ok(readIssueIntent(storage, 'user-a'));
  rejectIssue(storage, 'user-a', intent.request_id, '23514');
  assert.equal(readIssueIntent(storage, 'user-a'), null);
});
test('accounts and stale completions cannot overwrite another issuance', () => {
  const storage = new Store();
  beginIssue(storage, 'user-a', payload);
  assert.equal(readIssueIntent(storage, 'user-b'), null);
  assert.throws(() => beginIssue(storage, 'user-b', payload), /compte/);
  assert.throws(() => completeIssue(storage, 'user-a', crypto.randomUUID(), { id: 'bad', document_number: 'bad' }), /changé/);
});
test('blocked storage and corrupt state fail before a provider/RPC could be called', () => {
  const storage = new Store();
  storage.setItem = () => { throw Error('quota'); };
  assert.throws(() => beginIssue(storage, 'user-a', payload), /quota/);
  storage.getItem = () => '{';
  assert.throws(() => beginIssue(storage, 'user-a', payload), /illisible/);
});
