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

// termin preveri strežnik; tu samo pokažemo seznam ali njegovo sporočilo
async function prikazi() {
  napaka.hidden = true;
  try {
    const seznam = await api('oprema?' + new URLSearchParams(new FormData(filter)));
    napolni(kosi, seznam.map((kos) => vrstica(
      kos.inventarna_oznaka,
      kos.naziv,
      kos.kategorija,
      znacka(kos.razpolozljivost, RAZPOLOZLJIVOST[kos.razpolozljivost]),
    )), 'V tej kategoriji ni kosov.');
  } catch (e) {
    kosi.replaceChildren();
    napaka.textContent = e.message;
    napaka.hidden = false;
  }
}

filter.addEventListener('submit', (dogodek) => {
  dogodek.preventDefault();
  prikazi();
});
prikazi();
