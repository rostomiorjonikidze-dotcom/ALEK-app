import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as bodyReader from '../app/lib/request-body.ts';
import * as receiptValues from '../app/lib/receipt-values.ts';

function route({ user = { id: 'account-a' }, allowed = true, providerFails = false } = {}) {
  const calls = [];
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync('app/api/receipts/scan/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, Buffer, AbortSignal, process: { env: { GROQ_API_KEY: 'isolated-placeholder' } },
    fetch: async (url, options) => {
      calls.push(['provider', url, JSON.parse(options.body)]);
      if (providerFails) throw Error('private provider details');
      return Response.json({ choices: [{ message: { content: JSON.stringify({ merchant: 'Fournisseur fictif', total_ttc: 12, currency: 'EUR' }) } }] });
    },
    require(name) {
      if (name === 'next/server') return { NextResponse: Response };
      if (name.endsWith('/request-body')) return bodyReader;
      if (name.endsWith('/receipt-values')) return receiptValues;
      if (name.endsWith('/_shared')) return {
        userFrom: async () => user,
        admin: () => ({ rpc: async (name, args) => {
          calls.push(['rpc', name, args]);
          return { data: { allowed, role: 'user', plan: 'free' }, error: null };
        } }),
      };
      throw Error(`Unexpected dependency ${name}`);
    },
  });
  return { exports, calls };
}
const request = () => new Request('https://example.invalid/api/receipts/scan', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ image: 'data:image/png;base64,aXNvbGF0ZWQ=', user_id: 'account-b', p_user_id: 'account-b' }),
});

test('receipt OCR is inaccessible anonymously and never contacts a provider', async () => {
  const r = route({ user: null });
  assert.equal((await r.exports.POST(request())).status, 401);
  assert.equal(r.calls.length, 0);
});
test('receipt reservation ignores caller-supplied owners and does not persist the image', async () => {
  const r = route();
  const response = await r.exports.POST(request());
  assert.equal(response.status, 200);
  assert.equal(r.calls[0][1], 'reserve_ai_usage');
  assert.equal(r.calls[0][2].p_user_id, 'account-a');
  assert.equal(r.calls.filter(c => c[0] === 'provider').length, 1);
  assert.equal(r.calls.filter(c => c[0] === 'rpc').length, 1);
  assert.doesNotMatch(JSON.stringify(await response.json()), /account-b|isolated-placeholder|data:image/);
});
test('receipt quota denial prevents OCR and provider failure refunds only the authenticated account', async () => {
  const denied = route({ allowed: false });
  assert.equal((await denied.exports.POST(request())).status, 429);
  assert.equal(denied.calls.filter(c => c[0] === 'provider').length, 0);
  const failed = route({ providerFails: true });
  const response = await failed.exports.POST(request());
  assert.equal(response.status, 502);
  const refunds = failed.calls.filter(c => c[1] === 'refund_ai_usage');
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0][2].p_user_id, 'account-a');
  assert.doesNotMatch(JSON.stringify(await response.json()), /private provider|isolated-placeholder/);
});
