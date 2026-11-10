-- Shema baze Opremnica (glej docs/03-podatkovni-model.md).
-- Datumi so besedilo 'LLLL-MM-DD', časi 'LLLL-MM-DDTHH:MM:SS' po ljubljanskem času.

CREATE TABLE IF NOT EXISTS uporabnik (
  id           INTEGER PRIMARY KEY,
  ime          TEXT NOT NULL,
  priimek      TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  geslo_hash   TEXT NOT NULL,
  vloga        TEXT NOT NULL CHECK (vloga IN ('CLAN', 'SKRBNIK', 'ADMIN')),
  aktiven      INTEGER NOT NULL DEFAULT 1 CHECK (aktiven IN (0, 1)),
  ustvarjen_ob TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kategorija (
  id  INTEGER PRIMARY KEY,
  ime TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS kos_opreme (
  id                INTEGER PRIMARY KEY,
  kategorija_id     INTEGER NOT NULL REFERENCES kategorija (id),
  inventarna_oznaka TEXT NOT NULL UNIQUE,
  naziv             TEXT NOT NULL,
  opis              TEXT,
  stanje_kosa       TEXT NOT NULL DEFAULT 'UPORABEN'
                    CHECK (stanje_kosa IN ('UPORABEN', 'V_POPRAVILU', 'ODPISAN'))
);

CREATE TABLE IF NOT EXISTS rezervacija (
  id             INTEGER PRIMARY KEY,
  clan_id        INTEGER NOT NULL REFERENCES uporabnik (id),
  kos_id         INTEGER NOT NULL REFERENCES kos_opreme (id),
  datum_od       TEXT NOT NULL,
  datum_do       TEXT NOT NULL,
  namen          TEXT,
  stanje         TEXT NOT NULL DEFAULT 'ODDANA'
                 CHECK (stanje IN ('ODDANA', 'ODOBRENA', 'ZAVRNJENA', 'PREKLICANA', 'PREVZETA', 'VRNJENA')),
  oddano_ob      TEXT NOT NULL,
  odlocil_id     INTEGER REFERENCES uporabnik (id),
  odloceno_ob    TEXT,
  razlog         TEXT,
  prevzeto_ob    TEXT,
  vrnjeno_ob     TEXT,
  opomba_vracila TEXT,
  CHECK (datum_od <= datum_do)
);
