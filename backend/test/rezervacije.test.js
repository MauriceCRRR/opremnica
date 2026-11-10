// US-03 Oddaja rezervacije s preverjanjem prekrivanja
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { ANA, MIHA, NIK, PETRA, idKosa, idUporabnika, posnetek, prijavi, pripravi, vstaviRezervacijo } from './pomoc.js';

const ZASEDENO = 'Kos je v izbranem terminu že rezerviran';

let app, baza, ana, foto02;
beforeEach(async () => {
  ({ app, baza } = pripravi());
  ana = await prijavi(app, ANA);
  foto02 = idKosa(baza, 'FOTO-02');
});

const oddaj = (odjemalec, kos, od, datumDo, ostalo = {}) => odjemalec
  .post('/api/rezervacije')
  .send({ kos_id: kos, datum_od: od, datum_do: datumDo, ...ostalo });

const steviloRezervacij = (kos) => baza.prepare('SELECT COUNT(*) FROM rezervacija WHERE kos_id = ?').pluck().get(kos);

// začasna baza v datoteki, po testu pobrisana
async function zDatoteko(test) {
  const mapa = mkdtempSync(join(tmpdir(), 'opremnica-test-'));
  try {
    await test(join(mapa, 'baza.sqlite'));
  } finally {
    rmSync(mapa, { recursive: true });
  }
}

test('AC1: veljavna rezervacija se shrani kot ODDANA in je v Mojih rezervacijah', async () => {
  const odgovor = await oddaj(ana, foto02, '2026-11-13', '2026-11-16', { namen: '  izlet foto sekcije ' });
  assert.equal(odgovor.status, 201);
  assert.equal(odgovor.body.stanje, 'ODDANA');

  const vrstica = baza.prepare('SELECT * FROM rezervacija WHERE id = ?').get(odgovor.body.id);
  assert.equal(vrstica.stanje, 'ODDANA');
  assert.equal(vrstica.clan_id, idUporabnika(baza, ANA));
  assert.equal(vrstica.oddano_ob, '2026-11-11T10:00:00');
  assert.equal(vrstica.odlocil_id, null);

  const moje = (await ana.get('/api/rezervacije/moje')).body;
  assert.deepEqual(moje[0], {
    id: odgovor.body.id,
    datum_od: '2026-11-13',
    datum_do: '2026-11-16',
    namen: 'izlet foto sekcije',
    stanje: 'ODDANA',
    razlog: null,
    oddano_ob: '2026-11-11T10:00:00',
    inventarna_oznaka: 'FOTO-02',
    naziv: 'Fotoaparat, brezzrcalni',
  });

  // že oddana, še neodobrena rezervacija zadrži termin (P5)
  const kosi = (await ana.get('/api/oprema?od=2026-11-16&do=2026-11-18')).body;
  assert.equal(kosi.find((kos) => kos.id === foto02).razpolozljivost, 'ZASEDEN');
});

test('AC1: lastnik je vedno prijavljeni uporabnik, clan_id iz zahteve ne šteje', async () => {
  const odgovor = await oddaj(ana, foto02, '2026-11-13', '2026-11-16', { clan_id: idUporabnika(baza, NIK), stanje: 'ODOBRENA' });
  assert.equal(odgovor.status, 201);

  const vrstica = baza.prepare('SELECT clan_id, stanje FROM rezervacija WHERE id = ?').get(odgovor.body.id);
  assert.deepEqual(vrstica, { clan_id: idUporabnika(baza, ANA), stanje: 'ODDANA' });
});

test('AC1: zase lahko rezervirata tudi skrbnik in administrator', async () => {
  const miha = await prijavi(app, MIHA);
  const petra = await prijavi(app, PETRA);
  assert.equal((await oddaj(miha, foto02, '2026-11-13', '2026-11-14')).status, 201);
  assert.equal((await oddaj(petra, foto02, '2026-11-15', '2026-11-16')).status, 201);
  assert.equal((await miha.get('/api/rezervacije/moje')).body.length, 1);
});

test('Moje rezervacije: samo lastne, z razlogom zavrnitve', async () => {
  const nik = await prijavi(app, NIK);
  const nikove = (await nik.get('/api/rezervacije/moje')).body;
  const anine = (await ana.get('/api/rezervacije/moje')).body;

  assert.deepEqual(nikove.map((r) => r.inventarna_oznaka).sort(), ['FOTO-01', 'FOTO-03', 'KOLO-01', 'PROJ-01']);
  assert.deepEqual(anine.map((r) => r.inventarna_oznaka).sort(), ['KOLO-02', 'SOT-01', 'ZVOK-01']);

  const zavrnjena = nikove.find((r) => r.stanje === 'ZAVRNJENA');
  assert.equal(zavrnjena.razlog, 'Stativ gre ta teden na društveni dogodek.');
  // v odgovoru ni podatkov o drugih ljudeh
  assert.ok(!('clan_id' in zavrnjena) && !('odlocil_id' in zavrnjena));
});

test('AC2 (R1): robni primeri iz docs/05 – obstoječa rezervacija FOTO-02 za 13.–16. 11.', async () => {
  // primeri se začnejo 10. 11., zato je tu "danes" ponedeljek, 9. 11. 2026
  ({ app, baza } = pripravi(':memory:', '2026-11-09'));
  ana = await prijavi(app, ANA);
  foto02 = idKosa(baza, 'FOTO-02');

  const primeri = [
    // nov termin, stanje obstoječe, pričakovano
    ['2026-11-10', '2026-11-12', 'ODOBRENA', 201], // ni skupnega dne
    ['2026-11-10', '2026-11-13', 'ODOBRENA', 409], // 13. 11. je skupni dan
    ['2026-11-16', '2026-11-18', 'ODDANA', 409], // 16. 11. je skupni dan
    ['2026-11-14', '2026-11-15', 'PREVZETA', 409], // v celoti znotraj
    ['2026-11-12', '2026-11-17', 'ODOBRENA', 409], // v celoti okoli
    ['2026-11-17', '2026-11-20', 'ODOBRENA', 201],
    ['2026-11-13', '2026-11-16', 'PREKLICANA', 201], // obstoječa ni aktivna
    ['2026-11-13', '2026-11-16', 'ZAVRNJENA', 201],
    ['2026-11-16', '2026-11-18', 'VRNJENA', 201], // vrnjena ni aktivna (P5)
    ['2026-11-15', '2026-11-18', 'VRNJENA', 201], // predčasno vrnjena, preostali dnevi so prosti
  ];
  for (const [od, datumDo, stanje, pricakovano] of primeri) {
    baza.prepare('DELETE FROM rezervacija WHERE kos_id = ?').run(foto02);
    vstaviRezervacijo(baza, { stanje });

    const odgovor = await oddaj(ana, foto02, od, datumDo);
    const opis = `${od}–${datumDo}, obstoječa ${stanje}`;
    assert.equal(odgovor.status, pricakovano, opis);
    if (pricakovano === 409) assert.deepEqual(odgovor.body, { napaka: ZASEDENO }, opis);
    assert.equal(steviloRezervacij(foto02), pricakovano === 201 ? 2 : 1, opis);
  }
});

test('AC2: tuja rezervacija drugega kosa ne moti', async () => {
  vstaviRezervacijo(baza, { oznaka: 'FOTO-03' });
  assert.equal((await oddaj(ana, foto02, '2026-11-13', '2026-11-16')).status, 201);
});

test('AC3 (P3): začetek v preteklosti se zavrne, današnji dan je v redu', async () => {
  const prej = posnetek(baza);
  const vceraj = await oddaj(ana, foto02, '2026-11-10', '2026-11-12');
  assert.equal(vceraj.status, 400);
  assert.match(vceraj.body.napaka, /v preteklosti/);
  assert.equal(posnetek(baza), prej);

  assert.equal((await oddaj(ana, foto02, '2026-11-11', '2026-11-12')).status, 201);
});

test('AC3 (P2): natanko 14 dni je v redu, 15 dni ne', async () => {
  const prej = posnetek(baza);
  const petnajst = await oddaj(ana, foto02, '2026-11-20', '2026-12-04');
  assert.equal(petnajst.status, 400);
  assert.match(petnajst.body.napaka, /največ 14 dni/);
  assert.equal(posnetek(baza), prej);

  // 20. 11. do 3. 12., oba dneva vključena, je 14 dni
  assert.equal((await oddaj(ana, foto02, '2026-11-20', '2026-12-03')).status, 201);
  // en sam dan je tudi veljaven termin
  assert.equal((await oddaj(ana, foto02, '2026-12-04', '2026-12-04')).status, 201);
});

test('AC3 (P3): začetek čez natanko 60 dni je v redu, čez 61 ne', async () => {
  const prej = posnetek(baza);
  const predalec = await oddaj(ana, foto02, '2027-01-11', '2027-01-12');
  assert.equal(predalec.status, 400);
  assert.match(predalec.body.napaka, /največ 60 dni od danes/);
  assert.equal(posnetek(baza), prej);

  // 11. 11. 2026 + 60 dni = 10. 1. 2027
  assert.equal((await oddaj(ana, foto02, '2027-01-10', '2027-01-12')).status, 201);
});

test('AC3: neveljavni podatki se zavrnejo in nič se ne shrani', async () => {
  const prej = posnetek(baza);
  const slabi = [
    [{ datum_od: '2026-11-13', datum_do: '2026-11-16' }, /Izberi kos/],
    [{ kos_id: 'FOTO-02', datum_od: '2026-11-13', datum_do: '2026-11-16' }, /Izberi kos/],
    [{ kos_id: foto02 }, /veljavna datuma/],
    [{ kos_id: foto02, datum_od: '2026-11-31', datum_do: '2026-12-01' }, /veljavna datuma/],
    [{ kos_id: foto02, datum_od: '13. 11. 2026', datum_do: '16. 11. 2026' }, /veljavna datuma/],
    [{ kos_id: foto02, datum_od: '2026-11-16', datum_do: '2026-11-13' }, /ne sme biti pred/],
    [{ kos_id: foto02, datum_od: '2026-11-13', datum_do: '2026-11-16', namen: 'x'.repeat(201) }, /predolg/],
  ];
  for (const [telo, sporocilo] of slabi) {
    const odgovor = await ana.post('/api/rezervacije').send(telo);
    assert.equal(odgovor.status, 400, JSON.stringify(telo));
    assert.match(odgovor.body.napaka, sporocilo);
  }
  assert.equal(posnetek(baza), prej);
});

test('AC4 (R4): kosa v popravilu ali odpisanega ni mogoče rezervirati', async () => {
  const prej = posnetek(baza);
  for (const oznaka of ['FOTO-04', 'KUH-01']) {
    const odgovor = await oddaj(ana, idKosa(baza, oznaka), '2026-11-13', '2026-11-16');
    assert.equal(odgovor.status, 409, oznaka);
    assert.match(odgovor.body.napaka, /v popravilu ali odpisan/);
  }
  const neobstojec = await oddaj(ana, 9999, '2026-11-13', '2026-11-16');
  assert.equal(neobstojec.status, 404);
  assert.equal(posnetek(baza), prej);
});

test('AC5: od dveh hkratnih oddaj za prekrivajoč se termin uspe samo ena', async () => {
  const nik = await prijavi(app, NIK);
  const odgovora = await Promise.all([
    oddaj(ana, foto02, '2026-11-13', '2026-11-16'),
    oddaj(nik, foto02, '2026-11-16', '2026-11-18'),
  ]);

  assert.deepEqual(odgovora.map((o) => o.status).sort(), [201, 409]);
  assert.deepEqual(odgovora.find((o) => o.status === 409).body, { napaka: ZASEDENO });
  assert.equal(steviloRezervacij(foto02), 1);
});

test('AC5: enako velja za dve povezavi na isto bazo', async () => {
  await zDatoteko(async (pot) => {
    const prva = pripravi(pot);
    const druga = pripravi(pot); // druga povezava in druga aplikacija nad isto datoteko
    const anaTam = await prijavi(prva.app, ANA);
    const nikTam = await prijavi(druga.app, NIK);
    const kos = idKosa(prva.baza, 'FOTO-02');

    const odgovora = await Promise.all([
      oddaj(anaTam, kos, '2026-11-13', '2026-11-16'),
      oddaj(nikTam, kos, '2026-11-13', '2026-11-16'),
    ]);
    assert.deepEqual(odgovora.map((o) => o.status).sort(), [201, 409]);
    assert.equal(prva.baza.prepare('SELECT COUNT(*) FROM rezervacija WHERE kos_id = ?').pluck().get(kos), 1);
    prva.baza.close();
    druga.baza.close();
  });
});

test('T7 trajnost: oddana rezervacija in njeno stanje preživita ponovni zagon', async () => {
  await zDatoteko(async (pot) => {
    const prej = pripravi(pot);
    const oddana = await oddaj(await prijavi(prej.app, ANA), idKosa(prej.baza, 'FOTO-02'), '2026-11-13', '2026-11-16');
    assert.equal(oddana.status, 201);
    prej.baza.close();

    const potem = pripravi(pot); // nova povezava in nova aplikacija, isti podatki
    const moje = (await (await prijavi(potem.app, ANA)).get('/api/rezervacije/moje')).body;
    assert.deepEqual(
      moje.filter((r) => r.id === oddana.body.id).map((r) => [r.inventarna_oznaka, r.datum_od, r.datum_do, r.stanje]),
      [['FOTO-02', '2026-11-13', '2026-11-16', 'ODDANA']],
    );
    potem.baza.close();
  });
});

test('brez prijave oddaja in seznam vrneta 401', async () => {
  assert.equal((await oddaj(request(app), foto02, '2026-11-13', '2026-11-16')).status, 401);
  assert.equal((await request(app).get('/api/rezervacije/moje')).status, 401);
});
