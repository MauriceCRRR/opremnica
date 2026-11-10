// US-06 Evidentiranje vračila in stanja kosa
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { ANA, MIHA, NIK, PETRA, idKosa, idRezervacije, posnetek, prijavi, pripravi, stanjeRezervacije, vstaviRezervacijo } from './pomoc.js';

let app, baza, premakniUro, miha, izposojena;
beforeEach(async () => {
  ({ app, baza, premakniUro } = pripravi());
  miha = await prijavi(app, MIHA);
  izposojena = idRezervacije(baza, 'KOLO-01'); // Nikova PREVZETA za 8.–10. 11.; danes je 11. 11.
});

const vrni = (odjemalec, id, telo = { stanje_kosa: 'UPORABEN' }) => odjemalec.post(`/api/rezervacije/${id}/vracilo`).send(telo);
const POPRAVILO = { stanje_kosa: 'V_POPRAVILU', opomba: 'Počena zavorna ročica.' };
const vrstica = (id) => baza.prepare('SELECT * FROM rezervacija WHERE id = ?').get(id);
const stanjeKosa = (oznaka) => baza.prepare('SELECT stanje_kosa FROM kos_opreme WHERE inventarna_oznaka = ?').pluck().get(oznaka);
// rezervacije in kosi skupaj, za "nič se ni spremenilo"
const vse = () => posnetek(baza) + JSON.stringify(baza.prepare('SELECT * FROM kos_opreme ORDER BY id').all());
const oddaj = (odjemalec, oznaka, od, datumDo) => odjemalec.post('/api/rezervacije').send({ kos_id: idKosa(baza, oznaka), datum_od: od, datum_do: datumDo });

test('AC1: vračilo zapiše VRNJENA in čas; kos je takoj prost že za isti dan (P5)', async () => {
  const odgovor = await vrni(miha, izposojena);
  assert.equal(odgovor.status, 200);

  const r = vrstica(izposojena);
  assert.equal(r.stanje, 'VRNJENA');
  assert.equal(r.vrnjeno_ob, '2026-11-11T10:00:00');
  assert.equal(stanjeKosa('KOLO-01'), 'UPORABEN');

  const ana = await prijavi(app, ANA);
  const kosi = (await ana.get('/api/oprema?od=2026-11-11&do=2026-11-12')).body;
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'KOLO-01').razpolozljivost, 'PROST');
  assert.equal((await oddaj(ana, 'KOLO-01', '2026-11-11', '2026-11-12')).status, 201);
});

test('AC1 (P5, T8): vrnjena rezervacija sprosti dan vračila in preostale dni tudi ob predčasnem vračilu', async () => {
  // Ana ima FOTO-02 za 13.–16. 11.; do vračila je kos za Nika zaseden
  const ana = await prijavi(app, ANA);
  const nik = await prijavi(app, NIK);
  const anina = (await oddaj(ana, 'FOTO-02', '2026-11-13', '2026-11-16')).body.id;
  await miha.post(`/api/rezervacije/${anina}/odobritev`).expect(200);
  premakniUro('2026-11-13T09:00:00+01:00');
  await miha.post(`/api/rezervacije/${anina}/prevzem`).expect(200);
  assert.equal((await oddaj(nik, 'FOTO-02', '2026-11-15', '2026-11-18')).status, 409);

  premakniUro('2026-11-15T18:00:00+01:00'); // vrne dan pred rokom
  const odgovor = await vrni(miha, anina);
  assert.equal(odgovor.body.zamuda, 0);
  assert.equal((await oddaj(nik, 'FOTO-02', '2026-11-15', '2026-11-18')).status, 201);
});

test('AC2: »potrebuje popravilo« zahteva opombo in kos postane V_POPRAVILU', async () => {
  const prej = vse();
  for (const telo of [{ stanje_kosa: 'V_POPRAVILU' }, { stanje_kosa: 'V_POPRAVILU', opomba: '   ' }, { stanje_kosa: 'ODPISAN', opomba: 'x' }, { opomba: 'x' }, {}]) {
    assert.equal((await vrni(miha, izposojena, telo)).status, 400, JSON.stringify(telo));
  }
  assert.equal(vse(), prej);

  assert.equal((await vrni(miha, izposojena, POPRAVILO)).status, 200);
  assert.equal(vrstica(izposojena).opomba_vracila, 'Počena zavorna ročica.');
  assert.equal(stanjeKosa('KOLO-01'), 'V_POPRAVILU');

  // do popravila ga ni mogoče rezervirati (R4)
  const ana = await prijavi(app, ANA);
  const kosi = (await ana.get('/api/oprema?od=2026-11-20&do=2026-11-21')).body;
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'KOLO-01').razpolozljivost, 'V_POPRAVILU');
  assert.equal((await oddaj(ana, 'KOLO-01', '2026-11-20', '2026-11-21')).status, 409);
});

test('AC2: »brez poškodb« pusti kos uporaben, opomba je neobvezna', async () => {
  assert.equal((await vrni(miha, izposojena, { stanje_kosa: 'UPORABEN', opomba: ' očiščeno ' })).status, 200);
  assert.equal(vrstica(izposojena).opomba_vracila, 'očiščeno');
  assert.equal(stanjeKosa('KOLO-01'), 'UPORABEN');
});

test('AC3: zamuda je dan vračila minus datum do; izračunana, ne shranjena', async () => {
  // rok je bil 10. 11.: skrbnik in član že pred vračilom vidita en dan zamude
  const nik = await prijavi(app, NIK);
  const naSeznamu = (await miha.get('/api/rezervacije')).body.find((r) => r.id === izposojena);
  assert.equal(naSeznamu.zamuda, 1);
  assert.equal((await nik.get('/api/rezervacije/moje')).body.find((r) => r.id === izposojena).zamuda, 1);

  premakniUro('2026-11-13T12:00:00+01:00');
  const odgovor = await vrni(miha, izposojena);
  assert.equal(odgovor.body.zamuda, 3);

  // pri vrnjeni rezervaciji zamuda ostane 3 dni, tudi ko čas teče naprej
  premakniUro('2026-11-20T12:00:00+01:00');
  const vrnjena = (await nik.get('/api/rezervacije/moje')).body.find((r) => r.id === izposojena);
  assert.deepEqual([vrnjena.stanje, vrnjena.zamuda, vrnjena.vrnjeno_ob], ['VRNJENA', 3, '2026-11-13T12:00:00']);

  const stolpci = baza.prepare("SELECT name FROM pragma_table_info('rezervacija')").pluck().all();
  assert.ok(!stolpci.some((ime) => ime.includes('zamud')));
});

test('AC3: vračilo na zadnji dan ni zamuda; šteje ljubljanski dan, ne UTC', async () => {
  // rok 12. 11.: ob 23:30 še brez zamude
  const naRok = vstaviRezervacijo(baza, { oznaka: 'FOTO-02', od: '2026-11-10', datumDo: '2026-11-12', stanje: 'PREVZETA' });
  premakniUro('2026-11-12T10:00:00+01:00');
  assert.equal((await miha.get('/api/rezervacije')).body.find((r) => r.id === naRok).zamuda, 0);
  premakniUro('2026-11-12T23:30:00+01:00');
  assert.equal((await vrni(miha, naRok)).body.zamuda, 0);

  // pol ure čez polnoč je v Ljubljani že 13. 11. (v UTC še 12. 11.): en dan zamude
  const cezPolnoc = vstaviRezervacijo(baza, { oznaka: 'FOTO-03', od: '2026-11-10', datumDo: '2026-11-12', stanje: 'PREVZETA' });
  premakniUro('2026-11-13T00:30:00+01:00');
  assert.equal((await vrni(miha, cezPolnoc)).body.zamuda, 1);
});

test('AC3: zamuda čez premik ure šteje koledarske dni', async () => {
  // rok sobota, 24. 10. 2026; v noči na 25. 10. se ura premakne nazaj; vrnjeno v ponedeljek, 26. 10.
  ({ app, baza, premakniUro } = pripravi(':memory:', '2026-10-20'));
  miha = await prijavi(app, MIHA);
  const id = vstaviRezervacijo(baza, { oznaka: 'FOTO-02', od: '2026-10-20', datumDo: '2026-10-24', stanje: 'PREVZETA' });

  premakniUro('2026-10-26T00:10:00+01:00');
  assert.equal((await miha.get('/api/rezervacije')).body.find((r) => r.id === id).zamuda, 2);
  assert.equal((await vrni(miha, id)).body.zamuda, 2);

  // spomladi je dan krajši: rok 27. 3. 2027, vrnjeno 29. 3.
  ({ app, baza, premakniUro } = pripravi(':memory:', '2027-03-25'));
  miha = await prijavi(app, MIHA);
  const pomlad = vstaviRezervacijo(baza, { oznaka: 'FOTO-02', od: '2027-03-25', datumDo: '2027-03-27', stanje: 'PREVZETA' });
  premakniUro('2027-03-29T23:50:00+02:00');
  assert.equal((await vrni(miha, pomlad)).body.zamuda, 2);
});

test('AC4 (R2, T4): ponovno vračilo ne spremeni ne časa ne stanja kosa', async () => {
  await vrni(miha, izposojena).expect(200);
  const poPrvem = vse();

  premakniUro('2026-11-12T09:00:00+01:00');
  const drugic = await vrni(miha, izposojena, POPRAVILO);
  assert.equal(drugic.status, 409);
  assert.equal(drugic.body.napaka, 'Vrniti je mogoče samo prevzeto rezervacijo');
  assert.equal(vse(), poPrvem);
  assert.equal(stanjeKosa('KOLO-01'), 'UPORABEN');
});

test('AC1 (R2): vrniti je mogoče samo prevzeto rezervacijo', async () => {
  const prej = vse();
  for (const oznaka of ['SOT-01', 'ZVOK-01', 'KOLO-02', 'FOTO-03']) { // ODDANA, ODOBRENA, VRNJENA, ZAVRNJENA
    assert.equal((await vrni(miha, idRezervacije(baza, oznaka), POPRAVILO)).status, 409, oznaka);
  }
  for (const id of [9999, 'abc']) {
    assert.equal((await vrni(miha, id)).status, 404, String(id));
  }
  assert.equal(vse(), prej);
});

test('AC5: ob poškodbi odgovor našteje še neizpeljane rezervacije kosa; te so do odločitve blokirane', async () => {
  const oddana = vstaviRezervacijo(baza, { oznaka: 'KOLO-01', email: ANA, od: '2026-11-20', datumDo: '2026-11-21', stanje: 'ODDANA' });
  const odobrena = vstaviRezervacijo(baza, { oznaka: 'KOLO-01', email: ANA, od: '2026-11-14', datumDo: '2026-11-15', stanje: 'ODOBRENA' });
  vstaviRezervacijo(baza, { oznaka: 'KOLO-01', email: ANA, od: '2026-11-25', datumDo: '2026-11-26', stanje: 'PREKLICANA' }); // ni aktivna
  vstaviRezervacijo(baza, { oznaka: 'KOLO-02', email: ANA, od: '2026-11-14', datumDo: '2026-11-15', stanje: 'ODOBRENA' }); // drug kos

  const odgovor = await vrni(miha, izposojena, POPRAVILO);
  assert.equal(odgovor.status, 200);
  assert.deepEqual(odgovor.body.prizadete, [
    { id: odobrena, datum_od: '2026-11-14', datum_do: '2026-11-15', stanje: 'ODOBRENA', clan: 'Ana Novak' },
    { id: oddana, datum_od: '2026-11-20', datum_do: '2026-11-21', stanje: 'ODDANA', clan: 'Ana Novak' },
  ]);
  // na skrbnikovem seznamu je pri obeh vidno, da je kos v popravilu
  const naSeznamu = (await miha.get('/api/rezervacije')).body.filter((r) => r.stanje_kosa === 'V_POPRAVILU');
  assert.deepEqual(naSeznamu.map((r) => r.id).sort(), [odobrena, oddana].sort());

  // prevzem odobrene ni mogoč (R4), dokler je kos v popravilu
  premakniUro('2026-11-14T09:00:00+01:00');
  const prevzem = await miha.post(`/api/rezervacije/${odobrena}/prevzem`);
  assert.equal(prevzem.status, 409);
  assert.match(prevzem.body.napaka, /v popravilu ali odpisan/);
  assert.equal(stanjeRezervacije(baza, odobrena), 'ODOBRENA');
});

test('AC5: brez poškodb ni prizadetih rezervacij', async () => {
  vstaviRezervacijo(baza, { oznaka: 'KOLO-01', email: ANA, od: '2026-11-14', datumDo: '2026-11-15', stanje: 'ODOBRENA' });
  assert.deepEqual((await vrni(miha, izposojena)).body, { stanje: 'VRNJENA', zamuda: 1, prizadete: [] });
});

test('R3: član in administrator vračila ne moreta evidentirati', async () => {
  const prej = vse();
  for (const email of [ANA, NIK, PETRA]) {
    assert.equal((await vrni(await prijavi(app, email), izposojena, POPRAVILO)).status, 403, email);
  }
  assert.equal((await vrni(request(app), izposojena)).status, 401);
  assert.equal(vse(), prej);
});

test('celotna pot s ponovnim zagonom: rezervacija, odobritev, prevzem, pozno vračilo s poškodbo', async () => {
  const mapa = mkdtempSync(join(tmpdir(), 'opremnica-test-'));
  const pot = join(mapa, 'baza.sqlite');
  // vsak korak teče po "ponovnem zagonu": nova povezava in nova aplikacija nad isto datoteko
  const korak = async (cas, dejanje) => {
    const zagon = pripravi(pot);
    zagon.premakniUro(cas);
    try {
      return await dejanje(zagon);
    } finally {
      zagon.baza.close();
    }
  };
  try {
    const id = await korak('2026-11-11T10:00:00+01:00', async (z) => {
      const ana = await prijavi(z.app, ANA);
      const oddana = await ana.post('/api/rezervacije').send({ kos_id: idKosa(z.baza, 'FOTO-02'), datum_od: '2026-11-13', datum_do: '2026-11-16', namen: 'izlet foto sekcije' });
      assert.equal(oddana.status, 201);
      return oddana.body.id;
    });
    await korak('2026-11-11T20:00:00+01:00', async (z) => {
      await (await prijavi(z.app, MIHA)).post(`/api/rezervacije/${id}/odobritev`).expect(200);
    });
    await korak('2026-11-13T17:05:00+01:00', async (z) => {
      await (await prijavi(z.app, MIHA)).post(`/api/rezervacije/${id}/prevzem`).expect(200);
    });
    await korak('2026-11-17T09:30:00+01:00', async (z) => {
      const odgovor = await (await prijavi(z.app, MIHA)).post(`/api/rezervacije/${id}/vracilo`).send({ stanje_kosa: 'V_POPRAVILU', opomba: 'Opraskan objektiv.' });
      assert.deepEqual(odgovor.body, { stanje: 'VRNJENA', zamuda: 1, prizadete: [] });
    });
    await korak('2026-11-18T08:00:00+01:00', async (z) => {
      const r = z.baza.prepare('SELECT * FROM rezervacija WHERE id = ?').get(id);
      assert.deepEqual(
        [r.stanje, r.oddano_ob, r.odloceno_ob, r.prevzeto_ob, r.vrnjeno_ob, r.opomba_vracila],
        ['VRNJENA', '2026-11-11T10:00:00', '2026-11-11T20:00:00', '2026-11-13T17:05:00', '2026-11-17T09:30:00', 'Opraskan objektiv.'],
      );
      assert.equal(z.baza.prepare("SELECT stanje_kosa FROM kos_opreme WHERE inventarna_oznaka = 'FOTO-02'").pluck().get(), 'V_POPRAVILU');
      const moje = (await (await prijavi(z.app, ANA)).get('/api/rezervacije/moje')).body;
      assert.deepEqual(moje.filter((m) => m.id === id).map((m) => [m.stanje, m.zamuda]), [['VRNJENA', 1]]);
    });
  } finally {
    rmSync(mapa, { recursive: true });
  }
});
