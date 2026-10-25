# Opremnica

Spletna rešitev za izposojo opreme v študentskem društvu. Član vidi, kdaj je kos opreme prost, in ga rezervira. Skrbnik opreme rezervacijo odobri ali zavrne ter evidentira prevzem in vračilo. Sistem ne dovoli dveh rezervacij istega kosa v prekrivajočem se terminu. Administrator upravlja uporabniške račune in vloge.

Projekt pri predmetu Razvoj informacijskih rešitev in storitev (RIRS), UM FERI, 2026/27. Avtor: Maurice Cizic Rottner.

## Stanje

Projekt je v fazi dokumentacije. Pripravljeni so zasnova, uporabniške zgodbe, wireframi in arhitekturne odločitve (ADR). Aplikacija še ni implementirana, zato sta mapi `frontend/` in `backend/` zaenkrat prazni.

## Tehnologije (načrtovane)

- Frontend: HTML, CSS in JavaScript brez ogrodja
- Backend: Node.js, Express, REST API z JSON
- Podatkovna baza: SQLite (`better-sqlite3`)
- Avtentikacija: seja s piškotkom (`express-session`), gesla zgoščena s `scrypt`
- Razvoj: Git, GitHub, GitHub Flow

## Dokumentacija

- [01 – Zasnova rešitve](docs/01-zasnova-resitve.md)
- [02 – Funkcionalnosti in obseg](docs/02-funkcionalnosti-in-obseg.md)
- [03 – Podatkovni model](docs/03-podatkovni-model.md)
- [04 – Arhitektura in tehnološki sklad](docs/04-arhitektura-in-tehnoloski-sklad.md)
- [05 – Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)
- [06 – Wireframes](docs/06-wireframes.md) (slike v `docs/wireframes/`)
- Arhitekturne odločitve (`docs/adr/`, predloga [adr-template.md](docs/adr/adr-template.md)):
  - [0001 Ena spletna aplikacija z lokalnim zagonom](docs/adr/0001-ena-spletna-aplikacija.md)
  - [0002 Frontend brez ogrodja](docs/adr/0002-frontend-brez-ogrodja.md)
  - [0003 Backend v Node.js in Expressu](docs/adr/0003-backend-node-express.md)
  - [0004 Podatkovna baza SQLite](docs/adr/0004-baza-sqlite.md)
  - [0005 Prijava s sejo in scrypt](docs/adr/0005-prijava-s-sejo-in-scrypt.md)
  - [0006 Poslovna pravila preverja backend](docs/adr/0006-pravila-preverja-backend.md)

## Razvojni proces

Projekt sledi GitHub Flow: vsaka sprememba nastane na svoji veji in pride v `main` prek pull requesta. Veja `main` je zaščitena: pull request je obvezen (brez zahtevanih odobritev), force push in brisanje veje nista dovoljena, pravila veljajo tudi za administratorja.
