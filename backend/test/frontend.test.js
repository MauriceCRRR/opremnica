// frontend streže isti strežnik kot API
import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { pripravi } from './pomoc.js';

test('prijavna stran, slog in pisava pridejo z istega strežnika', async () => {
  const { app } = pripravi();

  const stran = await request(app).get('/');
  assert.equal(stran.status, 200);
  assert.match(stran.headers['content-type'], /text\/html/);
  assert.match(stran.text, /Prijava/);
  assert.equal((await request(app).get('/skupno.js')).status, 200);

  // slog ne kliče zunanjih strežnikov; pisava je lokalna, z licenco zraven
  const slog = await request(app).get('/slog.css');
  assert.equal(slog.status, 200);
  assert.doesNotMatch(slog.text, /@import|url\(\s*['"]?(https?:)?\/\//);
  for (const datoteka of slog.text.match(/fonts\/[\w.-]+\.woff2/g)) {
    const pisava = await request(app).get('/' + datoteka);
    assert.equal(pisava.status, 200, datoteka);
    assert.equal(pisava.headers['content-type'], 'font/woff2');
  }
  assert.match((await request(app).get('/fonts/OFL.txt')).text, /SIL Open Font License/i);
});

test('strani same ne vsebujejo podatkov; ti pridejo šele iz zaščitenega API', async () => {
  const { app } = pripravi();
  for (const pot of ['/oprema.html', '/moje.html', '/rezervacije.html', '/uporabniki.html']) {
    const stran = await request(app).get(pot);
    assert.equal(stran.status, 200, pot);
    assert.doesNotMatch(stran.text, /example\.org|FOTO-0/, pot);
  }
});
