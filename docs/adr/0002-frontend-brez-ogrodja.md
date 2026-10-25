# 0002 Frontend v HTML, CSS in JavaScriptu brez ogrodja

- Status: sprejeto
- Datum: 2026-10-26

## Kontekst in problem

Uporabniški vmesnik ima nekaj preprostih zaslonov: oprema in rezervacija, moje rezervacije, obdelava rezervacij, urejanje opreme in uporabniki (glej wireframe WF-01 do WF-03). Večinoma gre za obrazce in tabele. S čim naj izdelamo frontend, da ostane razumljiv in brez nepotrebnih orodij?

## Obravnavane možnosti

* HTML, CSS in JavaScript brez ogrodja, podatki prek `fetch` iz REST API.
* React kot enostranska aplikacija z orodjem za gradnjo.
* Strežniško izrisovanje strani s predlogami (npr. EJS v Expressu).

## Odločitev

Izbrana možnost: "HTML, CSS in JavaScript brez ogrodja", ker so zasloni preprosti, ni koraka gradnje in kodo razume vsak, ki pozna osnove spleta. Ločen REST API (namesto predlog EJS) omogoča, da poslovna pravila preverjamo s klici API neodvisno od vmesnika.

### Posledice

* Dobro, ker frontend nima odvisnosti in gradnje; Express datoteke streže neposredno.
* Dobro, ker je koda kratka in lahko pregledna za zagovor in nadaljnji razvoj.
* Slabo, ker je treba posodabljanje strani (DOM) pisati ročno, zato se lahko koda med zasloni ponavlja.
* Slabo, ker ni gotovih komponent; uporabimo vgrajene elemente HTML, npr. `input type="date"`.
