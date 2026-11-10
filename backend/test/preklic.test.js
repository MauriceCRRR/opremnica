// Preklic pred prevzemom: lastnik svojo, skrbnik tujo odobreno z razlogom (podpora MVP, del US-07)
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { ANA, MIHA, NIK, PETRA, idKosa, idRezervacije, posnetek, prijavi, pripravi, stanjeRezervacije } from './pomoc.js';

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

test('tuje rezervacije član in administrator ne moreta preklicati (403)', async () => {
  const prej = posnetek(baza);
  assert.equal((await preklici(ana, idRezervacije(baza, 'PROJ-01'))).status, 403); // Nikova ODDANA
  assert.equal((await preklici(ana, idRezervacije(baza, 'FOTO-01')).send({ razlog: 'x' })).status, 403); // Nikova ODOBRENA

  const petra = await prijavi(app, PETRA);
  assert.equal((await preklici(petra, idRezervacije(baza, 'ZVOK-01')).send({ razlog: 'x' })).status, 403);
  assert.equal(posnetek(baza), prej);
});

test('skrbnik prekliče tujo odobreno rezervacijo samo z razlogom; član razlog vidi', async () => {
  const miha = await prijavi(app, MIHA);
  const odobrena = idRezervacije(baza, 'ZVOK-01'); // Anina ODOBRENA za 11.–12. 11.
  const prej = posnetek(baza);

  for (const razlog of [undefined, '', '   ']) {
    const odgovor = await preklici(miha, odobrena).send({ razlog });
    assert.equal(odgovor.status, 400, JSON.stringify(razlog));
    assert.equal(odgovor.body.napaka, 'Razlog preklica je obvezen');
  }
  assert.equal(posnetek(baza), prej);

  assert.equal((await preklici(miha, odobrena).send({ razlog: ' Ni prevzeta v terminu. ' })).status, 200);
  const moje = (await ana.get('/api/rezervacije/moje')).body;
  assert.deepEqual(
    moje.filter((m) => m.id === odobrena).map((m) => [m.stanje, m.razlog]),
    [['PREKLICANA', 'Ni prevzeta v terminu.']],
  );
  // termin je spet prost
  const kosi = (await ana.get('/api/oprema?od=2026-11-11&do=2026-11-12')).body;
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'ZVOK-01').razpolozljivost, 'PROST');
});

test('skrbnik tuje oddane rezervacije ne prekliče (zavrne jo), prevzete tudi ne', async () => {
  const miha = await prijavi(app, MIHA);
  const prej = posnetek(baza);

  const oddana = await preklici(miha, idRezervacije(baza, 'SOT-01')).send({ razlog: 'razlog' });
  assert.equal(oddana.status, 409);
  assert.equal(oddana.body.napaka, 'Oddane rezervacije skrbnik ne prekliče, ampak jo zavrne');
  assert.equal((await preklici(miha, idRezervacije(baza, 'KOLO-01')).send({ razlog: 'razlog' })).status, 409);
  assert.equal(posnetek(baza), prej);
});

test('skrbnik svojo rezervacijo prekliče kot lastnik, brez razloga', async () => {
  const miha = await prijavi(app, MIHA);
  const svoja = await miha.post('/api/rezervacije').send({ kos_id: idKosa(baza, 'FOTO-02'), datum_od: '2026-11-13', datum_do: '2026-11-14' });
  assert.equal((await preklici(miha, svoja.body.id)).status, 200);
  assert.equal(stanjeRezervacije(baza, svoja.body.id), 'PREKLICANA');
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
