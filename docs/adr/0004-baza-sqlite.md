# 0004 Podatkovna baza SQLite

- Status: sprejeto
- Datum: 2026-10-26

## Kontekst in problem

Uporabniki, kategorije, kosi opreme in rezervacije morajo biti trajno shranjeni in povezani s tujimi ključi (glej 03-podatkovni-model.md). Preverjanje prekrivanja in zapis rezervacije morata potekati v eni transakciji. Aplikacija teče lokalno in ima malo hkratnih uporabnikov. Katero bazo izbrati?

## Obravnavane možnosti

* SQLite (ena datoteka, knjižnica `better-sqlite3`).
* PostgreSQL (ločen strežnik baze).
* MongoDB (dokumentna baza).

## Odločitev

Izbrana možnost: "SQLite", ker relacijski model s tujimi ključi ustreza entitetam, transakcije omogočajo varno preverjanje prekrivanja, baza pa je ena datoteka brez namestitve strežnika.

### Posledice

* Dobro, ker ni strežnika baze; zagon in varnostna kopija sta preprosta.
* Dobro, ker so na voljo tuji ključi in omejitve `UNIQUE` in `CHECK`, kot v večjih bazah.
* Dobro, ker izpeljanih podatkov ni treba shranjevati: razpoložljivost in zamudo izračunamo s poizvedbo iz datumov in stanja rezervacije.
* Slabo, ker naenkrat piše samo ena povezava; pri veliko hkratnih uporabnikih bi bil potreben prehod na PostgreSQL.
* Slabo, ker je treba tuje ključe izrecno vklopiti (`PRAGMA foreign_keys = ON`) in datume hraniti kot besedilo ISO 8601.
