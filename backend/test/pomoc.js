import request from 'supertest';
import { ustvariApp } from '../src/app.js';
import { odpriBazo } from '../src/baza.js';
import { vpisiZacetnePodatke, TESTNO_GESLO } from '../src/zacetniPodatki.js';

// "danes" v testih je sreda, 11. 11. 2026 (kot v scenariju v docs/01), če test ne reče drugače
export const DANES = '2026-11-11';

export const ANA = 'ana.novak@example.org'; // članica
export const NIK = 'nik.zupan@example.org'; // član
export const MIHA = 'miha.kos@example.org'; // skrbnik
export const PETRA = 'petra.vidmar@example.org'; // administratorka
export const SARA = 'sara.petek@example.org'; // deaktivirana

// Baza z začetnimi podatki in aplikacija nad njo; ura stoji na izbranem dnevu ob 10:00.
// Če datoteka že ima podatke, jih pusti; tako isti klic odigra tudi ponovni zagon.
export function pripravi(pot = ':memory:', dan = DANES) {
  const baza = odpriBazo(pot);
  vpisiZacetnePodatke(baza, dan);
  const zdaj = () => new Date(dan + 'T10:00:00+01:00');
  return { baza, app: ustvariApp({ baza, skrivnost: 'samo-za-teste', zdaj }) };
}

// odjemalec, ki si zapomni piškotek seje
export async function prijavi(app, email) {
  const odjemalec = request.agent(app);
  await odjemalec.post('/api/prijava').send({ email, geslo: TESTNO_GESLO }).expect(200);
  return odjemalec;
}

export function idKosa(baza, oznaka) {
  return baza.prepare('SELECT id FROM kos_opreme WHERE inventarna_oznaka = ?').pluck().get(oznaka);
}

export function idUporabnika(baza, email) {
  return baza.prepare('SELECT id FROM uporabnik WHERE email = ?').pluck().get(email);
}

// rezervacija kosa iz začetnih podatkov (tam ima vsak kos največ eno)
export function idRezervacije(baza, oznaka) {
  return baza.prepare('SELECT id FROM rezervacija WHERE kos_id = ?').pluck().get(idKosa(baza, oznaka));
}

export function stanjeRezervacije(baza, id) {
  return baza.prepare('SELECT stanje FROM rezervacija WHERE id = ?').pluck().get(id);
}

// rezervacijo vpiše naravnost v bazo, mimo pravil; privzeto Nikova za FOTO-02, 13.–16. 11.
export function vstaviRezervacijo(baza, { oznaka = 'FOTO-02', email = NIK, od = '2026-11-13', datumDo = '2026-11-16', stanje = 'ODOBRENA', oddano = '2026-11-10T12:00:00' } = {}) {
  return Number(baza.prepare(`
    INSERT INTO rezervacija (clan_id, kos_id, datum_od, datum_do, stanje, oddano_ob)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(idUporabnika(baza, email), idKosa(baza, oznaka), od, datumDo, stanje, oddano).lastInsertRowid);
}

// vse rezervacije kot besedilo, za primerjavo "pri napaki se v bazi ni nič spremenilo"
export function posnetek(baza) {
  return JSON.stringify(baza.prepare('SELECT * FROM rezervacija ORDER BY id').all());
}
