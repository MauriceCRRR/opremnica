// US-01 Prijava in dostop po vlogi
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { TESTNO_GESLO } from '../src/zacetniPodatki.js';
import { ANA, DANES, MIHA, PETRA, SARA, prijavi, pripravi } from './pomoc.js';

let app, baza;
beforeEach(() => {
  ({ app, baza } = pripravi());
});

test('AC1: aktiven račun se prijavi in izve svojo vlogo', async () => {
  for (const [email, vloga] of [[ANA, 'CLAN'], [MIHA, 'SKRBNIK'], [PETRA, 'ADMIN']]) {
    const odjemalec = request.agent(app);
    const prijava = await odjemalec.post('/api/prijava').send({ email, geslo: TESTNO_GESLO });
    assert.equal(prijava.status, 200);
    assert.equal(prijava.body.vloga, vloga);

    const jaz = await odjemalec.get('/api/jaz');
    assert.equal(jaz.status, 200);
    assert.equal(jaz.body.vloga, vloga);
    assert.equal(jaz.body.danes, DANES);
  }
});

test('AC1: e-naslov ni občutljiv na velike črke in presledke', async () => {
  const odgovor = await request(app).post('/api/prijava').send({ email: '  Ana.Novak@Example.org ', geslo: TESTNO_GESLO });
  assert.equal(odgovor.status, 200);
});

test('AC1: piškotek seje je HttpOnly in SameSite=Lax', async () => {
  const odgovor = await request(app).post('/api/prijava').send({ email: ANA, geslo: TESTNO_GESLO });
  const [piskotek] = odgovor.headers['set-cookie'];
  assert.match(piskotek, /HttpOnly/);
  assert.match(piskotek, /SameSite=Lax/);
});

test('AC2: napačno geslo in neznan e-naslov dobita popolnoma enak odgovor', async () => {
  const napacnoGeslo = await request(app).post('/api/prijava').send({ email: ANA, geslo: 'ni-pravo' });
  const neznanEmail = await request(app).post('/api/prijava').send({ email: 'nihce@example.org', geslo: TESTNO_GESLO });
  const prazno = await request(app).post('/api/prijava').send({});

  for (const odgovor of [napacnoGeslo, neznanEmail, prazno]) {
    assert.equal(odgovor.status, 401);
    assert.deepEqual(odgovor.body, { napaka: 'Napačen e-naslov ali geslo' });
    assert.equal(odgovor.headers['set-cookie'], undefined);
  }
});

test('AC3: deaktiviran račun se ne prijavi niti s pravilnim geslom', async () => {
  const odjemalec = request.agent(app);
  const prijava = await odjemalec.post('/api/prijava').send({ email: SARA, geslo: TESTNO_GESLO });
  assert.equal(prijava.status, 401);
  assert.equal((await odjemalec.get('/api/jaz')).status, 401);

  // z napačnim geslom ne izve niti tega, da je račun deaktiviran
  const ugibanje = await request(app).post('/api/prijava').send({ email: SARA, geslo: 'ni-pravo' });
  assert.deepEqual(ugibanje.body, { napaka: 'Napačen e-naslov ali geslo' });
});

test('AC4: brez prijave vsak zaščiten klic vrne 401', async () => {
  for (const pot of ['/api/jaz', '/api/kategorije', `/api/oprema?od=${DANES}&do=${DANES}`, '/api/rezervacije', '/api/uporabniki']) {
    assert.equal((await request(app).get(pot)).status, 401, pot);
  }
  assert.equal((await request(app).post('/api/odjava')).status, 401);
});

test('AC5: po odjavi seja ne velja več', async () => {
  const ana = await prijavi(app, ANA);
  assert.equal((await ana.get('/api/jaz')).status, 200);

  assert.equal((await ana.post('/api/odjava')).status, 200);
  assert.equal((await ana.get('/api/jaz')).status, 401);
});

test('AC5: star piškotek po odjavi ne deluje več', async () => {
  const prijava = await request(app).post('/api/prijava').send({ email: ANA, geslo: TESTNO_GESLO });
  const piskotek = prijava.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request(app).get('/api/jaz').set('Cookie', piskotek)).status, 200);

  await request(app).post('/api/odjava').set('Cookie', piskotek).expect(200);
  assert.equal((await request(app).get('/api/jaz').set('Cookie', piskotek)).status, 401);
});

test('vloge: skrbnikov seznam je samo za skrbnika, uporabniki samo za administratorja', async () => {
  const pricakovano = [
    // kdo, /api/rezervacije, /api/uporabniki
    [ANA, 403, 403],
    [MIHA, 200, 403],
    [PETRA, 403, 200],
  ];
  for (const [email, rezervacije, uporabniki] of pricakovano) {
    const odjemalec = await prijavi(app, email);
    assert.equal((await odjemalec.get('/api/rezervacije')).status, rezervacije, email);
    assert.equal((await odjemalec.get('/api/uporabniki')).status, uporabniki, email);
    // katalog vidijo vse tri vloge
    assert.equal((await odjemalec.get(`/api/oprema?od=${DANES}&do=${DANES}`)).status, 200, email);
  }
});

test('deaktivacija prime takoj, brez nove prijave', async () => {
  const ana = await prijavi(app, ANA);
  baza.prepare('UPDATE uporabnik SET aktiven = 0 WHERE email = ?').run(ANA);
  assert.equal((await ana.get('/api/jaz')).status, 401);
});

test('sprememba vloge prime takoj, brez nove prijave', async () => {
  const miha = await prijavi(app, MIHA);
  assert.equal((await miha.get('/api/rezervacije')).status, 200);

  baza.prepare("UPDATE uporabnik SET vloga = 'CLAN' WHERE email = ?").run(MIHA);
  assert.equal((await miha.get('/api/rezervacije')).status, 403);
});

test('gesla so v bazi zgoščena, vsako s svojo soljo, in ne gredo iz API', async () => {
  const zgoscena = baza.prepare('SELECT geslo_hash FROM uporabnik').pluck().all();
  for (const vrednost of zgoscena) {
    assert.match(vrednost, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  }
  // vsi imajo isto testno geslo, zapisi pa so zaradi soli različni
  assert.equal(new Set(zgoscena).size, zgoscena.length);

  const petra = await prijavi(app, PETRA);
  const uporabniki = (await petra.get('/api/uporabniki')).body;
  assert.equal(uporabniki.length, 5);
  assert.deepEqual(Object.keys(uporabniki[0]).sort(), ['aktiven', 'email', 'id', 'ime', 'priimek', 'vloga']);
});

test('neznana pot API vrne 404, pokvarjen JSON pa 400', async () => {
  const ana = await prijavi(app, ANA);
  assert.equal((await ana.get('/api/tega-ni')).status, 404);

  const pokvarjeno = await request(app).post('/api/prijava').set('Content-Type', 'application/json').send('{"email":');
  assert.equal(pokvarjeno.status, 400);
});
