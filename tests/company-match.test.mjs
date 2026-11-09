import assert from 'node:assert/strict';
import test from 'node:test';
import { findExactCompany } from '../app/lib/company-match.ts';
const company = { siren: '123456789', siege: { siret: '12345678900001' }, matching_etablissements: [{ siret: '12345678900002' }] };
test('company lookup never substitutes a fuzzy result for the requested identity', () => {
  assert.equal(findExactCompany([company], '987654321'), undefined);
  assert.equal(findExactCompany([company], '12345678999999'), undefined);
});
test('company lookup matches SIREN, headquarters and branch SIRET exactly', () => {
  for (const id of ['123456789', '12345678900001', '12345678900002']) assert.equal(findExactCompany([company], id), company);
  assert.equal(findExactCompany([], '123456789'), undefined);
});
