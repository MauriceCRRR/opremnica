import { api, napolni, vrstica, zacni, znacka } from './skupno.js';

const VLOGE = { CLAN: 'Član', SKRBNIK: 'Skrbnik', ADMIN: 'Administrator' };

await zacni('ADMIN');

const uporabniki = await api('uporabniki');
napolni(document.querySelector('#uporabniki'), uporabniki.map((u) => vrstica(
  `${u.ime} ${u.priimek}`,
  u.email,
  VLOGE[u.vloga],
  u.aktiven ? znacka('aktiven') : znacka('neaktiven'),
)), 'Ni uporabnikov.');
