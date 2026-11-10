// baza, začetni podatki in trajnost
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ustvariApp } from '../src/app.js';
import { AKTIVNA, odpriBazo } from '../src/baza.js';
import { vpisiZacetnePodatke } from '../src/zacetniPodatki.js';
import { ANA, DANES, prijavi, pripravi } from './pomoc.js';

test('začetni podatki: vse tri vloge, deaktiviran račun, več kategorij in kosov', () => {
  const { baza } = pripravi();
  const stej = (sql) => baza.prepare(sql).pluck().get();

  for (const vloga of ['CLAN', 'SKRBNIK', 'ADMIN']) {
    assert.ok(stej(`SELECT COUNT(*) FROM uporabnik WHERE aktiven = 1 AND vloga = '${vloga}'`) >= 1, vloga);
  }
  assert.equal(stej('SELECT COUNT(*) FROM uporabnik WHERE aktiven = 0'), 1);
  assert.equal(stej('SELECT COUNT(*) FROM kategorija'), 4);
  assert.equal(stej('SELECT COUNT(*) FROM kos_opreme'), 11);
  for (const stanje of ['UPORABEN', 'V_POPRAVILU', 'ODPISAN']) {
    assert.ok(stej(`SELECT COUNT(*) FROM kos_opreme WHERE stanje_kosa = '${stanje}'`) >= 1, stanje);
  }
});

test('začetni podatki sami ne kršijo pravila o prekrivanju', () => {
  const { baza } = pripravi();
  const prekrivanja = baza.prepare(`
    SELECT COUNT(*) FROM rezervacija a JOIN rezervacija b
      ON a.kos_id = b.kos_id AND a.id < b.id
     AND a.datum_od <= b.datum_do AND b.datum_od <= a.datum_do
    WHERE a.stanje IN ${AKTIVNA} AND b.stanje IN ${AKTIVNA}
  `).pluck().get();
  assert.equal(prekrivanja, 0);
});

test('seed polne baze ne spreminja, razen z izrecno ponastavitvijo', () => {
  const { baza } = pripravi();
  const imeAne = () => baza.prepare('SELECT ime FROM uporabnik WHERE email = ?').pluck().get(ANA);
  baza.prepare("UPDATE uporabnik SET ime = 'Anja' WHERE email = ?").run(ANA);

  assert.equal(vpisiZacetnePodatke(baza, DANES), false);
  assert.equal(imeAne(), 'Anja');

  assert.equal(vpisiZacetnePodatke(baza, DANES, true), true);
  assert.equal(imeAne(), 'Ana');
  assert.equal(baza.prepare('SELECT COUNT(*) FROM uporabnik').pluck().get(), 5);
});

test('baza sama zavrne datum do pred datumom od in neznano stanje', () => {
  const { baza } = pripravi();
  const vstavi = (od, datumDo, stanje) => baza.prepare(`
    INSERT INTO rezervacija (clan_id, kos_id, datum_od, datum_do, stanje, oddano_ob)
    VALUES (1, 1, ?, ?, ?, '2026-11-11T10:00:00')
  `).run(od, datumDo, stanje);

  assert.throws(() => vstavi('2026-11-16', '2026-11-13', 'ODDANA'), /CHECK/);
  assert.throws(() => vstavi('2026-11-13', '2026-11-16', 'NEKAJ'), /CHECK/);
  // tuji ključi so vklopljeni
  assert.throws(() => baza.prepare("INSERT INTO kos_opreme (kategorija_id, inventarna_oznaka, naziv) VALUES (999, 'X-01', 'x')").run(), /FOREIGN KEY/);
});

test('trajnost: podatki v datoteki preživijo ponovni zagon', async () => {
  const mapa = mkdtempSync(join(tmpdir(), 'opremnica-test-'));
  const pot = join(mapa, 'baza.sqlite');
  try {
    const prva = pripravi(pot);
    prva.baza.prepare("UPDATE kos_opreme SET stanje_kosa = 'V_POPRAVILU' WHERE inventarna_oznaka = 'FOTO-02'").run();
    prva.baza.close();

    // "ponovni zagon": nova povezava na isto datoteko in nova aplikacija
    const baza = odpriBazo(pot);
    const app = ustvariApp({ baza, skrivnost: 'samo-za-teste', zdaj: () => new Date('2026-11-11T10:00:00+01:00') });
    const ana = await prijavi(app, ANA);
    const kosi = (await ana.get('/api/oprema?od=2026-11-13&do=2026-11-16')).body;
    assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'FOTO-02').razpolozljivost, 'V_POPRAVILU');
    assert.equal(kosi.find((kos) => kos.inventarna_oznaka === 'FOTO-01').razpolozljivost, 'ZASEDEN');
    baza.close();
  } finally {
    rmSync(mapa, { recursive: true });
  }
});
