import { Router } from 'express';
import { samo } from './pravice.js';

export function uporabnikiPoti(baza) {
  const poti = Router();

  // administratorjev pregled računov; zgoščenih gesel ne pošiljamo
  poti.get('/uporabniki', samo('ADMIN'), (req, res) => {
    res.json(baza.prepare(
      'SELECT id, ime, priimek, email, vloga, aktiven FROM uporabnik ORDER BY priimek, ime',
    ).all());
  });

  return poti;
}
