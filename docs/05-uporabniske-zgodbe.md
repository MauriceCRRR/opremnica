# 05 – Uporabniške zgodbe

Za vsako od 12 funkcionalnosti (F01–F12 iz dokumenta 02-funkcionalnosti-in-obseg.md) je ena zgodba. Zgodbe US-01 do US-06 sodijo v MVP. Vsaka zgodba ima 3–5 sprejemnih kriterijev, ki jih je mogoče preveriti.

## Skupni pojmi

- **Termin** – od datuma od do datuma do, v celih dneh; oba dneva sta vključena.
- **Aktivna rezervacija** – rezervacija v stanju `ODDANA`, `ODOBRENA` ali `PREVZETA`. Samo aktivne rezervacije zasedajo termin. Rezervacija `VRNJENA` ni aktivna, zato sta dan vračila in morebitni preostali dnevi termina takoj prosti.
- **Prekrivanje** – termina A in B se prekrivata, če velja *A.od ≤ B.do* in *B.od ≤ A.do*.
- **Prost kos v terminu** – kos je `UPORABEN` in nima aktivne rezervacije, ki bi se prekrivala s terminom.
- **Zamuda** – kos ni vrnjen do vključno datuma do. Dnevi zamude = dan vračila (ali današnji dan, če kos še ni vrnjen) − datum do. Sistem jih izračuna in prikaže; posebej se ne shranjujejo.
- **Dovoljeni prehodi stanj** – `ODDANA` → `ODOBRENA`, `ZAVRNJENA` ali `PREKLICANA`; `ODOBRENA` → `PREVZETA` ali `PREKLICANA`; `PREVZETA` → `VRNJENA`. Drugih prehodov ni.

## Ključna pravila (EARS)

- **R1** KO uporabnik odda rezervacijo kosa za termin, ki se prekriva z aktivno rezervacijo istega kosa, MORA sistem rezervacijo zavrniti in je ne shraniti.
- **R2** KO uporabnik zahteva prehod stanja, ki ni med dovoljenimi prehodi, MORA sistem zahtevo zavrniti in stanje rezervacije ohraniti.
- **R3** ČE uporabnik brez vloge skrbnika zahteva odobritev, zavrnitev, prevzem ali vračilo, POTEM MORA sistem vrniti napako 403 in stanje rezervacije ohraniti.
- **R4** DOKLER je kos v stanju `V_POPRAVILU` ali `ODPISAN`, MORA sistem zavrniti nove rezervacije in prevzeme tega kosa.
- **R5** KO skrbnik evidentira prevzem, MORA sistem preveriti, da je današnji dan znotraj termina in da kos ni v drugi rezervaciji s stanjem `PREVZETA`.

## Predpostavke in odprta vprašanja

Vrednosti so delovne predpostavke avtorja (PREDPOSTAVKA) in jih društvo še ni potrdilo. Oznake so enake kot v dokumentu 02.

- **P1** Termin je v celih dneh, oba dneva sta vključena. Dve aktivni rezervaciji istega kosa ne smeta imeti skupnega dne.
- **P2** Rezervacija traja največ 14 dni.
- **P3** Datum od ne sme biti v preteklosti in je največ 60 dni od današnjega dne.
- **P5** Termin zasedajo vse aktivne rezervacije; kdor prej odda, ima prednost. Evidentirano vračilo kos takoj sprosti od dneva vračila naprej, tudi pri predčasnem vračilu.
- **P6** Prevzem je mogoč samo znotraj termina; samodejnega preklica ni.
- **OPEN-1** Omejitev števila hkratnih rezervacij na člana še ni določena.
- **OPEN-2** Ni odločeno, ali sme skrbnik odobriti lastno rezervacijo.

---

## US-01 Prijava in dostop po vlogi

- **Funkcionalnost:** F01 Prijava in dostop po vlogi (MVP)
- **Vloga:** uporabnik z računom (član, skrbnik ali administrator)
- **Zgodba:** Kot uporabnik z računom v društvu želim se prijaviti z e-naslovom in geslom, da lahko uporabljam funkcije svoje vloge.

**Sprejemni kriteriji**

1. S pravilnim e-naslovom in geslom aktivnega računa je uporabnik prijavljen in preusmerjen na začetni zaslon svoje vloge: član na *Oprema*, skrbnik na *Rezervacije*, administrator na *Uporabniki*.
2. Pri napačnem e-naslovu ali geslu prijava ne uspe in prikaže se sporočilo »Napačen e-naslov ali geslo«; sistem ne razkrije, kateri podatek je napačen.
3. Deaktiviran račun se ne more prijaviti, tudi s pravilnim geslom.
4. Neprijavljen uporabnik, ki odpre zaščiten zaslon, je preusmerjen na prijavo; zaščiten klic API vrne 401.
5. Po odjavi seja ne velja več; naslednji zaščiten klic API vrne 401.

## US-02 Pregled opreme in razpoložljivosti

- **Funkcionalnost:** F02 Pregled opreme in razpoložljivosti v izbranem terminu (MVP)
- **Vloga:** član
- **Zgodba:** Kot član želim za izbran termin videti, kateri kosi opreme so prosti, da lahko rezerviram brez dopisovanja s skrbnikom.

**Sprejemni kriteriji**

1. Po vnosu datuma od, datuma do in (neobvezno) kategorije sistem prikaže vse kose, ki niso `ODPISAN`, z inventarno oznako, nazivom, kategorijo in razpoložljivostjo »Prost«, »Zaseden v terminu« ali »V popravilu«.
2. Kos je »Prost« natanko takrat, ko je prost kos v terminu po zgornji definiciji.
3. Pri zasedenem kosu član ne vidi, kdo ga je rezerviral.
4. Če je datum do pred datumom od, sistem iskanja ne izvede in prikaže »Datum do ne sme biti pred datumom od«.
5. Gumb »Rezerviraj« je prikazan samo pri prostih kosih.

## US-03 Oddaja rezervacije s preverjanjem prekrivanja

- **Funkcionalnost:** F03 Oddaja rezervacije s preverjanjem prekrivanja (MVP)
- **Vloga:** član
- **Zgodba:** Kot član želim oddati rezervacijo prostega kosa za izbran termin, da je kos v tem terminu zadržan zame.

**Sprejemni kriteriji**

1. Rezervacija prostega kosa z veljavnim terminom se shrani v stanju `ODDANA` in se prikaže v *Moje rezervacije*.
2. (R1) Če se termin prekriva z aktivno rezervacijo istega kosa, se rezervacija ne shrani in prikaže se »Kos je v izbranem terminu že rezerviran«.
3. Sistem zavrne termin, ki se začne v preteklosti, traja več kot 14 dni (P2) ali se začne več kot 60 dni od danes (P3), in v sporočilu navede vzrok.
4. (R4) Sistem zavrne rezervacijo kosa, ki je `V_POPRAVILU` ali `ODPISAN`.
5. Če dva uporabnika hkrati oddata prekrivajoči se rezervaciji istega kosa, se shrani samo prva; drugi dobi sporočilo iz točke 2.

**Robni primeri** – obstoječa rezervacija kosa FOTO-02 za termin 13.–16. 11. 2026:

| Nov termin za FOTO-02 | Stanje obstoječe rezervacije | Rezultat |
|---|---|---|
| 10.–12. 11. | `ODOBRENA` | shranjeno, ni skupnega dne |
| 10.–13. 11. | `ODOBRENA` | zavrnjeno, 13. 11. je skupni dan |
| 16.–18. 11. | `ODDANA` | zavrnjeno, 16. 11. je skupni dan (P1, P5) |
| 14.–15. 11. | `PREVZETA` | zavrnjeno, termin je v celoti znotraj |
| 17.–20. 11. | `ODOBRENA` | shranjeno |
| 13.–16. 11. | `PREKLICANA` ali `ZAVRNJENA` | shranjeno, obstoječa ni aktivna |
| 16.–18. 11. | `VRNJENA` (vrnjeno 16. 11.) | shranjeno, vrnjena rezervacija ni aktivna (P5) |
| 15.–18. 11. | `VRNJENA` (vrnjeno predčasno 15. 11.) | shranjeno, preostali dnevi so prosti (P5) |

## US-04 Odobritev ali zavrnitev rezervacije

- **Funkcionalnost:** F04 Odobritev ali zavrnitev rezervacije (MVP)
- **Vloga:** skrbnik opreme
- **Zgodba:** Kot skrbnik opreme želim oddano rezervacijo odobriti ali zavrniti z razlogom, da član pravočasno ve, ali bo kos dobil.

**Sprejemni kriteriji**

1. Seznam *Čakajoče* prikazuje vse rezervacije v stanju `ODDANA`, razvrščene po času oddaje od najstarejše, s članom, kosom in terminom.
2. Odobritev spremeni stanje v `ODOBRENA` ter zapiše skrbnika in čas odločitve.
3. Zavrnitev brez vpisanega razloga ni mogoča. Z razlogom se stanje spremeni v `ZAVRNJENA`, član razlog vidi v *Moje rezervacije*, termin pa je spet prost.
4. (R2) Če rezervacija ni več `ODDANA` (npr. član jo je vmes preklical), sistem odobritev ali zavrnitev zavrne s sporočilom »Rezervacija ni več v stanju ODDANA« in stanja ne spremeni.
5. (R3) Član ali administrator odobritve ali zavrnitve ne more izvesti; API vrne 403.

## US-05 Evidentiranje prevzema

- **Funkcionalnost:** F05 Evidentiranje prevzema (MVP)
- **Vloga:** skrbnik opreme
- **Zgodba:** Kot skrbnik opreme želim evidentirati prevzem odobrene rezervacije, da je zapisano, kdo ima kos in od kdaj.

**Sprejemni kriteriji**

1. Seznam *Za prevzem* prikazuje rezervacije v stanju `ODOBRENA`, katerih datum od je danes ali prej, razvrščene po datumu od.
2. Evidentiranje prevzema spremeni stanje v `PREVZETA` in zapiše čas prevzema.
3. (R5, P6) Pred datumom od ali po datumu do prevzem ni mogoč; prikaže se »Prevzem je mogoč samo v rezerviranem terminu«.
4. (R5) Če je kos še v drugi rezervaciji s stanjem `PREVZETA`, prevzem ni mogoč; sistem pokaže, pri katerem članu je kos in do kdaj bi ga moral vrniti.
5. (R4) Prevzem kosa v stanju `V_POPRAVILU` ali `ODPISAN` ni mogoč.

## US-06 Evidentiranje vračila in stanja kosa

- **Funkcionalnost:** F06 Evidentiranje vračila in stanja kosa (MVP)
- **Vloga:** skrbnik opreme
- **Zgodba:** Kot skrbnik opreme želim evidentirati vračilo kosa in njegovo stanje, da vem, ali je kos spet na voljo ali potrebuje popravilo.

**Sprejemni kriteriji**

1. Vračilo je mogoče samo pri rezervaciji v stanju `PREVZETA`; stanje postane `VRNJENA` in zapiše se čas vračila. Rezervacija ni več aktivna, zato je kos, ki ostane `UPORABEN`, takoj prost za nove rezervacije od dneva vračila naprej (P5).
2. Skrbnik izbere stanje kosa ob vračilu: »brez poškodb« (kos ostane `UPORABEN`) ali »potrebuje popravilo« (kos postane `V_POPRAVILU`, opomba je obvezna).
3. Če je kos vrnjen po datumu do, sistem izračuna število dni zamude (dan vračila − datum do) in ga prikaže pri rezervaciji; posebej se ne shrani.
4. (R2) Ponovno vračilo že vrnjene rezervacije sistem zavrne in ne spremeni nobenega podatka.
5. Če kos postane `V_POPRAVILU` in ima prihodnje aktivne rezervacije, sistem po shranjevanju pokaže njihov seznam, da jih skrbnik zavrne ali prekliče.

## US-07 Preklic rezervacije pred prevzemom

- **Funkcionalnost:** F07 Preklic rezervacije pred prevzemom
- **Vloga:** član (skrbnik pri preklicu z razlogom)
- **Zgodba:** Kot član želim preklicati svojo rezervacijo, ki je še nisem prevzel, da se termin sprosti za druge člane.

**Sprejemni kriteriji**

1. Član lahko prekliče svojo rezervacijo v stanju `ODDANA` ali `ODOBRENA`; stanje postane `PREKLICANA` in termin je takoj prost.
2. (R2) Preklic rezervacije v stanju `PREVZETA`, `VRNJENA`, `ZAVRNJENA` ali `PREKLICANA` ni mogoč.
3. Član ne more preklicati rezervacije drugega uporabnika; API vrne 403.
4. Skrbnik lahko prekliče odobreno rezervacijo kateregakoli člana samo z vpisanim razlogom (npr. »ni prevzeta v terminu«); član razlog vidi v *Moje rezervacije*.

## US-08 Moje rezervacije

- **Funkcionalnost:** F08 Pregled mojih rezervacij
- **Vloga:** član
- **Zgodba:** Kot član želim videti svoje rezervacije in njihova stanja, da vem, kaj moram prevzeti ali vrniti in do kdaj.

**Sprejemni kriteriji**

1. Seznam prikazuje samo rezervacije prijavljenega uporabnika, z inventarno oznako, nazivom kosa, terminom in stanjem.
2. Privzeto so prikazane aktivne rezervacije, razvrščene po datumu od; izbira »Pretekle« prikaže zavrnjene, preklicane in vrnjene.
3. Pri zavrnjeni rezervaciji in pri rezervaciji, ki jo je preklical skrbnik, je prikazan razlog.
4. Pri rezervaciji `PREVZETA` po datumu do je prikazano opozorilo »Vračilo zamuja N dni«.

## US-09 Upravljanje opreme in kategorij

- **Funkcionalnost:** F09 Upravljanje opreme in kategorij
- **Vloga:** skrbnik opreme
- **Zgodba:** Kot skrbnik opreme želim dodajati in urejati kose opreme in kategorije ter spreminjati stanje kosa, da katalog ustreza dejanski opremi v prostoru.

**Sprejemni kriteriji**

1. Nov kos zahteva naziv, kategorijo in inventarno oznako. Če oznaka že obstaja, se kos ne shrani in prikaže se »Inventarna oznaka že obstaja«.
2. Nov kos dobi stanje `UPORABEN` in je takoj viden v pregledu opreme (US-02).
3. Kosa ni mogoče izbrisati. Skrbnik ga lahko označi kot `ODPISAN`; s tem izgine iz pregleda opreme, njegova zgodovina pa ostane.
4. Kategorije, ki ima vsaj en kos, ni mogoče izbrisati.
5. Ko skrbnik kos označi kot `V_POPRAVILU` ali `ODPISAN`, sistem pokaže prihodnje aktivne rezervacije tega kosa (enako kot pri US-06).

## US-10 Upravljanje uporabnikov in vlog

- **Funkcionalnost:** F10 Upravljanje uporabnikov in vlog
- **Vloga:** administrator
- **Zgodba:** Kot administrator želim ustvarjati račune, dodeliti vloge in deaktivirati račune nekdanjih članov, da do opreme dostopajo samo trenutni člani z ustreznimi pravicami.

**Sprejemni kriteriji**

1. Nov račun zahteva ime, priimek, e-naslov, vlogo in začetno geslo z vsaj 8 znaki. Če e-naslov že obstaja, se račun ne ustvari.
2. Sprememba vloge in deaktivacija veljata takoj: že naslednja zahteva tega uporabnika se preveri z novimi podatki.
3. Računa z aktivnimi rezervacijami ni mogoče deaktivirati; sistem izpiše te rezervacije. Pretekle rezervacije deaktiviranega uporabnika ostanejo shranjene.
4. Administrator ne more spremeniti vloge ali deaktivirati lastnega računa.
5. Član ali skrbnik do upravljanja uporabnikov nima dostopa; API vrne 403.

## US-11 Zamujena vračila

- **Funkcionalnost:** F11 Pregled zamujenih vračil
- **Vloga:** skrbnik opreme
- **Zgodba:** Kot skrbnik opreme želim videti seznam zamujenih vračil, da lahko člane pravočasno opomnim.

**Sprejemni kriteriji**

1. Seznam vsebuje vse rezervacije v stanju `PREVZETA`, katerih datum do je pred današnjim dnem.
2. Pri vsaki so prikazani član (ime in e-naslov), kos, datum do in število dni zamude; razvrščene so od največje zamude.
3. Rezervacija z datumom do enakim današnjemu še ni na seznamu.
4. Ko skrbnik evidentira vračilo, rezervacija izgine s seznama.

## US-12 Zgodovina izposoj kosa

- **Funkcionalnost:** F12 Zgodovina izposoj kosa
- **Vloga:** skrbnik opreme
- **Zgodba:** Kot skrbnik opreme želim videti zgodovino izposoj posameznega kosa, da ugotovim, kdo ga je imel pred odkrito poškodbo.

**Sprejemni kriteriji**

1. Za izbran kos so prikazane vse njegove rezervacije v stanju `PREVZETA` ali `VRNJENA`, od najnovejše.
2. Pri vsaki so prikazani član, termin, čas prevzema, čas vračila, opomba ob vračilu in morebitna zamuda v dneh.
3. Zgodovine ni mogoče urejati ali brisati.
4. Član in administrator do zgodovine kosa nimata dostopa; API vrne 403.

---

## Splošna definicija dokončanosti (DoD)

DoD velja za vse zgodbe. Sprejemni kriteriji zgoraj pa veljajo samo za posamezno zgodbo.

- Sprememba je na svoji veji in je v `main` združena prek pull requesta (GitHub Flow).
- Vsi sprejemni kriteriji zgodbe so preverjeni.
- Poslovna pravila so preverjena v backendu, ne samo v brskalniku.
- Če se je spremenilo pravilo, model ali arhitektura, sta posodobljena dokumentacija in ADR.

## Načrtovani sprejemni primeri

To so primeri za poznejšo implementacijo. **Noben test še ni napisan ali izveden.**

| ID | Primer | Pričakovan rezultat | Zgodba |
|---|---|---|---|
| T1 | Prekrivanje: FOTO-02 ima `ODOBRENO` rezervacijo 13.–16. 11., nova rezervacija za 16.–18. 11. | zavrnjeno, nova rezervacija ni shranjena | US-03 |
| T2 | Nedovoljen prehod: odobritev rezervacije v stanju `ZAVRNJENA` | napaka, stanje ostane `ZAVRNJENA` | US-04 |
| T3 | Brez pravice: član pokliče odobritev | 403, stanje ostane `ODDANA` | US-04 |
| T4 | Vračilo že vrnjene rezervacije | napaka, čas vračila se ne spremeni | US-06 |
| T5 | Neveljaven datum: datum do pred datumom od ali začetek v preteklosti | zavrnjeno s sporočilom o vzroku | US-02, US-03 |
| T6 | Prevzem kosa, ki ga prejšnji član še ni vrnil | zavrnjeno, prikazano, pri kom je kos | US-05 |
| T7 | Trajnost: oddaja rezervacije, ponovni zagon strežnika | rezervacija in njeno stanje sta še vedno v bazi | US-03, US-08 |
| T8 | Dan vračila: FOTO-02 (termin 13.–16. 11.) je vrnjen 16. 11., nova rezervacija za 16.–18. 11. | shranjeno, ker vrnjena rezervacija ni aktivna | US-03, US-06 |
