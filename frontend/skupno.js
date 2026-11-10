// Skupno vsem stranem: klici API, glava z navigacijo, preverjanje prijave in drobni pomočniki.

// začetni zaslon vsake vloge
export const ZACETEK = { CLAN: '/oprema.html', SKRBNIK: '/rezervacije.html', ADMIN: '/uporabniki.html' };

const VLOGE = { CLAN: 'član', SKRBNIK: 'skrbnik', ADMIN: 'administrator' };

const MENI = [
  { naslov: 'Rezervacije', stran: '/rezervacije.html', vloga: 'SKRBNIK' },
  { naslov: 'Uporabniki', stran: '/uporabniki.html', vloga: 'ADMIN' },
  { naslov: 'Oprema', stran: '/oprema.html' },
];

// naredi element: el('a', { href: '/' }, 'besedilo ali drugi elementi')
export function el(oznaka, lastnosti = {}, ...vsebina) {
  const element = Object.assign(document.createElement(oznaka), lastnosti);
  element.append(...vsebina);
  return element;
}

export function vrstica(...celice) {
  return el('tr', {}, ...celice.map((celica) => el('td', {}, celica)));
}

// barvna značka; razred je koda z malimi črkami (PROST -> .prost)
export function znacka(koda, besedilo = koda) {
  return el('span', { className: 'znacka ' + koda.toLowerCase() }, besedilo);
}

// napolni telo tabele; če ni vrstic, to pove
export function napolni(telo, vrstice, prazno) {
  telo.replaceChildren(...vrstice);
  if (!vrstice.length) telo.append(el('tr', {}, el('td', { colSpan: 99, className: 'opomba' }, prazno)));
}

// '2026-11-13' -> '13. 11. 2026'
export function lepDatum(datum) {
  const [leto, mesec, dan] = datum.split('-').map(Number);
  return `${dan}. ${mesec}. ${leto}`;
}

// Klic API: brez telesa GET, s telesom POST. Ob napaki vrže sporočilo strežnika.
export async function api(pot, telo) {
  const odgovor = await fetch('/api/' + pot, telo && {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(telo),
  });
  const podatki = await odgovor.json().catch(() => ({}));
  if (odgovor.ok) return podatki;

  // seja ne velja (več): nazaj na prijavo; stran se zamenja, zato tu kar obstanemo
  if (odgovor.status === 401 && location.pathname !== '/') {
    location.replace('/');
    return new Promise(() => {});
  }
  throw new Error(podatki.napaka || 'Nekaj je šlo narobe');
}

// Na vrhu vsake zaščitene strani: preveri prijavo (in vlogo), nariše glavo, vrne uporabnika.
export async function zacni(vloga) {
  const jaz = await api('jaz');
  if (vloga && jaz.vloga !== vloga) {
    location.replace(ZACETEK[jaz.vloga]); // ni tvoja stran
    return new Promise(() => {});
  }

  const odjava = el('button', { type: 'button', className: 'drugi' }, 'Odjava');
  odjava.addEventListener('click', async () => {
    await api('odjava', {});
    location.replace('/');
  });

  const povezave = MENI
    .filter((m) => !m.vloga || m.vloga === jaz.vloga)
    .map((m) => el('a', { href: m.stran, className: m.stran === location.pathname ? 'tukaj' : '' }, m.naslov));

  document.querySelector('#glava').append(
    el('strong', {}, 'Opremnica'),
    el('nav', {}, ...povezave),
    el('span', {}, `${jaz.ime} ${jaz.priimek} (${VLOGE[jaz.vloga]})`),
    odjava,
  );
  document.body.hidden = false; // do sem je stran skrita, da neprijavljen ne vidi niti ogrodja
  return jaz;
}
