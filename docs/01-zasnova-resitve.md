# 01 – Zasnova rešitve

## Ime rešitve

**Opremnica** – spletna izposoja opreme v študentskem društvu.

## Problem

Študentsko društvo ima skupno opremo, na primer fotoaparate, stative, šotore, zvočnike, projektor in kolesa. Opremo izposoja član društva, ki je zanjo zadolžen (skrbnik opreme). Danes izposoja poteka prek skupinskega klepeta, zasebnih sporočil in zvezka ali deljene tabele.

Posledice takega načina:

- isti kos je lahko obljubljen dvema članoma za isti termin,
- skrbnik nima zanesljivega pregleda, kdo ima kos in do kdaj ga mora vrniti,
- zamude in poškodbe niso zapisane, zato pozneje ni mogoče ugotoviti, kdo je imel kos,
- član mora za vsako vprašanje o prostem terminu pisati skrbniku in čakati na odgovor.

Predpostavljamo manjše društvo z nekaj deset kosi opreme in do nekaj sto člani.

## Namen rešitve

Opremnica na enem mestu vodi opremo in rezervacije:

- član sam vidi, kateri kos je v izbranem terminu prost, in odda rezervacijo,
- sistem ne dovoli dveh rezervacij istega kosa v prekrivajočem se terminu,
- skrbnik rezervacijo odobri ali zavrne ter evidentira prevzem in vračilo,
- za vsak kos je vedno znano, ali je prost, izposojen ali v popravilu, in kdo ga je imel.

## Ciljni uporabniki

| Vloga | Kdo je to | Kaj potrebuje |
|---|---|---|
| Član | študent, član društva | hitro najti prost kos in ga rezervirati brez dopisovanja |
| Skrbnik opreme | član, ki skrbi za opremo in prostor z opremo | pregled čakajočih rezervacij, zapis prevzema in vračila, stanje kosov |
| Administrator | predsednik ali tajnik društva | upravljanje uporabniških računov in vlog |

Vloge so podrobno opisane v [02-funkcionalnosti-in-obseg.md](02-funkcionalnosti-in-obseg.md).

## Kratek opis delovanja (scenarij)

1. Administratorka Petra je članici Ani ustvarila račun z vlogo član.
2. Ana v sredo, 11. 11. 2026, načrtuje fotografiranje na izletu od petka 13. 11. do ponedeljka 16. 11. Prijavi se, izbere kategorijo *Fotografija* in termin 13.–16. 11.
3. Sistem pokaže, da je fotoaparat FOTO-01 v tem terminu zaseden, FOTO-02 pa prost.
4. Ana odda rezervacijo za FOTO-02 z namenom »izlet foto sekcije«. Rezervacija je v stanju **ODDANA** in termin je za druge člane zaseden.
5. Skrbnik Miha zvečer vidi čakajočo rezervacijo in jo odobri. Ana v svojih rezervacijah vidi stanje **ODOBRENA**.
6. V petek Ana pride v prostor društva. Miha ji preda fotoaparat in evidentira prevzem. Stanje je **PREVZETA**.
7. V ponedeljek Ana fotoaparat vrne. Miha evidentira vračilo in izbere »brez poškodb«. Stanje je **VRNJENA**, kos je spet na voljo.

Če bi Ana fotoaparat poškodovala, bi Miha pri vračilu kos označil kot *v popravilu*. Do popravila ga nihče ne bi mogel rezervirati.
