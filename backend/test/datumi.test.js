import assert from 'node:assert/strict';
import { test } from 'node:test';
import { danes, jeDatum, lokalniCas, pristejDni, razlikaDni } from '../src/datumi.js';

test('danes je koledarski dan v Ljubljani, ne v UTC', () => {
  // pozimi (UTC+1): 23:30 UTC je v Ljubljani že naslednji dan
  assert.equal(danes(new Date('2026-11-10T22:59:59Z')), '2026-11-10');
  assert.equal(danes(new Date('2026-11-10T23:00:00Z')), '2026-11-11');
  // poleti (UTC+2) se dan zamenja uro prej
  assert.equal(danes(new Date('2026-07-01T21:59:59Z')), '2026-07-01');
  assert.equal(danes(new Date('2026-07-01T22:00:00Z')), '2026-07-02');
});

test('danes okoli prehoda na zimski čas (25. 10. 2026)', () => {
  assert.equal(danes(new Date('2026-10-24T22:00:00Z')), '2026-10-25'); // polnoč, še poletni čas
  assert.equal(danes(new Date('2026-10-25T22:30:00Z')), '2026-10-25'); // 23:30, že zimski čas
  assert.equal(danes(new Date('2026-10-25T23:00:00Z')), '2026-10-26');
});

test('lokalni čas je zapisan kot v podatkovnem modelu', () => {
  assert.equal(lokalniCas(new Date('2026-11-13T16:05:00Z')), '2026-11-13T17:05:00');
});

test('jeDatum sprejme samo prave koledarske datume', () => {
  assert.ok(jeDatum('2026-11-13'));
  assert.ok(jeDatum('2028-02-29')); // prestopno leto

  for (const slabo of ['2026-02-29', '2026-02-30', '2026-11-31', '2026-13-01', '13.11.2026', '2026-11-13T10:00', '', undefined, null, ['2026-11-13', '2026-11-14']]) {
    assert.ok(!jeDatum(slabo), String(slabo));
  }
});

test('pristejDni šteje koledarske dni čez konec meseca, leta in premik ure', () => {
  assert.equal(pristejDni('2026-11-11', 0), '2026-11-11');
  assert.equal(pristejDni('2026-11-11', -3), '2026-11-08');
  assert.equal(pristejDni('2026-11-28', 5), '2026-12-03');
  assert.equal(pristejDni('2026-12-30', 3), '2027-01-02');
  assert.equal(pristejDni('2026-10-24', 2), '2026-10-26'); // vmes je dan s 25 urami
  assert.equal(pristejDni('2027-03-27', 2), '2027-03-29'); // vmes je dan s 23 urami
  assert.equal(pristejDni('2026-11-11', 60), '2027-01-10');
});

test('razlikaDni šteje cele koledarske dni, tudi čez premik ure', () => {
  assert.equal(razlikaDni('2026-11-13', '2026-11-13'), 0);
  assert.equal(razlikaDni('2026-11-13', '2026-11-16'), 3);
  assert.equal(razlikaDni('2026-11-16', '2026-11-13'), -3);
  assert.equal(razlikaDni('2026-10-24', '2026-10-26'), 2); // vmes je dan s 25 urami
  assert.equal(razlikaDni('2027-03-27', '2027-03-29'), 2); // vmes je dan s 23 urami
  assert.equal(razlikaDni('2026-11-11', '2027-01-10'), 60);
});
