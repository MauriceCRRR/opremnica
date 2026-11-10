// Preklic lastne rezervacije pred prevzemom (podpora MVP, del US-07)
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { ANA, MIHA, NIK, idKosa, idRezervacije, posnetek, prijavi, pripravi, stanjeRezervacije } from './pomoc.js';

let app, baza, ana;
beforeEach(async () => {
  ({ app, baza } = pripravi());
  ana = await prijavi(app, ANA);
});

const preklici = (odjemalec, id) => odjemalec.post(`/api/rezervacije/${id}/preklic`);

test('lastnik prekliče svojo oddano rezervacijo in termin je takoj prost', async () => {
  const sotor = idKosa(baza, 'SOT-01'); // Anina ODDANA za 20.–22. 11.
  const id = idRezervacije(baza, 'SOT-01');

  const odgovor = await preklici(ana, id);
  assert.equal(odgovor.status, 200);
  assert.equal(stanjeRezervacije(baza, id), 'PREKLICANA');

  const nik = await prijavi(app, NIK);
  const nova = await nik.post('/api/rezervacije').send({ kos_id: sotor, datum_od: '2026-11-20', datum_do: '2026-11-22' });
  assert.equal(nova.status, 201);
});

test('lastnik prekliče tudi že odobreno rezervacijo', async () => {
  const id = idRezervacije(baza, 'ZVOK-01'); // Anina ODOBRENA
  assert.equal((await preklici(ana, id)).status, 200);
  assert.equal(stanjeRezervacije(baza, id), 'PREKLICANA');
});

test('tuje rezervacije ni mogoče preklicati (403), niti skrbnik je v tem sklopu ne more', async () => {
  const prej = posnetek(baza);
  const nikova = idRezervacije(baza, 'PROJ-01'); // Nikova ODDANA
  assert.equal((await preklici(ana, nikova)).status, 403);

  const anina = idRezervacije(baza, 'SOT-01');
  assert.equal((await preklici(await prijavi(app, MIHA), anina)).status, 403);
  assert.equal(posnetek(baza), prej);
});

test('prevzete ali zaključene rezervacije ni mogoče preklicati (R2)', async () => {
  const nik = await prijavi(app, NIK);
  const prej = posnetek(baza);

  const primeri = [
    [nik, 'KOLO-01', 'PREVZETA'],
    [nik, 'FOTO-03', 'ZAVRNJENA'],
    [ana, 'KOLO-02', 'VRNJENA'],
  ];
  for (const [odjemalec, oznaka, stanje] of primeri) {
    const odgovor = await preklici(odjemalec, idRezervacije(baza, oznaka));
    assert.equal(odgovor.status, 409, stanje);
    assert.equal(odgovor.body.napaka, `Rezervacije v stanju ${stanje} ni mogoče preklicati`);
  }
  assert.equal(posnetek(baza), prej);

  // dvojni preklic: drugi ne naredi nič
  const id = idRezervacije(baza, 'SOT-01');
  await preklici(ana, id).expect(200);
  const poPrvem = posnetek(baza);
  assert.equal((await preklici(ana, id)).status, 409);
  assert.equal(posnetek(baza), poPrvem);
});

test('neobstoječa ali neveljavna številka vrne 404, brez prijave 401', async () => {
  const prej = posnetek(baza);
  for (const id of [9999, 'abc', '1e1', '-1']) {
    assert.equal((await preklici(ana, id)).status, 404, String(id));
  }
  assert.equal((await preklici(request(app), idRezervacije(baza, 'SOT-01'))).status, 401);
  assert.equal(posnetek(baza), prej);
});
