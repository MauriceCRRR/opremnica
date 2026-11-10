import { api, lepDatum, napolni, vrstica, zacni, znacka } from './skupno.js';

await zacni('SKRBNIK');

const rezervacije = await api('rezervacije');
napolni(document.querySelector('#rezervacije'), rezervacije.map((r) => vrstica(
  r.clan,
  `${r.inventarna_oznaka} · ${r.naziv}`,
  `${lepDatum(r.datum_od)} – ${lepDatum(r.datum_do)}`,
  r.namen || '–',
  znacka(r.stanje),
)), 'Ni aktivnih rezervacij.');
