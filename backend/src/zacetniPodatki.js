import { zgostiGeslo } from './gesla.js';
import { pristejDni } from './datumi.js';

// geslo vseh testnih računov; izmišljeni ljudje, samo za lokalni razvoj
export const TESTNO_GESLO = 'opremnica-2026';

const UPORABNIKI = [
  // ime, priimek, e-naslov, vloga, aktiven
  ['Ana', 'Novak', 'ana.novak@example.org', 'CLAN', 1],
  ['Nik', 'Zupan', 'nik.zupan@example.org', 'CLAN', 1],
  ['Miha', 'Kos', 'miha.kos@example.org', 'SKRBNIK', 1],
  ['Petra', 'Vidmar', 'petra.vidmar@example.org', 'ADMIN', 1],
  ['Sara', 'Petek', 'sara.petek@example.org', 'CLAN', 0],
];

const KOSI = [
  // kategorija, oznaka, naziv, stanje
  ['Fotografija', 'FOTO-01', 'Fotoaparat, zrcalnorefleksni', 'UPORABEN'],
  ['Fotografija', 'FOTO-02', 'Fotoaparat, brezzrcalni', 'UPORABEN'],
  ['Fotografija', 'FOTO-03', 'Stativ', 'UPORABEN'],
  ['Fotografija', 'FOTO-04', 'Objektiv 50 mm', 'V_POPRAVILU'],
  ['Taborjenje', 'SOT-01', 'Šotor za 4 osebe', 'UPORABEN'],
  ['Taborjenje', 'SOT-02', 'Šotor za 2 osebi', 'UPORABEN'],
  ['Taborjenje', 'KUH-01', 'Plinski kuhalnik', 'ODPISAN'],
  ['Ozvočenje in projekcija', 'ZVOK-01', 'Prenosni zvočnik', 'UPORABEN'],
  ['Ozvočenje in projekcija', 'PROJ-01', 'Projektor', 'UPORABEN'],
  ['Kolesa', 'KOLO-01', 'Gorsko kolo', 'UPORABEN'],
  ['Kolesa', 'KOLO-02', 'Mestno kolo', 'UPORABEN'],
];

// Vpiše začetne podatke. Polne baze se ne dotakne, razen če izrecno rečemo ponastavi
// (takrat najprej pobriše VSE). Vrne true, če je kaj vpisal.
export function vpisiZacetnePodatke(baza, danes, ponastavi = false) {
  const zeIma = baza.prepare('SELECT COUNT(*) AS n FROM uporabnik').get().n > 0;
  if (zeIma && !ponastavi) return false;

  baza.transaction(() => {
    for (const tabela of ['rezervacija', 'kos_opreme', 'kategorija', 'uporabnik']) {
      baza.exec(`DELETE FROM ${tabela}`);
    }

    // datumi rezervacij so glede na danes, da je primer smiseln kadarkoli ga naložiš
    const dan = (n) => pristejDni(danes, n);
    const cas = (n, ura) => `${dan(n)}T${ura}:00`;

    const u = {}; // ime -> id
    const novUporabnik = baza.prepare(
      'INSERT INTO uporabnik (ime, priimek, email, geslo_hash, vloga, aktiven, ustvarjen_ob) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const [ime, priimek, email, vloga, aktiven] of UPORABNIKI) {
      u[ime] = novUporabnik.run(ime, priimek, email, zgostiGeslo(TESTNO_GESLO), vloga, aktiven, cas(-30, '09:00')).lastInsertRowid;
    }

    const kategorija = {}; // ime -> id
    const k = {}; // oznaka -> id
    const novaKategorija = baza.prepare('INSERT INTO kategorija (ime) VALUES (?)');
    const novKos = baza.prepare(
      'INSERT INTO kos_opreme (kategorija_id, inventarna_oznaka, naziv, stanje_kosa) VALUES (?, ?, ?, ?)',
    );
    for (const [imeKategorije, oznaka, naziv, stanje] of KOSI) {
      kategorija[imeKategorije] ??= novaKategorija.run(imeKategorije).lastInsertRowid;
      k[oznaka] = novKos.run(kategorija[imeKategorije], oznaka, naziv, stanje).lastInsertRowid;
    }

    const novaRezervacija = baza.prepare(`
      INSERT INTO rezervacija (clan_id, kos_id, datum_od, datum_do, namen, stanje, oddano_ob,
                               odlocil_id, odloceno_ob, razlog, prevzeto_ob, vrnjeno_ob, opomba_vracila)
      VALUES (@clan, @kos, @od, @do, @namen, @stanje, @oddano,
              @odlocil, @odloceno, @razlog, @prevzeto, @vrnjeno, @opomba)`);
    const prazno = { odlocil: null, odloceno: null, razlog: null, prevzeto: null, vrnjeno: null, opomba: null };
    const odobril = (n, ura) => ({ odlocil: u.Miha, odloceno: cas(n, ura) });

    for (const rezervacija of [
      // čakata na skrbnika
      { clan: u.Ana, kos: k['SOT-01'], od: dan(9), do: dan(11), namen: 'jesenski tabor', stanje: 'ODDANA', oddano: cas(-1, '18:05') },
      { clan: u.Nik, kos: k['PROJ-01'], od: dan(16), do: dan(16), namen: 'filmski večer', stanje: 'ODDANA', oddano: cas(0, '08:40') },
      // odobreni: ena v prihodnosti, ena za prevzem danes
      { clan: u.Nik, kos: k['FOTO-01'], od: dan(2), do: dan(5), namen: 'fotografiranje dogodka', stanje: 'ODOBRENA', oddano: cas(-3, '12:30'), ...odobril(-2, '19:00') },
      { clan: u.Ana, kos: k['ZVOK-01'], od: dan(0), do: dan(1), namen: 'predstavitev društva', stanje: 'ODOBRENA', oddano: cas(-4, '10:15'), ...odobril(-3, '19:00') },
      // izposojeno, rok je bil včeraj
      { clan: u.Nik, kos: k['KOLO-01'], od: dan(-3), do: dan(-1), namen: 'kolesarski izlet', stanje: 'PREVZETA', oddano: cas(-6, '16:20'), ...odobril(-5, '19:00'), prevzeto: cas(-3, '17:05') },
      // zaključeni
      { clan: u.Ana, kos: k['KOLO-02'], od: dan(-10), do: dan(-8), namen: null, stanje: 'VRNJENA', oddano: cas(-13, '11:00'), ...odobril(-12, '19:00'), prevzeto: cas(-10, '17:00'), vrnjeno: cas(-8, '18:30'), opomba: 'brez poškodb' },
      { clan: u.Nik, kos: k['FOTO-03'], od: dan(2), do: dan(3), namen: null, stanje: 'ZAVRNJENA', oddano: cas(-2, '09:10'), ...odobril(-2, '19:05'), razlog: 'Stativ gre ta teden na društveni dogodek.' },
    ]) {
      novaRezervacija.run({ ...prazno, ...rezervacija });
    }
  })();

  return true;
}
