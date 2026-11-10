# Opremnica

Spletna rešitev za izposojo opreme v študentskem društvu. Član vidi, kdaj je kos opreme prost, in ga rezervira. Skrbnik opreme rezervacijo odobri ali zavrne ter evidentira prevzem in vračilo. Sistem ne dovoli dveh rezervacij istega kosa v prekrivajočem se terminu. Administrator upravlja uporabniške račune in vloge.

Projekt pri predmetu Razvoj informacijskih rešitev in storitev (RIRS), UM FERI, 2026/27. Avtor: Maurice Čižič Rottner.

## Stanje

Aplikacija je v razvoju in jo je že mogoče lokalno zagnati. MVP obsega zgodbe US-01 do US-06 ([05 – Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)). Narejen je prvi sklop:

| Zgodba | Stanje |
|---|---|
| US-01 Prijava in dostop po vlogi | narejeno |
| US-02 Pregled opreme in razpoložljivosti | narejeno, razen gumba *Rezerviraj* (kriterij 5), ki pride skupaj z US-03 |
| US-03 Oddaja rezervacije s preverjanjem prekrivanja | še ni |
| US-04 Odobritev ali zavrnitev rezervacije | še ni |
| US-05 Evidentiranje prevzema | še ni |
| US-06 Evidentiranje vračila in stanja kosa | še ni |

Kaj trenutno deluje:

- prijava in odjava; član pride na *Oprema*, skrbnik na *Rezervacije*, administrator na *Uporabniki*,
- pregled opreme s filtrom po kategoriji in terminu ter razpoložljivostjo »Prost«, »Zaseden v terminu« ali »V popravilu«,
- skrbnik vidi seznam aktivnih rezervacij, zaenkrat samo za branje (odobritev, prevzem in vračilo so US-04 do US-06),
- administrator vidi seznam računov, samo za branje. Računi se naložijo z začetnimi podatki; upravljanje računov (US-10) ni del MVP.

Zgodbe US-07 do US-12 niso del MVP.

Razvojne naloge so na GitHub Project boardu: <https://github.com/users/MauriceCRRR/projects/5>

## Lokalni zagon

Potrebuješ Git ter Node.js 22.9 ali novejši z npm (razvito in preverjeno na Node.js 24.13).

```bash
git clone https://github.com/MauriceCRRR/opremnica.git
cd opremnica/backend
npm ci                  # namesti zaklenjene odvisnosti
cp .env.example .env    # na Windows: copy .env.example .env
npm run seed            # naredi bazo in vpiše začetne podatke
npm start               # http://localhost:3000
```

Pred `npm start` v `backend/.env` vpiši `SESSION_SECRET`. To je skrivnost za podpis sejnih piškotkov; brez nje se strežnik ne zažene. Svojo narediš na primer tako:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Datoteka `.env` in baza `backend/data/opremnica.sqlite` nista v Gitu. Če so vrata 3000 zasedena, v `.env` nastavi drug `PORT`.

### Začetni podatki

`npm run seed` vpiše testne račune, 4 kategorije, 11 kosov opreme in nekaj rezervacij v različnih stanjih. Datumi rezervacij so postavljeni glede na dan, ko seed zaženeš.

Če baza že ima podatke, jih seed ne spreminja. Namerna ponastavitev, ki **pobriše vse podatke** in jih vpiše na novo:

```bash
npm run seed -- --ponastavi
```

### Testni računi

To so izmišljene osebe, samo za lokalni razvoj. Geslo vseh je `opremnica-2026`.

| E-naslov | Vloga | Po prijavi |
|---|---|---|
| `ana.novak@example.org` | član | Oprema |
| `nik.zupan@example.org` | član | Oprema |
| `miha.kos@example.org` | skrbnik opreme | Rezervacije |
| `petra.vidmar@example.org` | administrator | Uporabniki |
| `sara.petek@example.org` | član, deaktiviran | prijava je zavrnjena |

## Testi

```bash
cd backend
npm test
```

Trenutno je 34 testov (`node:test` in `supertest`). Preverjajo API proti sprejemnim kriterijem US-01 in US-02, začetne podatke, datume po ljubljanskem času in trajnost baze. Vsak test dobi svojo bazo v pomnilniku in nadzorovan današnji dan, zato se lokalne baze ne dotakne. Katere kriterije pokriva kateri test, je v [05 – Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md#stanje-preverjanja).

## Tehnologije

- Frontend: HTML, CSS in JavaScript brez ogrodja in brez koraka gradnje; pisava Google Sans Flex (licenca OFL) je priložena v `frontend/fonts/`, zato aplikacija ne kliče zunanjih strežnikov
- Backend: Node.js, Express 5, REST API z JSON; isti strežnik streže tudi frontend
- Podatkovna baza: SQLite (`better-sqlite3`)
- Avtentikacija: seja s piškotkom (`express-session`), gesla zgoščena s `scrypt` in naključno soljo
- Testi: `node:test` in `supertest`
- Razvoj: Git, GitHub, GitHub Flow

## Struktura

- `backend/src/` – strežnik: `app.js` (seja, prijava, pravice), `oprema.js`, `rezervacije.js` in `uporabniki.js` (poti API), `baza.js` in `shema.sql` (SQLite), `zacetniPodatki.js` in `seed.js` (začetni podatki)
- `backend/test/` – testi
- `frontend/` – strani HTML z enim skupnim slogom (`slog.css`) in skupnimi funkcijami (`skupno.js`); v `frontend/fonts/` sta pisava in njena licenca
- `docs/` – zasnova, uporabniške zgodbe, wireframi in arhitekturne odločitve

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

Projekt sledi GitHub Flow: vsaka sprememba nastane na svoji veji in pride v `main` prek pull requesta, ki je povezan z nalogami (Issues) na Project boardu. Veja `main` je zaščitena: pull request je obvezen (brez zahtevanih odobritev), force push in brisanje veje nista dovoljena, pravila veljajo tudi za administratorja.
