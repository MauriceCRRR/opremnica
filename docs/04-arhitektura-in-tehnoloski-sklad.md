# 04 – Arhitektura in tehnološki sklad

> **Stanje:** arhitektura je postavljena in aplikacijo je mogoče lokalno zagnati. Izvedena sta prva dva sklopa MVP: prijava in dostop po vlogi (US-01), pregled opreme in razpoložljivosti (US-02), oddaja rezervacije (US-03) ter odobritev ali zavrnitev (US-04). Prevzem in vračilo (US-05 in US-06) sta še **načrtovana**. Pri posameznih delih spodaj je označeno, kaj je izvedeno.

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

Glavne poti API:

| Pot | Kdo | Namen | Stanje |
|---|---|---|---|
| `POST /api/prijava`, `POST /api/odjava` | vsi | prijava in odjava (F01) | izvedeno |
| `GET /api/jaz` | prijavljeni | prijavljeni uporabnik in današnji dan (F01) | izvedeno |
| `GET /api/oprema?od=&do=&kategorija=` | prijavljeni | razpoložljivost v terminu (F02) | izvedeno |
| `GET /api/kategorije` | prijavljeni | kategorije za filter (F02) | izvedeno |
| `POST /api/rezervacije` | prijavljeni | oddaja rezervacije (F03) | izvedeno |
| `GET /api/rezervacije/moje` | prijavljeni | moje rezervacije (F08) | izvedeno kot podpora MVP: lasten seznam s stanjem in razlogom |
| `POST /api/rezervacije/:id/preklic` | lastnik, skrbnik | preklic (F07) | delno: lastnik prekliče svojo rezervacijo pred prevzemom; skrbnikov preklic z razlogom še ni narejen |
| `GET /api/rezervacije` | skrbnik | seznami za obdelavo in zamude (F04–F06, F11) | izvedeno za F04: vse aktivne rezervacije, čakajoče od najstarejše; zaslon jih razdeli po stanju |
| `POST /api/rezervacije/:id/odobritev`, `/zavrnitev` | skrbnik | odločitev o čakajoči rezervaciji (F04) | izvedeno |
| `POST /api/rezervacije/:id/prevzem`, `/vracilo` | skrbnik | prevzem in vračilo (F05, F06) | načrtovano |
| `GET/POST/PUT /api/kosi`, `POST/PUT /api/kategorije`, `GET /api/kosi/:id/zgodovina` | skrbnik | oprema in zgodovina (F09, F12) | ni del MVP |
| `GET/POST/PUT /api/uporabniki` | administrator | uporabniki in vloge (F10) | delno: samo seznam računov; urejanje ni del MVP |

Vse poti razen prijave zahtevajo prijavo. Napake imajo obliko `{ "napaka": "sporočilo" }`. Statusi: 400 za neveljaven vnos, 401 brez prijave, 403 za napačno vlogo ali tujo rezervacijo, 404 za neobstoječ kos ali rezervacijo, 409, kadar zahteva ni več mogoča (prekrivanje, kos ni uporaben, rezervacija ni več v pričakovanem stanju).

## Podatkovna baza

Relacijska baza SQLite s tabelami `uporabnik`, `kategorija`, `kos_opreme` in `rezervacija` (glej [03-podatkovni-model.md](03-podatkovni-model.md)). Tuji ključi so vklopljeni (`PRAGMA foreign_keys = ON`). Podatki ostanejo shranjeni tudi po ponovnem zagonu strežnika.

## Avtentikacija in upravljanje uporabnikov

- Račune ustvarja administrator; samoregistracije ni. Prvi administrator se ustvari s skripto z začetnimi podatki.
- Prijava z e-naslovom in geslom. Geslo se shrani kot zgoščena vrednost s funkcijo `scrypt` iz vgrajenega modula `node:crypto` in z naključno soljo.
- Po prijavi strežnik ustvari sejo (`express-session`). Brskalnik dobi piškotek z nastavitvama `HttpOnly` in `SameSite=Lax`.
- Backend pri vsaki zaščiteni zahtevi iz baze prebere uporabnika: brez seje vrne 401, pri napačni vlogi 403. Zato sprememba vloge in deaktivacija veljata takoj.

Vse to je izvedeno. Upravljanje računov prek vmesnika (F10) ni del MVP; administrator zaenkrat vidi samo seznam računov.

## Podrobnosti izvedbe

Manjše odločitve, sprejete med izvedbo. Sklada in ADR ne spreminjajo.

- **Današnji dan** je koledarski dan v Ljubljani (`Europe/Ljubljana`), ne glede na uro in časovni pas strežnika. Časi dogodkov so shranjeni kot lokalni čas, npr. `2026-11-13T17:05:00`. Frontend današnji dan dobi od strežnika in ga ne računa sam. Dnevi se štejejo v UTC, zato premik ure štetja ne spremeni.
- **Deaktiviran račun** dobi sporočilo »Račun je deaktiviran« samo ob pravilnem geslu. Pri napačnem geslu je odgovor enak kot pri neznanem e-naslovu, zato ugibanje ne razkrije, ali račun obstaja.
- **Pregled opreme** nikomur ne vrne podatka o tem, kdo je kos rezerviral; skrbnik člane vidi na svojem seznamu rezervacij. Za iskanje zadoščata veljavna datuma v pravem vrstnem redu; omejitvi P2 in P3 se preverita ob oddaji rezervacije (US-03).
- **Oddaja rezervacije**: lastnik je vedno prijavljeni uporabnik, podatek o članu iz zahteve se ne bere. Zase lahko rezervirajo vse tri vloge (dokument 02). Preverjanje stanja kosa in prekrivanja ter vpis so v eni transakciji SQLite (`BEGIN IMMEDIATE`), zato od dveh hkratnih oddaj za isti kos uspe samo ena.
- **Prehodi stanj** so en sam stavek `UPDATE` s pogojem na trenutno stanje. Ponovljena ali zakasnela odločitev zato ne spremeni ničesar in dobi sporočilo »Rezervacija ni več v stanju ODDANA«.
- **Skrbnik sme odločiti o lastni rezervaciji** (delovna predpostavka P7); zapisano je, kdo je odločil. Vprašanje OPEN-2 naročniku ostaja odprto.
- **Zaslon Oprema** rezervira termin, za katerega je bil seznam izračunan, ne tistega, ki je trenutno vpisan v filter. Seznam se preračuna ob vsaki spremembi filtra.
- **Začetni podatki** se v polno bazo ne vpišejo; ponastavitev je treba zahtevati izrecno (`npm run seed -- --ponastavi`).
- **Testi** uporabljajo svojo bazo v pomnilniku in nadzorovan današnji dan, zato primeri z datumi ne zastarajo.

## Lokalni zagon

Potrebno: Node.js 22.9 ali novejši z npm in Git.

```bash
git clone https://github.com/MauriceCRRR/opremnica.git
cd opremnica/backend
npm ci                  # namesti zaklenjene odvisnosti
cp .env.example .env    # v .env vpiši SESSION_SECRET
npm run seed            # ustvari bazo in začetne podatke
npm start               # aplikacija na http://localhost:3000
npm test                # samodejni testi
```

Skrivnost za podpisovanje sej (`SESSION_SECRET`) je v datoteki `backend/.env`, ki je v `.gitignore`; brez nje se strežnik ne zažene. Podrobnejši koraki in testni računi so v datoteki README.

## Tehnološki sklad

| Del | Tehnologija | Stanje |
|---|---|---|
| Frontend | HTML, CSS, JavaScript brez ogrodja, `fetch` | izvedeno za US-01 do US-04 |
| Backend | Node.js (LTS), Express 5, REST API z JSON | izvedeno za US-01 do US-04 |
| Podatkovna baza | SQLite, knjižnica `better-sqlite3` | izvedeno (vse štiri tabele) |
| Avtentikacija | `express-session` (piškotek seje), `scrypt` iz `node:crypto` | izvedeno |
| Lokalni razvoj | Node.js in npm, urejevalnik kode, brskalnik | vzpostavljeno |
| Testiranje | vgrajeni `node:test` in `supertest` za klice API | izvedeno za US-01 do US-04 (65 testov) |
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
