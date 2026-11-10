import { api, dni, el, gumb, lepCas, lepDatum, lepTermin, napolni, obOddaji, pokazi, vrstica, zacni, znacka } from './skupno.js';

// zavrnitev oddane in preklic odobrene rezervacije se razlikujeta samo v napisih in poti
const Z_RAZLOGOM = {
  zavrnitev: { naslov: 'Zavrnitev rezervacije', potrdi: 'Potrdi zavrnitev', uspeh: 'Rezervacija je zavrnjena.' },
  preklic: { naslov: 'Preklic rezervacije', potrdi: 'Potrdi preklic', uspeh: 'Rezervacija je preklicana.' },
};

const jaz = await zacni('SKRBNIK');
const $ = (izbirnik) => document.querySelector(izbirnik);
const oknoRazlog = $('#razlog');
const oknoVracilo = $('#vracilo');
const obrazecRazlog = oknoRazlog.querySelector('form');
const obrazecVracilo = oknoVracilo.querySelector('form');

let izbrana = null; // rezervacija v odprtem oknu
let dejanje = null; // 'zavrnitev' ali 'preklic'
const prizadete = []; // številke rezervacij kosov, ki so šli ob vračilu v popravilo

const danVTednu = new Intl.DateTimeFormat('sl', { weekday: 'long', timeZone: 'UTC' }).format(new Date(jaz.danes));
$('#danes').textContent = `Danes je ${danVTednu}, ${lepDatum(jaz.danes)}.`;

const imeKosa = (r) => `${r.inventarna_oznaka} · ${r.naziv}`;
const termin = (r) => lepTermin(r.datum_od, r.datum_do);

// pri kosu v popravilu to piše zraven: take rezervacije ni več mogoče izpeljati
function kos(r) {
  if (r.stanje_kosa !== 'V_POPRAVILU') return imeKosa(r);
  return el('span', {}, imeKosa(r), ' ', znacka('v_popravilu', 'kos v popravilu'));
}

function sporoci(dobro, slabo = '') {
  pokazi($('#uspeh'), dobro);
  pokazi($('#napaka'), slabo);
}

// Dejanje brez dodatnih podatkov (odobritev, prevzem). Če ni več mogoče, pove strežnik;
// seznam se v vsakem primeru naloži znova.
async function izvedi(r, pot, uspeh) {
  try {
    await api(`rezervacije/${r.id}/${pot}`, {});
    sporoci(uspeh);
  } catch (e) {
    sporoci('', e.message);
  }
  await prikazi();
}

const zRazlogom = (r, vrsta, napis) => gumb(napis, () => odpriRazlog(r, vrsta), 'drugi');
const skupaj = (...gumbi) => el('div', { className: 'gumbi' }, ...gumbi);

// strežnik sezname že uredi in označi, kaj je za prevzem in koliko je zamude; tu jih samo razdelimo
async function prikazi() {
  const rezervacije = await api('rezervacije');

  napolni($('#cakajoce'), rezervacije.filter((r) => r.stanje === 'ODDANA').map((r) => vrstica(
    lepCas(r.oddano_ob),
    r.clan,
    kos(r),
    termin(r),
    r.namen || '–',
    skupaj(gumb('Odobri', () => izvedi(r, 'odobritev', 'Rezervacija je odobrena.')), zRazlogom(r, 'zavrnitev', 'Zavrni')),
  )), 'Nobena rezervacija ne čaka na odločitev.');

  napolni($('#zaPrevzem'), rezervacije.filter((r) => r.za_prevzem).map((r) => vrstica(
    r.clan,
    kos(r),
    termin(r),
    r.namen || '–',
    skupaj(gumb('Evidentiraj prevzem', () => izvedi(r, 'prevzem', 'Prevzem je evidentiran.')), zRazlogom(r, 'preklic', 'Prekliči')),
  )), 'Nič ne čaka na prevzem.');

  napolni($('#izposojeno'), rezervacije.filter((r) => r.stanje === 'PREVZETA').map((r) => vrstica(
    r.clan,
    kos(r),
    lepDatum(r.datum_do),
    r.zamuda ? znacka('zamuda', `Zamuda ${dni(r.zamuda)}`) : '–',
    gumb('Evidentiraj vračilo', () => odpriVracilo(r)),
  )), 'Noben kos ni izposojen.');

  napolni($('#pozneje'), rezervacije.filter((r) => r.stanje === 'ODOBRENA' && !r.za_prevzem).map((r) => vrstica(
    r.clan,
    kos(r),
    termin(r),
    r.namen || '–',
    zRazlogom(r, 'preklic', 'Prekliči'),
  )), 'Ni odobrenih rezervacij za pozneje.');

  // po vračilu s poškodbo: rezervacije tega kosa, dokler niso zavrnjene ali preklicane
  const odprte = rezervacije.filter((r) => prizadete.includes(r.id));
  $('#prizadete').hidden = !odprte.length;
  napolni($('#prizadeteVrstice'), odprte.map((r) => vrstica(
    r.clan,
    imeKosa(r),
    termin(r),
    znacka(r.stanje),
    r.stanje === 'ODDANA' ? zRazlogom(r, 'zavrnitev', 'Zavrni') : zRazlogom(r, 'preklic', 'Prekliči'),
  )), '');
}

function odpriRazlog(r, vrsta) {
  izbrana = r;
  dejanje = vrsta;
  $('#razlogNaslov').textContent = Z_RAZLOGOM[vrsta].naslov;
  $('#razlogPotrdi').textContent = Z_RAZLOGOM[vrsta].potrdi;
  $('#razlogClan').textContent = r.clan;
  $('#razlogKos').textContent = imeKosa(r);
  $('#razlogTermin').textContent = termin(r);
  obrazecRazlog.reset();
  pokazi(oknoRazlog.querySelector('.napaka'), '');
  oknoRazlog.showModal();
}

obOddaji(obrazecRazlog, async () => {
  try {
    await api(`rezervacije/${izbrana.id}/${dejanje}`, { razlog: obrazecRazlog.razlog.value });
    oknoRazlog.close();
    sporoci(Z_RAZLOGOM[dejanje].uspeh);
  } catch (e) {
    pokazi(oknoRazlog.querySelector('.napaka'), e.message);
  }
  await prikazi();
});

function odpriVracilo(r) {
  izbrana = r;
  $('#vraciloClan').textContent = r.clan;
  $('#vraciloKos').textContent = imeKosa(r);
  $('#vraciloRok').textContent = lepDatum(r.datum_do) + (r.zamuda ? ` (zamuda ${dni(r.zamuda)})` : '');
  obrazecVracilo.reset();
  pokazi(oknoVracilo.querySelector('.napaka'), '');
  oknoVracilo.showModal();
}

obOddaji(obrazecVracilo, async () => {
  const vPopravilo = obrazecVracilo.stanje_kosa.value === 'V_POPRAVILU';
  try {
    const izid = await api(`rezervacije/${izbrana.id}/vracilo`, {
      stanje_kosa: obrazecVracilo.stanje_kosa.value,
      opomba: obrazecVracilo.opomba.value,
    });
    oknoVracilo.close();
    prizadete.push(...izid.prizadete.map((p) => p.id));
    const zamuda = izid.zamuda ? `zamuda ${dni(izid.zamuda)}` : 'brez zamude';
    sporoci(`Vračilo je evidentirano, ${zamuda}.${vPopravilo ? ' Kos je šel v popravilo.' : ''}`);
  } catch (e) {
    pokazi(oknoVracilo.querySelector('.napaka'), e.message);
  }
  await prikazi();
});

for (const okno of [oknoRazlog, oknoVracilo]) {
  okno.querySelector('button.drugi').addEventListener('click', () => okno.close());
}

prikazi();
