import request from 'supertest';
import { ustvariApp } from '../src/app.js';
import { odpriBazo } from '../src/baza.js';
import { vpisiZacetnePodatke, TESTNO_GESLO } from '../src/zacetniPodatki.js';

// "danes" v testih je vedno sreda, 11. 11. 2026 (kot v scenariju v docs/01)
export const DANES = '2026-11-11';
const URA = () => new Date('2026-11-11T10:00:00+01:00');

export const ANA = 'ana.novak@example.org'; // članica
export const MIHA = 'miha.kos@example.org'; // skrbnik
export const PETRA = 'petra.vidmar@example.org'; // administratorka
export const SARA = 'sara.petek@example.org'; // deaktivirana

// sveža baza v pomnilniku z začetnimi podatki in aplikacija nad njo
export function pripravi(pot = ':memory:') {
  const baza = odpriBazo(pot);
  vpisiZacetnePodatke(baza, DANES);
  return { baza, app: ustvariApp({ baza, skrivnost: 'samo-za-teste', zdaj: URA }) };
}

// odjemalec, ki si zapomni piškotek seje
export async function prijavi(app, email) {
  const odjemalec = request.agent(app);
  await odjemalec.post('/api/prijava').send({ email, geslo: TESTNO_GESLO }).expect(200);
  return odjemalec;
}
