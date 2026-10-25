# 04 – Arhitektura in tehnološki sklad

> **Stanje:** vse v tem dokumentu je **načrtovano**. Aplikacija še ni implementirana; mapi `frontend/` in `backend/` sta prazni. Narejeni so samo dokumentacija, wireframi, ADR in repozitorij na GitHubu.

## Glavni deli sistema

1. **Frontend** – statične strani HTML, CSS in JavaScript, ki tečejo v brskalniku. Prikažejo zaslone (glej wireframe) in kličejo API z `fetch`.
2. **Backend** – ena aplikacija Node.js z Expressom. Ponuja REST API v obliki JSON, preverja prijavo, vlogo in poslovna pravila (prekrivanje terminov, dovoljeni prehodi stanj). Isti strežnik streže tudi statične datoteke frontenda.
3. **Podatkovna baza** – SQLite, ena datoteka (npr. `backend/data/opremnica.sqlite`), ki ni shranjena v Gitu.

## Komunikacija in diagram

```text
+------------------------+   HTTP + JSON, piškotek seje   +---------------------------+
|  Brskalnik             | -----------------------------> |  Node.js + Express        |
|  HTML, CSS, JavaScript | <----------------------------- |  REST API, pravila, seje  |
+------------------------+   odgovori JSON in statične    +---------------------------+
                             datoteke frontenda                        |
                                                                       | SQL (better-sqlite3),
                                                                       | transakcije
                                                                       v
                                                          +---------------------------+
                                                          |  SQLite: opremnica.sqlite |
                                                          +---------------------------+
```

- Brskalnik in backend tečeta na istem izvoru (`http://localhost:3000`), zato ni potrebe po nastavitvah CORS.
- Backend do baze dostopa s knjižnico `better-sqlite3`. Preverjanje prekrivanja in zapis rezervacije potekata v eni transakciji.

Glavne načrtovane poti API:

| Pot | Kdo | Namen |
|---|---|---|
| `POST /api/prijava`, `POST /api/odjava` | vsi | prijava in odjava (F01) |
| `GET /api/oprema?od=&do=&kategorija=` | prijavljeni | razpoložljivost v terminu (F02) |
| `POST /api/rezervacije` | prijavljeni | oddaja rezervacije (F03) |
| `GET /api/rezervacije/moje` | prijavljeni | moje rezervacije (F08) |
| `POST /api/rezervacije/:id/preklic` | lastnik, skrbnik | preklic (F07) |
| `GET /api/rezervacije?stanje=` | skrbnik | seznami za obdelavo in zamude (F04–F06, F11) |
| `POST /api/rezervacije/:id/odobritev`, `/zavrnitev`, `/prevzem`, `/vracilo` | skrbnik | prehodi stanj (F04–F06) |
| `GET/POST/PUT /api/kosi`, `/api/kategorije`, `GET /api/kosi/:id/zgodovina` | skrbnik | oprema in zgodovina (F09, F12) |
| `GET/POST/PUT /api/uporabniki` | administrator | uporabniki in vloge (F10) |

## Podatkovna baza

Relacijska baza SQLite s tabelami `uporabnik`, `kategorija`, `kos_opreme` in `rezervacija` (glej [03-podatkovni-model.md](03-podatkovni-model.md)). Tuji ključi so vklopljeni (`PRAGMA foreign_keys = ON`). Podatki ostanejo shranjeni tudi po ponovnem zagonu strežnika.

## Avtentikacija in upravljanje uporabnikov

- Račune ustvarja administrator; samoregistracije ni. Prvi administrator se ustvari s skripto z začetnimi podatki.
- Prijava z e-naslovom in geslom. Geslo se shrani kot zgoščena vrednost s funkcijo `scrypt` iz vgrajenega modula `node:crypto` in z naključno soljo.
- Po prijavi strežnik ustvari sejo (`express-session`). Brskalnik dobi piškotek z nastavitvama `HttpOnly` in `SameSite=Lax`.
- Backend pri vsaki zaščiteni zahtevi iz baze prebere uporabnika: brez seje vrne 401, pri napačni vlogi 403. Zato sprememba vloge in deaktivacija veljata takoj.

## Lokalni zagon (načrtovan)

Potrebno: Node.js LTS (različica 22 ali novejša), npm in Git. Spodnji ukazi bodo delovali, ko bo backend implementiran; zdaj še ne.

```bash
git clone https://github.com/MauriceCRRR/opremnica.git
cd opremnica/backend
npm install
npm run seed   # ustvari bazo in začetne podatke
npm start      # aplikacija na http://localhost:3000
```

Skrivnost za podpisovanje sej (`SESSION_SECRET`) bo v datoteki `backend/.env`, ki je v `.gitignore`.

## Tehnološki sklad

| Del | Tehnologija | Stanje |
|---|---|---|
| Frontend | HTML, CSS, JavaScript brez ogrodja, `fetch` | načrtovano |
| Backend | Node.js (LTS), Express, REST API z JSON | načrtovano |
| Podatkovna baza | SQLite, knjižnica `better-sqlite3` | načrtovano |
| Avtentikacija | `express-session` (piškotek seje), `scrypt` iz `node:crypto` | načrtovano |
| Lokalni razvoj | Node.js in npm, urejevalnik kode, brskalnik | načrtovano |
| Testiranje | vgrajeni `node:test` in `supertest` za klice API | načrtovano |
| Različice in proces | Git, GitHub, GitHub Flow, zaščitena veja `main` | vzpostavljeno |
| Dokumentacija | Markdown, Mermaid, PNG wireframi | vzpostavljeno |

## Arhitekturne odločitve

| # | Odločitev | Kratek razlog | ADR |
|---|---|---|---|
| O1 | Ena spletna aplikacija: Express streže API in frontend; lokalni zagon z npm, brez kontejnerjev | majhen projekt, en razvijalec, en ukaz za zagon, isti izvor brez CORS | 0001 |
| O2 | Frontend brez ogrodja (HTML, CSS, JavaScript) | malo preprostih zaslonov, ni koraka gradnje, koda je lahko razumljiva | 0002 |
| O3 | Backend Node.js in Express z REST API | isti jezik kot frontend, majhno in dobro dokumentirano ogrodje | 0003 |
| O4 | Podatkovna baza SQLite | trajna relacijska baza v eni datoteki, brez strežnika, s transakcijami | 0004 |
| O5 | Prijava s sejo v piškotku in gesli, zgoščenimi s scrypt | preprosta in varna prijava, odjava in deaktivacija veljata takoj, brez dodatne knjižnice za zgoščevanje | 0005 |
| O6 | Poslovna pravila (prekrivanje, prehodi stanj, pravice) preverja backend | frontend je mogoče obiti; ena resnica; transakcija prepreči dvojno rezervacijo | 0006 |

Podrobnejši zapisi odločitev so v mapi `docs/adr/` repozitorija.
