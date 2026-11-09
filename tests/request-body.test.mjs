import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonObject, readTextBody, RequestBodyError } from '../app/lib/request-body.ts';
const request = (body, headers = {}) => new Request('https://example.invalid', { method: 'POST', headers: {'content-type':'application/json', ...headers}, body });
const fails = (req, limit, status) => assert.rejects(readJsonObject(req, limit), e => e instanceof RequestBodyError && e.status === status);
test('bounded JSON preserves French text and rejects non-object payloads', async () => {
  assert.deepEqual(await readJsonObject(request('{"nom":"Élodie"}'), 100), {nom:'Élodie'});
  for (const text of ['null', '[]', '"texte"', '42', '{', '']) await fails(request(text), 100, 400);
});
test('counts bytes even with missing or dishonest Content-Length', async () => {
  await fails(request('{"nom":"ééééé"}'), 18, 413);
  await fails(request('{"nom":"ééééé"}', {'content-length':'1'}), 18, 413);
  await fails(request('{}', {'content-length':'1000'}), 100, 413);
  assert.deepEqual(await readJsonObject(request('{}'), 2), {});
});
test('rejects wrong media types and invalid UTF-8', async () => {
  await fails(request('{}', {'content-type':'text/plain'}), 100, 415);
  await fails(request(new Uint8Array([123,34,120,34,58,34,255,34,125])), 100, 400);
});
test('stops and cancels chunked input at the byte limit', async () => {
  let canceled = false;
  const stream = new ReadableStream({start(c) {c.enqueue(new TextEncoder().encode('{"text":"'));c.enqueue(new Uint8Array(100));},cancel(){canceled=true;}});
  const req = new Request('https://example.invalid', {method:'POST', headers:{'content-type':'application/json'},body:stream,duplex:'half'});
  await fails(req, 50, 413);
  assert.equal(canceled,true);
});

test('raw webhook reader preserves signed UTF-8 text including BOM and whitespace', async () => {
  const raw='\uFEFF { "texte": "Élodie" }\n';
  assert.equal(await readTextBody(request(raw), 100), raw);
});
