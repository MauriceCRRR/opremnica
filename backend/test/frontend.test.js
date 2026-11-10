// frontend streže isti strežnik kot API
import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { pripravi } from './pomoc.js';

test('prijavna stran in njen slog prideta z istega strežnika', async () => {
  const { app } = pripravi();

  const stran = await request(app).get('/');
  assert.equal(stran.status, 200);
  assert.match(stran.headers['content-type'], /text\/html/);
  assert.match(stran.text, /Prijava/);

  assert.equal((await request(app).get('/slog.css')).status, 200);
  assert.equal((await request(app).get('/skupno.js')).status, 200);
});

test('strani same ne vsebujejo podatkov; ti pridejo šele iz zaščitenega API', async () => {
  const { app } = pripravi();
  for (const pot of ['/oprema.html', '/rezervacije.html', '/uporabniki.html']) {
    const stran = await request(app).get(pot);
    assert.equal(stran.status, 200, pot);
    assert.doesNotMatch(stran.text, /example\.org|FOTO-0/, pot);
  }
});
