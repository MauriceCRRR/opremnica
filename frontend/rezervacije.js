import { api, el, gumb, lepCas, lepTermin, napolni, obOddaji, pokazi, vrstica, zacni, znacka } from './skupno.js';

await zacni('SKRBNIK');
const napaka = document.querySelector('#napaka');
const okno = document.querySelector('#zavrnitev');
const obrazec = okno.querySelector('form');
let zavracam = null; // rezervacija v odprtem oknu

const kos = (r) => `${r.inventarna_oznaka} · ${r.naziv}`;

// strežnik čakajoče že vrne od najstarejše; tu jih samo razdelimo v tabeli
async function prikazi() {
  const rezervacije = await api('rezervacije');
  napolni(document.querySelector('#cakajoce'), rezervacije.filter((r) => r.stanje === 'ODDANA').map((r) => vrstica(
    lepCas(r.oddano_ob),
    r.clan,
    kos(r),
    lepTermin(r.datum_od, r.datum_do),
    r.namen || '–',
    el('div', { className: 'gumbi' }, gumb('Odobri', () => odobri(r)), gumb('Zavrni', () => odpriZavrnitev(r), 'drugi')),
  )), 'Nobena rezervacija ne čaka na odločitev.');
  napolni(document.querySelector('#ostale'), rezervacije.filter((r) => r.stanje !== 'ODDANA').map((r) => vrstica(
    r.clan,
    kos(r),
    lepTermin(r.datum_od, r.datum_do),
    r.namen || '–',
    znacka(r.stanje),
  )), 'Ni odobrenih ali prevzetih rezervacij.');
}

// Po vsaki odločitvi seznam naložimo znova. Če rezervacija vmes ni več ODDANA
// (npr. član jo je preklical), se pokaže sporočilo strežnika.
async function odobri(r) {
  try {
    await api(`rezervacije/${r.id}/odobritev`, {});
    pokazi(napaka, '');
  } catch (e) {
    pokazi(napaka, e.message);
  }
  await prikazi();
}

function odpriZavrnitev(r) {
  zavracam = r;
  document.querySelector('#zavrnitevClan').textContent = r.clan;
  document.querySelector('#zavrnitevKos').textContent = kos(r);
  document.querySelector('#zavrnitevTermin').textContent = lepTermin(r.datum_od, r.datum_do);
  obrazec.reset();
  pokazi(okno.querySelector('.napaka'), '');
  okno.showModal();
}

obOddaji(obrazec, async () => {
  try {
    await api(`rezervacije/${zavracam.id}/zavrnitev`, { razlog: obrazec.razlog.value });
    pokazi(napaka, '');
    okno.close();
  } catch (e) {
    pokazi(okno.querySelector('.napaka'), e.message);
  }
  await prikazi();
});
okno.querySelector('button.drugi').addEventListener('click', () => okno.close());

prikazi();
