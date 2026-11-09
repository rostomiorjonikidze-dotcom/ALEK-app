import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptNumberOrNull } from '../app/lib/receipt-values.ts';
test('unreadable receipt amounts remain unknown rather than silently becoming zero', () => {
  for (const value of ['', '  ', null, undefined, false, 'illisible', Infinity, NaN]) assert.equal(receiptNumberOrNull(value), null);
});
test('receipt amounts preserve explicit zero, credits and French decimal formatting', () => {
  assert.equal(receiptNumberOrNull('1 234,56'), 1234.56);
  assert.equal(receiptNumberOrNull('0'), 0);
  assert.equal(receiptNumberOrNull(-12.5), -12.5);
});
