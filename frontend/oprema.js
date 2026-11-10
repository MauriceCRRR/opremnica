import { api, el, napolni, vrstica, zacni, znacka } from './skupno.js';

const RAZPOLOZLJIVOST = { PROST: 'Prost', ZASEDEN: 'Zaseden v terminu', V_POPRAVILU: 'V popravilu' };

const jaz = await zacni();
const filter = document.querySelector('#filter');
const napaka = document.querySelector('#napaka');
const kosi = document.querySelector('#kosi');

for (const kategorija of await api('kategorije')) {
  filter.kategorija.append(el('option', { value: kategorija.id }, kategorija.ime));
}
filter.od.value = filter.do.value = jaz.danes;

let zadnja = 0; // številka zadnje poizvedbe

// termin preveri strežnik; tu samo pokažemo seznam ali njegovo sporočilo
async function prikazi() {
  const moja = ++zadnja;
  let seznam = [];
  let sporocilo = '';
  try {
    seznam = await api('oprema?' + new URLSearchParams(new FormData(filter)));
  } catch (e) {
    sporocilo = e.message;
  }
  // vmes je šla že novejša poizvedba: ta odgovor (ali napaka) je zastarel in ne sme ničesar prepisati
  if (moja !== zadnja) return;

  napaka.textContent = sporocilo;
  napaka.hidden = !sporocilo;
  if (sporocilo) {
    kosi.replaceChildren();
    return;
  }
  napolni(kosi, seznam.map((kos) => vrstica(
    kos.inventarna_oznaka,
    kos.naziv,
    kos.kategorija,
    znacka(kos.razpolozljivost, RAZPOLOZLJIVOST[kos.razpolozljivost]),
  )), 'V tej kategoriji ni kosov.');
}

filter.addEventListener('submit', (dogodek) => {
  dogodek.preventDefault();
  prikazi();
});
prikazi();
