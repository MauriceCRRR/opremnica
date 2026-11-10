import { Router } from 'express';
import { AKTIVNA } from './baza.js';
import { jeDatum } from './datumi.js';

export function opremaPoti(baza) {
  const poti = Router();

  poti.get('/kategorije', (req, res) => {
    res.json(baza.prepare('SELECT id, ime FROM kategorija ORDER BY ime').all());
  });

  // Razpoložljivost kosov v terminu od–do (oba dneva vključena).
  // Kdo ima kos rezerviran, namenoma ne vračamo nikomur.
  poti.get('/oprema', (req, res) => {
    const { od, do: datumDo } = req.query;
    const kategorija = req.query.kategorija ? Number(req.query.kategorija) : null; // brez = vse
    if (!jeDatum(od) || !jeDatum(datumDo)) {
      return res.status(400).json({ napaka: 'Vnesi veljavna datuma od in do' });
    }
    if (datumDo < od) {
      return res.status(400).json({ napaka: 'Datum do ne sme biti pred datumom od' });
    }
    if (kategorija !== null && !Number.isInteger(kategorija)) {
      return res.status(400).json({ napaka: 'Neveljavna kategorija' });
    }

    // termina se prekrivata, če velja A.od <= B.do in B.od <= A.do
    const kosi = baza.prepare(`
      SELECT k.id, k.inventarna_oznaka, k.naziv, kat.ime AS kategorija,
             CASE
               WHEN k.stanje_kosa = 'V_POPRAVILU' THEN 'V_POPRAVILU'
               WHEN EXISTS (SELECT 1 FROM rezervacija r
                            WHERE r.kos_id = k.id AND r.stanje IN ${AKTIVNA}
                              AND r.datum_od <= @do AND @od <= r.datum_do) THEN 'ZASEDEN'
               ELSE 'PROST'
             END AS razpolozljivost
      FROM kos_opreme k
      JOIN kategorija kat ON kat.id = k.kategorija_id
      WHERE k.stanje_kosa <> 'ODPISAN'
        AND (@kategorija IS NULL OR k.kategorija_id = @kategorija)
      ORDER BY k.inventarna_oznaka
    `).all({ od, do: datumDo, kategorija });
    res.json(kosi);
  });

  return poti;
}
