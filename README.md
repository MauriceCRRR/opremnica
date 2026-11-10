# Opremnica

Spletna rešitev za izposojo opreme v študentskem društvu. Član vidi, kdaj je kos opreme prost, in ga rezervira. Skrbnik opreme rezervacijo odobri ali zavrne ter evidentira prevzem in vračilo. Sistem ne dovoli dveh rezervacij istega kosa v prekrivajočem se terminu. Administrator vidi pregled uporabniških računov in vlog.

Projekt pri predmetu Razvoj informacijskih rešitev in storitev (RIRS), UM FERI, 2026/27. Avtor: Maurice Čižič Rottner.

## Stanje

MVP je narejen: vseh šest zgodb US-01 do US-06 ([05 – Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md)) deluje in aplikacijo je mogoče lokalno zagnati.

| Zgodba | Stanje |
|---|---|
| US-01 Prijava in dostop po vlogi | narejeno |
| US-02 Pregled opreme in razpoložljivosti | narejeno |
| US-03 Oddaja rezervacije s preverjanjem prekrivanja | narejeno |
| US-04 Odobritev ali zavrnitev rezervacije | narejeno |
| US-05 Evidentiranje prevzema | narejeno |
| US-06 Evidentiranje vračila in stanja kosa | narejeno |

Kaj deluje:

- prijava in odjava; član pride na *Oprema*, skrbnik na *Rezervacije*, administrator na *Uporabniki*,
- pregled opreme s filtrom po kategoriji in terminu ter razpoložljivostjo »Prost«, »Zaseden v terminu« ali »V popravilu«,
- pri prostem kosu gumb *Rezerviraj*: rezervacija za prikazani termin se shrani kot ODDANA in termin takoj zadrži. Termin se lahko začne od danes do 60 dni vnaprej in traja največ 14 dni; prekrivanje z drugo aktivno rezervacijo istega kosa sistem zavrne. Zase lahko rezervirajo vse tri vloge,
- *Moje rezervacije*: lastne rezervacije s stanjem, razlogom zavrnitve ali preklica in morebitno zamudo; oddano ali odobreno rezervacijo lahko lastnik prekliče,
- skrbnik v seznamu *Čakajoče* (od najstarejše) rezervacijo odobri ali z obveznim razlogom zavrne; zapišeta se skrbnik in čas,
- skrbnik v seznamu *Za prevzem* evidentira prevzem. Ta je mogoč samo v rezerviranem terminu, za uporaben kos in če kos ni še pri prejšnjem članu; sicer sistem pove, zakaj ne,
- skrbnik v seznamu *Izposojeno* evidentira vračilo in izbere »brez poškodb« ali »potrebuje popravilo« (z obvezno opombo). Vrnjen kos je takoj spet prost, kos v popravilu pa ni na voljo. Zamudo sistem izračuna iz datumov in je ne shranjuje,
- če gre kos v popravilo, skrbnik dobi seznam njegovih še neizpeljanih rezervacij in jih z razlogom zavrne ali prekliče,
- administrator vidi seznam računov, samo za branje. Računi se naložijo z začetnimi podatki.

### Kaj ni del MVP

Zgodbe US-07 do US-12 niso narejene. Iz njih je samo tisto, kar šest zgodb MVP potrebuje:

- del US-07: lastnik prekliče svojo rezervacijo pred prevzemom, skrbnik pa tujo odobreno rezervacijo z razlogom,
- del US-08: seznam lastnih rezervacij z razlogom in zamudo, brez izbire aktivne/pretekle.

Urejanja opreme in kategorij (US-09), upravljanja uporabnikov (US-10), ločenega seznama zamujenih vračil (US-11) in zgodovine izposoj kosa (US-12) ni. Zato kosa, ki je šel v popravilo, v aplikaciji še ni mogoče označiti kot popravljenega; za nov preizkus ponastavi začetne podatke (glej spodaj).

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

### Demonstracija celotne poti

Na sveže naloženih začetnih podatkih:

1. Prijavi se kot Ana. Na strani *Oprema* pusti termin na današnjem dnevu in pri FOTO-02 pritisni *Rezerviraj*, nato *Oddaj rezervacijo*. V *Moje rezervacije* je rezervacija v stanju ODDANA.
2. Prijavi se kot Miha. V seznamu *Čakajoče* pri Anini rezervaciji pritisni *Odobri*. Ker se termin začne danes, se rezervacija pokaže v seznamu *Za prevzem*.
3. Pritisni *Evidentiraj prevzem*. Rezervacija je zdaj v seznamu *Izposojeno*.
4. Pritisni *Evidentiraj vračilo*, pusti »brez poškodb« in potrdi. FOTO-02 je na strani *Oprema* takoj spet prost.
5. Zamuda in poškodba: KOLO-01 je v začetnih podatkih pri Niku in bi moral biti vrnjen včeraj, zato ima opozorilo »Zamuda 1 dan«. Pri vračilu izberi »potrebuje popravilo« in vpiši opombo. Kos je na strani *Oprema* »V popravilu« in ga ni več mogoče rezervirati.
6. Prizadete rezervacije: če pred korakom 5 kot Ana rezerviraš KOLO-01 za prihodnji teden in jo Miha odobri, se po vračilu s poškodbo pokaže seznam *Rezervacije kosa v popravilu*. Miha jo prekliče z razlogom, Ana pa razlog vidi v *Moje rezervacije*.

## Testi

```bash
cd backend
npm test
```

Trenutno je 90 testov (`node:test` in `supertest`). Preverjajo API proti sprejemnim kriterijem US-01 do US-06 (tudi robne dneve termina, natanko 14 in 60 dni, hkratni oddaji, ponovljene odločitve, prevzem zunaj termina in nevrnjenega kosa, zamudo čez premik ure, ponovno vračilo), začetne podatke, datume po ljubljanskem času in trajnost celotne poti po ponovnem zagonu. Vsak test dobi svojo bazo v pomnilniku in nadzorovan današnji dan, zato se lokalne baze ne dotakne. Katere kriterije pokriva kateri test, je v [05 – Uporabniške zgodbe](docs/05-uporabniske-zgodbe.md#stanje-preverjanja).

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
