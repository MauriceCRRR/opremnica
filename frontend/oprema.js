import { api, el, gumb, lepTermin, napolni, obOddaji, pokazi, vrstica, zacni, znacka } from './skupno.js';

const RAZPOLOZLJIVOST = { PROST: 'Prost', ZASEDEN: 'Zaseden v terminu', V_POPRAVILU: 'V popravilu' };

const jaz = await zacni();
const filter = document.querySelector('#filter');
const napaka = document.querySelector('#napaka');
const uspeh = document.querySelector('#uspeh');
const prikazano = document.querySelector('#prikazano');
const kosi = document.querySelector('#kosi');
const okno = document.querySelector('#rezervacija');
const obrazec = okno.querySelector('form');
const izbranKos = document.querySelector('#izbranKos');
const izbranTermin = document.querySelector('#izbranTermin');

for (const kategorija of await api('kategorije')) {
  filter.kategorija.append(el('option', { value: kategorija.id }, kategorija.ime));
}
filter.od.value = filter.do.value = jaz.danes;

let zadnja = 0; // številka zadnje poizvedbe
let izbira = null; // kos in termin v odprtem oknu

// koliko traja termin, oba dneva vključena
function trajanje(od, datumDo) {
  const n = (Date.parse(datumDo) - Date.parse(od)) / 86400000 + 1;
  if (n === 1) return '1 dan';
  return n === 2 ? '2 dneva' : `${n} dni`;
}

// Okno dobi termin, za katerega je bil seznam izračunan, ne tistega, ki je ta hip v filtru.
function odpri(kos, od, datumDo) {
  izbira = { kos_id: kos.id, datum_od: od, datum_do: datumDo };
  izbranKos.textContent = `${kos.inventarna_oznaka} · ${kos.naziv}`;
  izbranTermin.textContent = `${lepTermin(od, datumDo)} (${trajanje(od, datumDo)})`;
  obrazec.reset();
  pokazi(okno.querySelector('.napaka'), '');
  uspeh.hidden = true;
  okno.showModal();
}

// termin preveri strežnik; tu samo pokažemo seznam ali njegovo sporočilo
async function prikazi() {
  const moja = ++zadnja;
  const poizvedba = new URLSearchParams(new FormData(filter));
  const od = poizvedba.get('od');
  const datumDo = poizvedba.get('do');
  let seznam = [];
  let sporocilo = '';
  try {
    seznam = await api('oprema?' + poizvedba);
  } catch (e) {
    sporocilo = e.message;
  }
  // vmes je šla že novejša poizvedba: ta odgovor (ali napaka) je zastarel in ne sme ničesar prepisati
  if (moja !== zadnja) return;

  pokazi(napaka, sporocilo);
  if (sporocilo) {
    prikazano.textContent = '';
    kosi.replaceChildren();
    return;
  }
  prikazano.textContent = `Razpoložljivost za termin ${lepTermin(od, datumDo)}`;
  napolni(kosi, seznam.map((kos) => vrstica(
    kos.inventarna_oznaka,
    kos.naziv,
    kos.kategorija,
    znacka(kos.razpolozljivost, RAZPOLOZLJIVOST[kos.razpolozljivost]),
    // gumb samo pri prostem kosu; rezervira termin tega seznama
    kos.razpolozljivost === 'PROST' ? gumb('Rezerviraj', () => odpri(kos, od, datumDo), 'drugi') : '–',
  )), 'V tej kategoriji ni kosov.');
}

obOddaji(obrazec, async () => {
  try {
    await api('rezervacije', { ...izbira, namen: obrazec.namen.value });
    okno.close();
    document.querySelector('#oddano').textContent = `${izbranKos.textContent}, ${izbranTermin.textContent}`;
    uspeh.hidden = false;
  } catch (e) {
    pokazi(okno.querySelector('.napaka'), `${e.message}. Rezervacija ni shranjena.`);
  }
  prikazi(); // razpoložljivost se je lahko spremenila
});
okno.querySelector('button.drugi').addEventListener('click', () => okno.close());

// seznam vedno sledi filtru: nov izračun ob vsaki spremembi in ob gumbu Prikaži
filter.addEventListener('change', prikazi);
filter.addEventListener('submit', (dogodek) => {
  dogodek.preventDefault();
  prikazi();
});
prikazi();
