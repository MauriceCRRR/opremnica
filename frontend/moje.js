import { api, dni, gumb, lepTermin, napolni, obOddaji, pokazi, vrstica, zacni, znacka } from './skupno.js';

await zacni();
const napaka = document.querySelector('#napaka');
const okno = document.querySelector('#preklic');
let preklicujem = null; // rezervacija v odprtem oknu

const kos = (r) => `${r.inventarna_oznaka} · ${r.naziv}`;

// razlog zavrnitve ali preklica, sicer morebitna zamuda pri vračilu
function opomba(r) {
  if (r.razlog) return r.razlog;
  if (!r.zamuda) return '–';
  return r.stanje === 'PREVZETA' ? `Vračilo zamuja ${dni(r.zamuda)}` : `Vrnjeno z zamudo ${dni(r.zamuda)}`;
}

function odpri(r) {
  preklicujem = r;
  document.querySelector('#preklicKos').textContent = kos(r);
  document.querySelector('#preklicTermin').textContent = lepTermin(r.datum_od, r.datum_do);
  okno.showModal();
}

async function prikazi() {
  const rezervacije = await api('rezervacije/moje');
  napolni(document.querySelector('#rezervacije'), rezervacije.map((r) => vrstica(
    kos(r),
    lepTermin(r.datum_od, r.datum_do),
    r.namen || '–',
    znacka(r.stanje),
    opomba(r),
    // preklic samo pred prevzemom
    r.stanje === 'ODDANA' || r.stanje === 'ODOBRENA' ? gumb('Prekliči', () => odpri(r), 'drugi') : '–',
  )), 'Nimaš še nobene rezervacije.');
}

obOddaji(okno.querySelector('form'), async () => {
  try {
    await api(`rezervacije/${preklicujem.id}/preklic`, {});
    pokazi(napaka, '');
  } catch (e) {
    pokazi(napaka, e.message); // npr. skrbnik je vmes že evidentiral prevzem
  }
  okno.close();
  await prikazi();
});
okno.querySelector('button.drugi').addEventListener('click', () => okno.close());

prikazi();
