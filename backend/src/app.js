import { join } from 'node:path';
import express from 'express';
import session from 'express-session';
import { danes } from './datumi.js';
import { preveriGeslo } from './gesla.js';
import { opremaPoti } from './oprema.js';
import { rezervacijePoti } from './rezervacije.js';
import { uporabnikiPoti } from './uporabniki.js';

const PISKOTEK = 'opremnica.seja';

// Sestavi aplikacijo. Bazo, skrivnost in uro dobi od zunaj, da jih testi lahko zamenjajo.
export function ustvariApp({ baza, skrivnost, zdaj = () => new Date() }) {
  const app = express();
  app.use(express.json());
  app.use(session({
    name: PISKOTEK,
    secret: skrivnost,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  }));

  app.post('/api/prijava', (req, res, next) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const geslo = String(req.body?.geslo ?? '');
    const uporabnik = baza.prepare('SELECT * FROM uporabnik WHERE email = ?').get(email);

    // namenoma isto sporočilo, da ne izdamo, kateri podatek je napačen
    if (!uporabnik || !preveriGeslo(geslo, uporabnik.geslo_hash)) {
      return res.status(401).json({ napaka: 'Napačen e-naslov ali geslo' });
    }
    if (!uporabnik.aktiven) {
      return res.status(401).json({ napaka: 'Račun je deaktiviran' });
    }

    // ob prijavi nova seja; v njej je samo id, ostalo vsakič preberemo iz baze
    req.session.regenerate((napaka) => {
      if (napaka) return next(napaka);
      req.session.uporabnikId = uporabnik.id;
      res.json({ vloga: uporabnik.vloga });
    });
  });

  // Od tu naprej je vse pod /api samo za prijavljene. Uporabnika vsakič preberemo
  // iz baze, zato deaktivacija in sprememba vloge primeta že pri naslednji zahtevi.
  app.use('/api', (req, res, next) => {
    const id = req.session.uporabnikId;
    req.uporabnik = id && baza
      .prepare('SELECT id, ime, priimek, vloga FROM uporabnik WHERE id = ? AND aktiven = 1')
      .get(id);
    if (!req.uporabnik) return res.status(401).json({ napaka: 'Prijava je obvezna' });
    next();
  });

  app.post('/api/odjava', (req, res, next) => {
    req.session.destroy((napaka) => {
      if (napaka) return next(napaka);
      res.clearCookie(PISKOTEK).json({});
    });
  });

  // kdo sem; zraven gre današnji dan, da ga frontend ne računa po svoje
  app.get('/api/jaz', (req, res) => {
    res.json({ ...req.uporabnik, danes: danes(zdaj()) });
  });

  app.use('/api', opremaPoti(baza));
  app.use('/api', rezervacijePoti(baza));
  app.use('/api', uporabnikiPoti(baza));
  app.use('/api', (req, res) => res.status(404).json({ napaka: 'Ta pot ne obstaja' }));

  // frontend z istega strežnika (isti izvor, brez CORS)
  app.use(express.static(join(import.meta.dirname, '..', '..', 'frontend')));

  // napake: pokvarjen JSON v zahtevi je 400, vse drugo 500
  app.use((napaka, req, res, next) => {
    if (napaka.status === 400) return res.status(400).json({ napaka: 'Neveljavna zahteva' });
    console.error(napaka);
    res.status(500).json({ napaka: 'Napaka na strežniku' });
  });

  return app;
}
