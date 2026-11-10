// US-02 Pregled opreme in razpoložljivosti
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { ANA, MIHA, prijavi, pripravi, vstaviRezervacijo } from './pomoc.js';

let app, baza, ana;
beforeEach(async () => {
  ({ app, baza } = pripravi());
  ana = await prijavi(app, ANA);
});

// razpoložljivost enega kosa v terminu
async function razpolozljivost(oznaka, od, datumDo) {
  const kosi = (await ana.get(`/api/oprema?od=${od}&do=${datumDo}`).expect(200)).body;
  return kosi.find((kos) => kos.inventarna_oznaka === oznaka).razpolozljivost;
}

// FOTO-02 v začetnih podatkih nima rezervacij; tu mu dodamo eno za 13.–16. 11.
const rezervirajFoto02 = (stanje) => vstaviRezervacijo(baza, { stanje });

test('AC1: seznam ima vse kose razen odpisanih, z oznako, nazivom, kategorijo in razpoložljivostjo', async () => {
  const kosi = (await ana.get('/api/oprema?od=2026-11-13&do=2026-11-16')).body;

  assert.equal(kosi.length, 10); // 11 kosov, eden je odpisan
  assert.ok(!kosi.some((kos) => kos.inventarna_oznaka === 'KUH-01'));
  assert.deepEqual(kosi[0], {
    id: kosi[0].id,
    inventarna_oznaka: 'FOTO-01',
    naziv: 'Fotoaparat, zrcalnorefleksni',
    kategorija: 'Fotografija',
    razpolozljivost: 'ZASEDEN',
  });
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'FOTO-02').razpolozljivost, 'PROST');
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'FOTO-04').razpolozljivost, 'V_POPRAVILU');
});

test('AC1: filter po kategoriji', async () => {
  const kategorije = (await ana.get('/api/kategorije')).body;
  assert.deepEqual(kategorije.map((k) => k.ime), ['Fotografija', 'Kolesa', 'Ozvočenje in projekcija', 'Taborjenje']);

  const kolesa = kategorije.find((k) => k.ime === 'Kolesa');
  const kosi = (await ana.get(`/api/oprema?od=2026-11-13&do=2026-11-16&kategorija=${kolesa.id}`)).body;
  assert.deepEqual(kosi.map((kos) => kos.inventarna_oznaka), ['KOLO-01', 'KOLO-02']);

  // prazna izbira pomeni vse kategorije
  assert.equal((await ana.get('/api/oprema?od=2026-11-13&do=2026-11-16&kategorija=')).body.length, 10);
  assert.equal((await ana.get('/api/oprema?od=2026-11-13&do=2026-11-16&kategorija=abc')).status, 400);
});

test('AC2: skupni robni dan pomeni zasedeno, dan prej in dan potem je prosto', async () => {
  rezervirajFoto02('ODOBRENA'); // 13.–16. 11.

  assert.equal(await razpolozljivost('FOTO-02', '2026-11-10', '2026-11-12'), 'PROST');
  assert.equal(await razpolozljivost('FOTO-02', '2026-11-10', '2026-11-13'), 'ZASEDEN');
  assert.equal(await razpolozljivost('FOTO-02', '2026-11-13', '2026-11-13'), 'ZASEDEN');
  assert.equal(await razpolozljivost('FOTO-02', '2026-11-14', '2026-11-15'), 'ZASEDEN');
  assert.equal(await razpolozljivost('FOTO-02', '2026-11-12', '2026-11-17'), 'ZASEDEN');
  assert.equal(await razpolozljivost('FOTO-02', '2026-11-16', '2026-11-18'), 'ZASEDEN');
  assert.equal(await razpolozljivost('FOTO-02', '2026-11-17', '2026-11-20'), 'PROST');
});

test('AC2: termin zasedajo samo ODDANA, ODOBRENA in PREVZETA', async () => {
  const pricakovano = {
    ODDANA: 'ZASEDEN',
    ODOBRENA: 'ZASEDEN',
    PREVZETA: 'ZASEDEN',
    ZAVRNJENA: 'PROST',
    PREKLICANA: 'PROST',
    VRNJENA: 'PROST',
  };
  for (const [stanje, rezultat] of Object.entries(pricakovano)) {
    baza.exec('DELETE FROM rezervacija');
    rezervirajFoto02(stanje);
    assert.equal(await razpolozljivost('FOTO-02', '2026-11-13', '2026-11-16'), rezultat, stanje);
  }
});

test('AC2: rezervacija enega kosa ne zasede drugega', async () => {
  rezervirajFoto02('ODOBRENA');
  assert.equal(await razpolozljivost('FOTO-03', '2026-11-13', '2026-11-16'), 'PROST');
});

test('AC2: kos v popravilu ni prost, tudi če nima rezervacij', async () => {
  assert.equal(await razpolozljivost('FOTO-04', '2026-12-01', '2026-12-02'), 'V_POPRAVILU');
});

test('AC3: odgovor ne pove, kdo ima kos rezerviran, niti skrbniku', async () => {
  for (const odjemalec of [ana, await prijavi(app, MIHA)]) {
    const odgovor = await odjemalec.get('/api/oprema?od=2026-11-13&do=2026-11-16');
    for (const kos of odgovor.body) {
      assert.deepEqual(Object.keys(kos).sort(), ['id', 'inventarna_oznaka', 'kategorija', 'naziv', 'razpolozljivost']);
    }
    assert.doesNotMatch(odgovor.text, /Zupan|Nik|example\.org/);
  }
});

test('AC4: datum do pred datumom od se zavrne s sporočilom', async () => {
  const odgovor = await ana.get('/api/oprema?od=2026-11-16&do=2026-11-13');
  assert.equal(odgovor.status, 400);
  assert.deepEqual(odgovor.body, { napaka: 'Datum do ne sme biti pred datumom od' });
});

test('AC4: manjkajoč ali neobstoječ datum se zavrne', async () => {
  for (const poizvedba of ['', 'od=2026-11-13', 'od=2026-11-13&do=', 'od=13.11.2026&do=16.11.2026', 'od=2026-02-30&do=2026-03-01', 'od=2026-11-13&do=2026-11-31']) {
    const odgovor = await ana.get('/api/oprema?' + poizvedba);
    assert.equal(odgovor.status, 400, poizvedba);
    assert.equal(odgovor.body.napaka, 'Vnesi veljavna datuma od in do');
  }
});
