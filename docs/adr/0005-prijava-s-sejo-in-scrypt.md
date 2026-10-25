# 0005 Prijava s sejo v piškotku in gesli, zgoščenimi s scrypt

- Status: sprejeto
- Datum: 2026-10-26

## Kontekst in problem

Rešitev ima tri vloge z različnimi pravicami (član, skrbnik opreme, administrator). Potrebujemo prijavo, odjavo in preverjanje vloge pri vsaki zahtevi. Gesla ne smejo biti shranjena berljivo, deaktiviran račun pa mora takoj izgubiti dostop. Kako izvesti avtentikacijo?

## Obravnavane možnosti

* Seja na strežniku s piškotkom (`express-session`), gesla zgoščena s `scrypt` iz `node:crypto`.
* Žeton JWT, ki ga hrani brskalnik.
* Prijava prek zunanjega ponudnika (Google, AAI).

## Odločitev

Izbrana možnost: "Seja na strežniku s piškotkom in scrypt", ker frontend in API delita isti izvor (ADR 0001), odjava in deaktivacija veljata takoj, `scrypt` pa je vgrajen v Node.js in ne potrebuje dodatne knjižnice.

### Posledice

* Dobro, ker je piškotek `HttpOnly`, zato JavaScript na strani do njega ne more dostopati.
* Dobro, ker strežnik pri vsaki zahtevi prebere uporabnika iz baze, zato sprememba vloge in deaktivacija veljata takoj (US-10).
* Slabo, ker privzeta shramba sej v pomnilniku ob ponovnem zagonu strežnika odjavi vse uporabnike; za lokalni razvoj je to sprejemljivo.
* Slabo, ker so piškotki seje izpostavljeni napadom CSRF; tveganje zmanjšamo s `SameSite=Lax` in s tem, da spremembe potekajo samo z zahtevami POST in PUT v obliki JSON.
* Slabo, ker prijava prek zunanjega ponudnika ni podprta; uporabnik ima ločeno geslo.
