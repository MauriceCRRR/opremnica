import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';

export const POT_BAZE = join(import.meta.dirname, '..', 'data', 'opremnica.sqlite');

// stanja, v katerih rezervacija zaseda termin
export const AKTIVNA = "('ODDANA', 'ODOBRENA', 'PREVZETA')";

// odpre bazo in po potrebi naredi tabele; ':memory:' je za teste
export function odpriBazo(pot = POT_BAZE) {
  if (pot !== ':memory:') mkdirSync(dirname(pot), { recursive: true });
  const baza = new Database(pot);
  baza.pragma('foreign_keys = ON');
  baza.exec(readFileSync(join(import.meta.dirname, 'shema.sql'), 'utf8'));
  return baza;
}
