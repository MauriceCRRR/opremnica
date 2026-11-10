import { Router } from 'express';
import { AKTIVNA } from './baza.js';
import { samo } from './pravice.js';

export function rezervacijePoti(baza) {
  const poti = Router();

  // skrbnikov pregled: aktivne rezervacije s članom, kosom in terminom
  poti.get('/rezervacije', samo('SKRBNIK'), (req, res) => {
    res.json(baza.prepare(`
      SELECT r.id, r.datum_od, r.datum_do, r.namen, r.stanje,
             u.ime || ' ' || u.priimek AS clan,
             k.inventarna_oznaka, k.naziv
      FROM rezervacija r
      JOIN uporabnik u ON u.id = r.clan_id
      JOIN kos_opreme k ON k.id = r.kos_id
      WHERE r.stanje IN ${AKTIVNA}
      ORDER BY r.datum_od, r.id
    `).all());
  });

  return poti;
}
