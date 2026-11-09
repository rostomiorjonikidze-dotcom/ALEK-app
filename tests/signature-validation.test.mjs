import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSignatureConsent, signatureLinkExpired } from '../app/lib/signature-validation.ts';
test('signature requires explicit boolean consent', () => {
  for (const value of [false, 'false', 'true', 1, {}, null, undefined]) assert.equal(hasSignatureConsent(value), false);
  assert.equal(hasSignatureConsent(true), true);
});
test('signature expiry fails closed and includes the exact expiry boundary', () => {
  const now = Date.parse('2026-11-09T12:00:00Z');
  assert.equal(signatureLinkExpired('invalid', now), true);
  assert.equal(signatureLinkExpired('', now), true);
  assert.equal(signatureLinkExpired('2026-11-09T12:00:00Z', now), true);
  assert.equal(signatureLinkExpired('2026-11-09T12:00:01Z', now), false);
});
