// US-05 Evidentiranje prevzema
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { ANA, MIHA, NIK, PETRA, idRezervacije, posnetek, prijavi, pripravi, stanjeRezervacije, vstaviRezervacijo } from './pomoc.js';

const ZUNAJ_TERMINA = 'Prevzem je mogoč samo v rezerviranem terminu';

let app, baza, premakniUro, miha, zaDanes;
beforeEach(async () => {
  ({ app, baza, premakniUro } = pripravi());
  miha = await prijavi(app, MIHA);
  zaDanes = idRezervacije(baza, 'ZVOK-01'); // Anina ODOBRENA za 11.–12. 11., danes je 11. 11.
});

const prevzemi = (odjemalec, id) => odjemalec.post(`/api/rezervacije/${id}/prevzem`);
const vrstica = (id) => baza.prepare('SELECT * FROM rezervacija WHERE id = ?').get(id);

test('AC1: Za prevzem so odobrene rezervacije z začetkom danes ali prej, po datumu začetka', async () => {
  vstaviRezervacijo(baza, { oznaka: 'SOT-02', od: '2026-11-10', datumDo: '2026-11-12', stanje: 'ODOBRENA' }); // začetek včeraj
  vstaviRezervacijo(baza, { oznaka: 'FOTO-02', od: '2026-11-06', datumDo: '2026-11-07', stanje: 'ODOBRENA' }); // termin je že minil
  vstaviRezervacijo(baza, { oznaka: 'FOTO-03', od: '2026-11-11', datumDo: '2026-11-11', stanje: 'ODDANA' }); // še ni odobrena

  const vse = (await miha.get('/api/rezervacije')).body;
  const zaPrevzem = vse.filter((r) => r.za_prevzem);
  assert.deepEqual(zaPrevzem.map((r) => [r.datum_od, r.inventarna_oznaka, r.stanje]), [
    ['2026-11-06', 'FOTO-02', 'ODOBRENA'],
    ['2026-11-10', 'SOT-02', 'ODOBRENA'],
    ['2026-11-11', 'ZVOK-01', 'ODOBRENA'],
  ]);
  // odobrena za 13. 11. še ni za prevzem
  assert.equal(vse.find((r) => r.inventarna_oznaka === 'FOTO-01').za_prevzem, false);
  assert.equal(zaPrevzem[2].clan, 'Ana Novak');
});

test('AC2: prevzem spremeni stanje v PREVZETA in zapiše čas', async () => {
  const odgovor = await prevzemi(miha, zaDanes);
  assert.equal(odgovor.status, 200);

  const r = vrstica(zaDanes);
  assert.equal(r.stanje, 'PREVZETA');
  assert.equal(r.prevzeto_ob, '2026-11-11T10:00:00');
  assert.equal(r.vrnjeno_ob, null);

  const ana = await prijavi(app, ANA);
  const moje = (await ana.get('/api/rezervacije/moje')).body;
  assert.equal(moje.find((m) => m.id === zaDanes).stanje, 'PREVZETA');
});

test('AC3 (R5, P6): pred datumom od in po datumu do prevzem ni mogoč', async () => {
  const prezgodaj = idRezervacije(baza, 'FOTO-01'); // 13.–16. 11.
  const prepozno = vstaviRezervacijo(baza, { oznaka: 'FOTO-02', od: '2026-11-06', datumDo: '2026-11-10', stanje: 'ODOBRENA' });
  const prej = posnetek(baza);

  for (const id of [prezgodaj, prepozno]) {
    const odgovor = await prevzemi(miha, id);
    assert.equal(odgovor.status, 409);
    assert.deepEqual(odgovor.body, { napaka: ZUNAJ_TERMINA });
  }
  assert.equal(posnetek(baza), prej);
});

test('AC3: prvi in zadnji dan termina sta še v terminu, meja je ljubljanska polnoč', async () => {
  const id = idRezervacije(baza, 'FOTO-01'); // 13.–16. 11.

  premakniUro('2026-11-12T23:59:00+01:00'); // dan pred začetkom
  assert.equal((await prevzemi(miha, id)).status, 409);
  premakniUro('2026-11-17T00:01:00+01:00'); // dan po koncu
  assert.equal((await prevzemi(miha, id)).status, 409);
  assert.equal(stanjeRezervacije(baza, id), 'ODOBRENA');

  premakniUro('2026-11-16T23:59:00+01:00'); // zadnji dan
  assert.equal((await prevzemi(miha, id)).status, 200);
  assert.equal(vrstica(id).prevzeto_ob, '2026-11-16T23:59:00');

  const prviDan = vstaviRezervacijo(baza, { oznaka: 'FOTO-02', od: '2026-11-13', datumDo: '2026-11-16', stanje: 'ODOBRENA' });
  premakniUro('2026-11-13T00:01:00+01:00'); // prvi dan, v UTC je še 12. 11.
  assert.equal((await prevzemi(miha, prviDan)).status, 200);
});

test('AC4 (R5, T6): kosa, ki ga prejšnji član še ni vrnil, ni mogoče prevzeti', async () => {
  // KOLO-01 ima Nik (PREVZETA, rok 10. 11. je že minil); Ana ga ima odobrenega za danes
  const anina = vstaviRezervacijo(baza, { oznaka: 'KOLO-01', email: ANA, od: '2026-11-11', datumDo: '2026-11-12', stanje: 'ODOBRENA' });
  const prej = posnetek(baza);

  const odgovor = await prevzemi(miha, anina);
  assert.equal(odgovor.status, 409);
  assert.deepEqual(odgovor.body, {
    napaka: 'Kos je še pri članu Nik Zupan, vrniti bi ga moral do 10. 11. 2026',
    clan: 'Nik Zupan',
    vrniti_do: '2026-11-10',
  });
  assert.equal(posnetek(baza), prej);

  // ko je Nikova rezervacija vrnjena, gre
  baza.prepare("UPDATE rezervacija SET stanje = 'VRNJENA', vrnjeno_ob = '2026-11-11T09:00:00' WHERE id = ?").run(idRezervacije(baza, 'KOLO-01'));
  assert.equal((await prevzemi(miha, anina)).status, 200);
});

test('AC5 (R4): kosa v popravilu ali odpisanega ni mogoče prevzeti', async () => {
  for (const stanjeKosa of ['V_POPRAVILU', 'ODPISAN']) {
    baza.prepare("UPDATE kos_opreme SET stanje_kosa = ? WHERE inventarna_oznaka = 'ZVOK-01'").run(stanjeKosa);
    const prej = posnetek(baza);

    const odgovor = await prevzemi(miha, zaDanes);
    assert.equal(odgovor.status, 409, stanjeKosa);
    assert.match(odgovor.body.napaka, /v popravilu ali odpisan/);
    assert.equal(posnetek(baza), prej);
  }
});

test('R2: prevzeti je mogoče samo odobreno rezervacijo; drugi poskus ne spremeni časa prvega', async () => {
  const prej = posnetek(baza);
  for (const oznaka of ['SOT-01', 'KOLO-01', 'KOLO-02', 'FOTO-03']) { // ODDANA, PREVZETA, VRNJENA, ZAVRNJENA
    const odgovor = await prevzemi(miha, idRezervacije(baza, oznaka));
    assert.equal(odgovor.status, 409, oznaka);
    assert.equal(odgovor.body.napaka, 'Prevzeti je mogoče samo odobreno rezervacijo');
  }
  assert.equal(posnetek(baza), prej);

  await prevzemi(miha, zaDanes).expect(200);
  const poPrvem = posnetek(baza);
  premakniUro('2026-11-12T08:00:00+01:00');
  assert.equal((await prevzemi(miha, zaDanes)).status, 409);
  assert.equal(posnetek(baza), poPrvem);
});

test('R3: član in administrator prevzema ne moreta evidentirati', async () => {
  const prej = posnetek(baza);
  for (const email of [ANA, NIK, PETRA]) {
    assert.equal((await prevzemi(await prijavi(app, email), zaDanes)).status, 403, email);
  }
  assert.equal((await prevzemi(request(app), zaDanes)).status, 401);
  for (const id of [9999, 'abc']) {
    assert.equal((await prevzemi(miha, id)).status, 404, String(id));
  }
  assert.equal(posnetek(baza), prej);
});
