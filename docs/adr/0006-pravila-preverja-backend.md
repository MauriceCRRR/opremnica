# 0006 Poslovna pravila preverja backend

- Status: sprejeto
- Datum: 2026-10-26

## Kontekst in problem

Jedro Opremnice so pravila: dve aktivni rezervaciji istega kosa ne smeta imeti skupnega dne, dovoljeni so samo določeni prehodi stanj, dejanja skrbnika lahko izvede samo skrbnik. Evidentirano vračilo (`VRNJENA`) kos takoj sprosti, zamuda pa se izračuna iz datumov. Frontend lahko kaj preveri vnaprej, vendar lahko uporabnik API pokliče mimo njega, dva uporabnika pa lahko rezervirata hkrati. Kje naj bodo ta pravila?

## Obravnavane možnosti

* Pravila na enem mestu v backendu; preverjanje prekrivanja in zapis rezervacije v isti transakciji.
* Pravila v frontendu in backendu (podvojena).
* Pravila v bazi s prožilci (triggerji).

## Odločitev

Izbrana možnost: "Pravila na enem mestu v backendu", ker je tako en vir resnice, pravil ni mogoče obiti z neposrednim klicem API in jih lahko preverimo s klici API (načrtovani sprejemni primeri T1–T8 v 05-uporabniske-zgodbe.md). Frontend samo prikaže sporočila, ki jih vrne backend.

### Posledice

* Dobro, ker so pravila na enem mestu, zato jih je lažje spremeniti in testirati.
* Dobro, ker transakcija prepreči, da bi dve hkratni zahtevi rezervirali isti kos za prekrivajoč se termin.
* Dobro, ker se razpoložljivost in zamuda vedno izračunata iz trenutnega stanja rezervacij, zato ne moreta zastareti.
* Slabo, ker uporabnik nekatere napake vidi šele po oddaji obrazca.
* Slabo, ker baza sama ne prepreči prekrivanja; če bi kdo pisal v bazo mimo backenda, pravilo ne bi veljalo.
