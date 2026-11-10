// Datumi so koledarski dnevi 'LLLL-MM-DD' po ljubljanskem času, ne glede na uro strežnika.

// švedski zapis je ravno 'LLLL-MM-DD HH:MM:SS'
const ljubljana = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Ljubljana',
  dateStyle: 'short',
  timeStyle: 'medium',
});

// trenutek (Date) -> '2026-11-13T17:05:00'
export function lokalniCas(trenutek) {
  return ljubljana.format(trenutek).replace(' ', 'T');
}

// trenutek (Date) -> '2026-11-13'
export function danes(trenutek) {
  return lokalniCas(trenutek).slice(0, 10);
}

// pravi koledarski datum? 2026-02-30 ni, čeprav ga Date tiho prestavi v marec
export function jeDatum(niz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(niz)) return false;
  const d = new Date(niz + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === niz;
}

// datum + n dni; računamo v UTC, da premik ure ne pokvari štetja
export function pristejDni(datum, n) {
  const d = new Date(datum + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
