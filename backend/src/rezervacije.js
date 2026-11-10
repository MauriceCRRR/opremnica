import { Router } from 'express';
import { AKTIVNA } from './baza.js';
import { danes, lepDatum, lokalniCas, napakaTermina, razlikaDni } from './datumi.js';
import { samo } from './pravice.js';

const NAJVEC_DNI = 14; // P2
const NAJVEC_VNAPREJ = 60; // P3

// zakaj oddaja ni veljavna (sporočilo pove vzrok) ali null, če je vse v redu
function napakaOddaje({ kos, od, do: datumDo, namen }, danasnji) {
  if (!Number.isInteger(kos)) return 'Izberi kos';
  const napaka = napakaTermina(od, datumDo);
  if (napaka) return napaka;
  if (od < danasnji) return 'Termin se ne sme začeti v preteklosti';
  if (razlikaDni(danasnji, od) > NAJVEC_VNAPREJ) return `Termin se lahko začne največ ${NAJVEC_VNAPREJ} dni od danes`;
  if (razlikaDni(od, datumDo) + 1 > NAJVEC_DNI) return `Rezervacija lahko traja največ ${NAJVEC_DNI} dni`;
  if (namen?.length > 200) return 'Namen je predolg (največ 200 znakov)';
  return null;
}

// Dnevi zamude: dan vračila (ali danes, če kos še ni vrnjen) minus datum do.
// Vedno izračunano iz datumov, nikoli shranjeno.
function zamuda(r, danasnji) {
  if (r.stanje !== 'PREVZETA' && r.stanje !== 'VRNJENA') return 0;
  const dan = r.vrnjeno_ob ? r.vrnjeno_ob.slice(0, 10) : danasnji;
  return Math.max(0, razlikaDni(r.datum_do, dan));
}

export function rezervacijePoti(baza, zdaj) {
  const poti = Router();

  // Preverjanje in vpis sta v isti transakciji (BEGIN IMMEDIATE), zato od dveh
  // hkratnih oddaj za isti kos in prekrivajoč se termin uspe samo prva.
  const oddaj = baza.transaction((rezervacija) => {
    const kos = baza.prepare('SELECT stanje_kosa FROM kos_opreme WHERE id = ?').get(rezervacija.kos);
    if (!kos) return { status: 404, napaka: 'Kos ne obstaja' };
    if (kos.stanje_kosa !== 'UPORABEN') {
      return { status: 409, napaka: 'Kos je v popravilu ali odpisan, zato ga ni mogoče rezervirati' };
    }

    // termina se prekrivata, če velja A.od <= B.do in B.od <= A.do
    const zaseden = baza.prepare(`
      SELECT 1 FROM rezervacija
      WHERE kos_id = @kos AND stanje IN ${AKTIVNA} AND datum_od <= @do AND @od <= datum_do
    `).get(rezervacija);
    if (zaseden) return { status: 409, napaka: 'Kos je v izbranem terminu že rezerviran' };

    const { lastInsertRowid } = baza.prepare(`
      INSERT INTO rezervacija (clan_id, kos_id, datum_od, datum_do, namen, stanje, oddano_ob)
      VALUES (@clan, @kos, @od, @do, @namen, 'ODDANA', @oddano)
    `).run(rezervacija);
    return { status: 201, id: Number(lastInsertRowid), stanje: 'ODDANA' };
  });

  // Oddaja rezervacije. Lastnik je vedno prijavljeni uporabnik; clan_id iz zahteve se ne bere.
  poti.post('/rezervacije', (req, res) => {
    const rezervacija = {
      clan: req.uporabnik.id,
      kos: req.body?.kos_id,
      od: req.body?.datum_od,
      do: req.body?.datum_do,
      namen: String(req.body?.namen ?? '').trim() || null,
      oddano: lokalniCas(zdaj()),
    };
    const napaka = napakaOddaje(rezervacija, danes(zdaj()));
    if (napaka) return res.status(400).json({ napaka });

    const { status, ...izid } = oddaj.immediate(rezervacija);
    res.status(status).json(izid);
  });

  // samo rezervacije prijavljenega uporabnika, najnovejša na vrhu
  poti.get('/rezervacije/moje', (req, res) => {
    const danasnji = danes(zdaj());
    const rezervacije = baza.prepare(`
      SELECT r.id, r.datum_od, r.datum_do, r.namen, r.stanje, r.razlog, r.oddano_ob, r.vrnjeno_ob,
             k.inventarna_oznaka, k.naziv
      FROM rezervacija r
      JOIN kos_opreme k ON k.id = r.kos_id
      WHERE r.clan_id = ?
      ORDER BY r.oddano_ob DESC, r.id DESC
    `).all(req.uporabnik.id);
    res.json(rezervacije.map((r) => ({ ...r, zamuda: zamuda(r, danasnji) })));
  });

  // skrbnikov pregled aktivnih rezervacij: čakajoče po času oddaje (najstarejša prva),
  // izposojene po roku vračila, odobrene po datumu začetka
  poti.get('/rezervacije', samo('SKRBNIK'), (req, res) => {
    const danasnji = danes(zdaj());
    const rezervacije = baza.prepare(`
      SELECT r.id, r.datum_od, r.datum_do, r.namen, r.stanje, r.oddano_ob,
             u.ime || ' ' || u.priimek AS clan,
             k.inventarna_oznaka, k.naziv, k.stanje_kosa
      FROM rezervacija r
      JOIN uporabnik u ON u.id = r.clan_id
      JOIN kos_opreme k ON k.id = r.kos_id
      WHERE r.stanje IN ${AKTIVNA}
      ORDER BY CASE r.stanje WHEN 'ODDANA' THEN r.oddano_ob WHEN 'PREVZETA' THEN r.datum_do ELSE r.datum_od END, r.id
    `).all();
    res.json(rezervacije.map((r) => ({
      ...r,
      // seznam Za prevzem: odobrena in termin se je že začel
      za_prevzem: r.stanje === 'ODOBRENA' && r.datum_od <= danasnji,
      zamuda: zamuda(r, danasnji),
    })));
  });

  // id iz naslova; če ni število, je null in se ne ujame z nobeno rezervacijo
  const idIz = (req) => (/^\d+$/.test(req.params.id) ? Number(req.params.id) : null);

  // Preklic pred prevzemom. Lastnik prekliče svojo oddano ali odobreno rezervacijo;
  // skrbnik tujo samo, če je odobrena, in z obveznim razlogom (oddano zavrne).
  // Pogoj na stanje je v samem UPDATE, zato se prevzeta ali zaključena rezervacija ne spremeni.
  poti.post('/rezervacije/:id/preklic', (req, res) => {
    const id = idIz(req);
    const razlog = String(req.body?.razlog ?? '').trim();
    const rezervacija = baza.prepare('SELECT clan_id, stanje FROM rezervacija WHERE id = ?').get(id);
    if (!rezervacija) return res.status(404).json({ napaka: 'Rezervacija ne obstaja' });

    const lastnik = rezervacija.clan_id === req.uporabnik.id;
    if (!lastnik && req.uporabnik.vloga !== 'SKRBNIK') {
      return res.status(403).json({ napaka: 'Prekličeš lahko samo svojo rezervacijo' });
    }
    if (!lastnik && !razlog) return res.status(400).json({ napaka: 'Razlog preklica je obvezen' });
    if (razlog.length > 300) return res.status(400).json({ napaka: 'Razlog je predolg (največ 300 znakov)' });

    const dovoljena = lastnik ? "('ODDANA', 'ODOBRENA')" : "('ODOBRENA')";
    const { changes } = baza.prepare(
      `UPDATE rezervacija SET stanje = 'PREKLICANA', razlog = ? WHERE id = ? AND stanje IN ${dovoljena}`,
    ).run(razlog || null, id);
    if (!changes) {
      const napaka = !lastnik && rezervacija.stanje === 'ODDANA'
        ? 'Oddane rezervacije skrbnik ne prekliče, ampak jo zavrne'
        : `Rezervacije v stanju ${rezervacija.stanje} ni mogoče preklicati`;
      return res.status(409).json({ napaka });
    }
    res.json({ stanje: 'PREKLICANA' });
  });

  // Skrbnikova odločitev o čakajoči rezervaciji. Pogoj stanje = 'ODDANA' je v samem UPDATE,
  // zato ponovljena ali zakasnela odločitev ne spremeni ničesar. Zapišeta se skrbnik in čas.
  function odloci(req, res, stanje, razlog) {
    const id = idIz(req);
    const { changes } = baza.prepare(`
      UPDATE rezervacija SET stanje = ?, razlog = ?, odlocil_id = ?, odloceno_ob = ?
      WHERE id = ? AND stanje = 'ODDANA'
    `).run(stanje, razlog, req.uporabnik.id, lokalniCas(zdaj()), id);
    if (changes) return res.json({ stanje });

    const obstaja = baza.prepare('SELECT 1 FROM rezervacija WHERE id = ?').get(id);
    if (!obstaja) return res.status(404).json({ napaka: 'Rezervacija ne obstaja' });
    res.status(409).json({ napaka: 'Rezervacija ni več v stanju ODDANA' });
  }

  poti.post('/rezervacije/:id/odobritev', samo('SKRBNIK'), (req, res) => {
    odloci(req, res, 'ODOBRENA', null);
  });

  poti.post('/rezervacije/:id/zavrnitev', samo('SKRBNIK'), (req, res) => {
    const razlog = String(req.body?.razlog ?? '').trim();
    if (!razlog) return res.status(400).json({ napaka: 'Razlog zavrnitve je obvezen' });
    if (razlog.length > 300) return res.status(400).json({ napaka: 'Razlog je predolg (največ 300 znakov)' });
    odloci(req, res, 'ZAVRNJENA', razlog);
  });

  // Prevzem: pogoji in zapis so v eni transakciji, da se med preverjanjem nič ne spremeni.
  const prevzemi = baza.transaction((id, danasnji, cas) => {
    const r = baza.prepare(`
      SELECT r.stanje, r.kos_id, r.datum_od, r.datum_do, k.stanje_kosa
      FROM rezervacija r
      JOIN kos_opreme k ON k.id = r.kos_id
      WHERE r.id = ?
    `).get(id);
    if (!r) return { status: 404, napaka: 'Rezervacija ne obstaja' };
    if (r.stanje !== 'ODOBRENA') return { status: 409, napaka: 'Prevzeti je mogoče samo odobreno rezervacijo' };
    if (danasnji < r.datum_od || danasnji > r.datum_do) {
      return { status: 409, napaka: 'Prevzem je mogoč samo v rezerviranem terminu' };
    }
    if (r.stanje_kosa !== 'UPORABEN') {
      return { status: 409, napaka: 'Kos je v popravilu ali odpisan, zato ga ni mogoče prevzeti' };
    }

    // kos je lahko še pri prejšnjem članu, tudi če je njegov termin že minil
    const zunaj = baza.prepare(`
      SELECT u.ime || ' ' || u.priimek AS clan, x.datum_do AS vrniti_do
      FROM rezervacija x
      JOIN uporabnik u ON u.id = x.clan_id
      WHERE x.kos_id = ? AND x.stanje = 'PREVZETA'
    `).get(r.kos_id);
    if (zunaj) {
      return {
        status: 409,
        napaka: `Kos je še pri članu ${zunaj.clan}, vrniti bi ga moral do ${lepDatum(zunaj.vrniti_do)}`,
        ...zunaj,
      };
    }

    baza.prepare("UPDATE rezervacija SET stanje = 'PREVZETA', prevzeto_ob = ? WHERE id = ?").run(cas, id);
    return { status: 200, stanje: 'PREVZETA' };
  });

  poti.post('/rezervacije/:id/prevzem', samo('SKRBNIK'), (req, res) => {
    const { status, ...izid } = prevzemi.immediate(idIz(req), danes(zdaj()), lokalniCas(zdaj()));
    res.status(status).json(izid);
  });

  // Vračilo: rezervacija in (ob poškodbi) kos se spremenita skupaj ali sploh ne.
  const vrni = baza.transaction((id, stanjeKosa, opomba, danasnji, cas) => {
    const r = baza.prepare('SELECT stanje, kos_id, datum_do FROM rezervacija WHERE id = ?').get(id);
    if (!r) return { status: 404, napaka: 'Rezervacija ne obstaja' };
    if (r.stanje !== 'PREVZETA') return { status: 409, napaka: 'Vrniti je mogoče samo prevzeto rezervacijo' };

    baza.prepare(
      "UPDATE rezervacija SET stanje = 'VRNJENA', vrnjeno_ob = ?, opomba_vracila = ? WHERE id = ?",
    ).run(cas, opomba, id);

    let prizadete = [];
    if (stanjeKosa === 'V_POPRAVILU') {
      baza.prepare("UPDATE kos_opreme SET stanje_kosa = 'V_POPRAVILU' WHERE id = ?").run(r.kos_id);
      // še neizpeljane rezervacije tega kosa; skrbnik jih mora zavrniti ali preklicati
      prizadete = baza.prepare(`
        SELECT x.id, x.datum_od, x.datum_do, x.stanje, u.ime || ' ' || u.priimek AS clan
        FROM rezervacija x
        JOIN uporabnik u ON u.id = x.clan_id
        WHERE x.kos_id = ? AND x.stanje IN ('ODDANA', 'ODOBRENA') AND x.datum_do >= ?
        ORDER BY x.datum_od, x.id
      `).all(r.kos_id, danasnji);
    }
    const dniZamude = zamuda({ stanje: 'VRNJENA', datum_do: r.datum_do, vrnjeno_ob: cas });
    return { status: 200, stanje: 'VRNJENA', zamuda: dniZamude, prizadete };
  });

  poti.post('/rezervacije/:id/vracilo', samo('SKRBNIK'), (req, res) => {
    const stanjeKosa = req.body?.stanje_kosa;
    const opomba = String(req.body?.opomba ?? '').trim();
    if (stanjeKosa !== 'UPORABEN' && stanjeKosa !== 'V_POPRAVILU') {
      return res.status(400).json({ napaka: 'Izberi stanje kosa ob vračilu' });
    }
    if (stanjeKosa === 'V_POPRAVILU' && !opomba) {
      return res.status(400).json({ napaka: 'Pri kosu, ki potrebuje popravilo, je opomba obvezna' });
    }
    if (opomba.length > 300) return res.status(400).json({ napaka: 'Opomba je predolga (največ 300 znakov)' });

    const { status, ...izid } = vrni.immediate(idIz(req), stanjeKosa, opomba || null, danes(zdaj()), lokalniCas(zdaj()));
    res.status(status).json(izid);
  });

  return poti;
}
