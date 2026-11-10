// US-04 Odobritev ali zavrnitev rezervacije
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { ANA, MIHA, NIK, PETRA, idKosa, idRezervacije, idUporabnika, posnetek, prijavi, pripravi, stanjeRezervacije, vstaviRezervacijo } from './pomoc.js';

const NI_VEC_ODDANA = 'Rezervacija ni več v stanju ODDANA';

let app, baza, miha, ana, cakajoca;
beforeEach(async () => {
  ({ app, baza } = pripravi());
  miha = await prijavi(app, MIHA);
  ana = await prijavi(app, ANA);
  cakajoca = idRezervacije(baza, 'SOT-01'); // Anina ODDANA za 20.–22. 11.
});

const odobri = (odjemalec, id) => odjemalec.post(`/api/rezervacije/${id}/odobritev`);
const zavrni = (odjemalec, id, razlog) => odjemalec.post(`/api/rezervacije/${id}/zavrnitev`).send({ razlog });
const vrstica = (id) => baza.prepare('SELECT * FROM rezervacija WHERE id = ?').get(id);

test('AC1: čakajoče so razvrščene po času oddaje od najstarejše, s članom, kosom in terminom', async () => {
  // oddana najprej, vpisana zadnja: vrstni red mora slediti času, ne številki
  vstaviRezervacijo(baza, { oznaka: 'FOTO-02', stanje: 'ODDANA', oddano: '2026-11-09T07:00:00' });
  // in ena čisto nova, oddana "zdaj" (11. 11. ob 10:00)
  await ana.post('/api/rezervacije').send({ kos_id: idKosa(baza, 'SOT-02'), datum_od: '2026-11-20', datum_do: '2026-11-21' }).expect(201);

  const cakajoce = (await miha.get('/api/rezervacije')).body.filter((r) => r.stanje === 'ODDANA');
  assert.deepEqual(cakajoce.map((r) => [r.oddano_ob, r.inventarna_oznaka]), [
    ['2026-11-09T07:00:00', 'FOTO-02'],
    ['2026-11-10T18:05:00', 'SOT-01'],
    ['2026-11-11T08:40:00', 'PROJ-01'],
    ['2026-11-11T10:00:00', 'SOT-02'],
  ]);
  assert.deepEqual(cakajoce[1], {
    id: cakajoca,
    datum_od: '2026-11-20',
    datum_do: '2026-11-22',
    namen: 'jesenski tabor',
    stanje: 'ODDANA',
    oddano_ob: '2026-11-10T18:05:00',
    clan: 'Ana Novak',
    inventarna_oznaka: 'SOT-01',
    naziv: 'Šotor za 4 osebe',
    stanje_kosa: 'UPORABEN',
    za_prevzem: false,
    zamuda: 0,
  });
});

test('AC2: odobritev spremeni stanje ter zapiše skrbnika in čas', async () => {
  const odgovor = await odobri(miha, cakajoca);
  assert.equal(odgovor.status, 200);

  const r = vrstica(cakajoca);
  assert.equal(r.stanje, 'ODOBRENA');
  assert.equal(r.odlocil_id, idUporabnika(baza, MIHA));
  assert.equal(r.odloceno_ob, '2026-11-11T10:00:00');
  assert.equal(r.razlog, null);

  // odobrena še naprej zaseda termin, članica vidi novo stanje
  const kosi = (await ana.get('/api/oprema?od=2026-11-22&do=2026-11-23')).body;
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'SOT-01').razpolozljivost, 'ZASEDEN');
  const moje = (await ana.get('/api/rezervacije/moje')).body;
  assert.equal(moje.find((m) => m.id === cakajoca).stanje, 'ODOBRENA');
});

test('AC3: zavrnitev brez razloga ni mogoča', async () => {
  const prej = posnetek(baza);
  for (const razlog of [undefined, '', '   ', 'x'.repeat(301)]) {
    assert.equal((await zavrni(miha, cakajoca, razlog)).status, 400, JSON.stringify(razlog));
  }
  assert.equal((await miha.post(`/api/rezervacije/${cakajoca}/zavrnitev`)).status, 400); // brez telesa
  assert.equal(posnetek(baza), prej);
});

test('AC3: zavrnitev z razlogom; član razlog vidi in termin je spet prost', async () => {
  const odgovor = await zavrni(miha, cakajoca, '  Šotor gre na servis. ');
  assert.equal(odgovor.status, 200);

  const r = vrstica(cakajoca);
  assert.equal(r.stanje, 'ZAVRNJENA');
  assert.equal(r.razlog, 'Šotor gre na servis.');
  assert.equal(r.odlocil_id, idUporabnika(baza, MIHA));
  assert.equal(r.odloceno_ob, '2026-11-11T10:00:00');

  const moje = (await ana.get('/api/rezervacije/moje')).body;
  assert.deepEqual(
    moje.filter((m) => m.id === cakajoca).map((m) => [m.stanje, m.razlog]),
    [['ZAVRNJENA', 'Šotor gre na servis.']],
  );

  const kosi = (await ana.get('/api/oprema?od=2026-11-20&do=2026-11-22')).body;
  assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'SOT-01').razpolozljivost, 'PROST');
  const nik = await prijavi(app, NIK);
  const nova = await nik.post('/api/rezervacije').send({ kos_id: idKosa(baza, 'SOT-01'), datum_od: '2026-11-20', datum_do: '2026-11-22' });
  assert.equal(nova.status, 201);
});

test('AC4 (R2): če je član vmes preklical, odobritev in zavrnitev ne spremenita ničesar', async () => {
  await ana.post(`/api/rezervacije/${cakajoca}/preklic`).expect(200);
  const prej = posnetek(baza);

  for (const odgovor of [await odobri(miha, cakajoca), await zavrni(miha, cakajoca, 'prepozno')]) {
    assert.equal(odgovor.status, 409);
    assert.deepEqual(odgovor.body, { napaka: NI_VEC_ODDANA });
  }
  assert.equal(stanjeRezervacije(baza, cakajoca), 'PREKLICANA');
  assert.equal(posnetek(baza), prej);
});

test('AC4 (R2): ponovljena odločitev ne spremeni prve', async () => {
  await odobri(miha, cakajoca).expect(200);
  const poOdobritvi = posnetek(baza);

  // dvojna odobritev in zavrnitev že odobrene
  assert.deepEqual((await odobri(miha, cakajoca)).body, { napaka: NI_VEC_ODDANA });
  assert.equal((await zavrni(miha, cakajoca, 'premislil sem si')).status, 409);
  assert.equal(posnetek(baza), poOdobritvi);

  // T2: odobritev zavrnjene rezervacije
  const zavrnjena = idRezervacije(baza, 'FOTO-03');
  assert.equal((await odobri(miha, zavrnjena)).status, 409);
  assert.equal(stanjeRezervacije(baza, zavrnjena), 'ZAVRNJENA');
  // prevzeta in vrnjena prav tako nista več ODDANA
  for (const oznaka of ['KOLO-01', 'KOLO-02']) {
    assert.equal((await odobri(miha, idRezervacije(baza, oznaka))).status, 409, oznaka);
  }
  assert.equal(posnetek(baza), poOdobritvi);
});

test('AC4: od dveh hkratnih odločitev obvelja samo ena', async () => {
  const odgovora = await Promise.all([odobri(miha, cakajoca), zavrni(miha, cakajoca, 'ni na voljo')]);
  assert.deepEqual(odgovora.map((o) => o.status).sort(), [200, 409]);

  const r = vrstica(cakajoca);
  const zmagala = odgovora.find((o) => o.status === 200).body.stanje;
  assert.equal(r.stanje, zmagala);
  assert.equal(r.razlog, zmagala === 'ZAVRNJENA' ? 'ni na voljo' : null);
});

test('AC5 (R3): član in administrator dobita 403, stanje ostane ODDANA', async () => {
  const prej = posnetek(baza);
  for (const email of [ANA, NIK, PETRA]) {
    const odjemalec = await prijavi(app, email);
    assert.equal((await odobri(odjemalec, cakajoca)).status, 403, email);
    assert.equal((await zavrni(odjemalec, cakajoca, 'razlog')).status, 403, email);
  }
  assert.equal((await odobri(request(app), cakajoca)).status, 401);
  assert.equal((await zavrni(request(app), cakajoca, 'razlog')).status, 401);

  assert.equal(stanjeRezervacije(baza, cakajoca), 'ODDANA');
  assert.equal(posnetek(baza), prej);
});

test('neobstoječa ali neveljavna številka rezervacije vrne 404', async () => {
  const prej = posnetek(baza);
  for (const id of [9999, 'abc', '1e1', '0']) {
    assert.equal((await odobri(miha, id)).status, 404, String(id));
    assert.equal((await zavrni(miha, id, 'razlog')).status, 404, String(id));
  }
  assert.equal(posnetek(baza), prej);
});

test('P7: skrbnik lahko odloči tudi o svoji rezervaciji; zapisano je, kdo je odločil', async () => {
  const oddana = await miha.post('/api/rezervacije').send({ kos_id: idKosa(baza, 'FOTO-02'), datum_od: '2026-11-13', datum_do: '2026-11-16' });
  await odobri(miha, oddana.body.id).expect(200);

  const r = vrstica(oddana.body.id);
  assert.equal(r.stanje, 'ODOBRENA');
  assert.equal(r.clan_id, r.odlocil_id);
});
