# 0001 Ena spletna aplikacija z lokalnim zagonom

- Status: sprejeto
- Datum: 2026-10-26

## Kontekst in problem

Opremnica potrebuje uporabniški vmesnik, strežniški del in bazo. Projekt razvija en študent, zaslonov je malo, aplikacija teče lokalno. Kako sistem razdelimo na dele in kako ga zaženemo? Odločitev velja za mapi `frontend/` in `backend/` ter za lokalni zagon.

## Obravnavane možnosti

* Ena aplikacija: Express streže REST API in statične datoteke frontenda, zagon z `npm start`.
* Dve ločeni aplikaciji: frontend na svojem razvojnem strežniku (npr. Vite) in ločen API na drugih vratih.
* Ločene storitve (rezervacije, oprema, uporabniki) v kontejnerjih z Docker Compose.

## Odločitev

Izbrana možnost: "Ena aplikacija", ker za majhen projekt z enim razvijalcem zadoščata en proces in en ukaz za zagon, isti izvor pa poenostavi piškotek seje in odpravi nastavitve CORS.

### Posledice

* Dobro, ker se celotna rešitev zažene z enim ukazom in ni treba usklajevati več procesov.
* Dobro, ker frontend in API delita isti izvor (`localhost:3000`), zato piškotek seje deluje brez dodatnih nastavitev.
* Slabo, ker frontenda in backenda ni mogoče ločeno postaviti ali skalirati; ob večji rasti bi bilo treba sistem razdeliti.
* Slabo, ker brez kontejnerja okolje ni povsem enako na vseh računalnikih; različico Node.js je treba uskladiti ročno.
