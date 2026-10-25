# 0003 Backend v Node.js in Expressu z REST API

- Status: sprejeto
- Datum: 2026-10-26

## Kontekst in problem

Potrebujemo strežnik, ki preverja prijavo in vlogo, izvaja poslovna pravila rezervacij in shranjuje podatke v bazo. Projekt dela en študent, ki frontend piše v JavaScriptu. Kateri jezik in ogrodje izbrati za backend?

## Obravnavane možnosti

* Node.js z Expressom, REST API v obliki JSON.
* Python s Flaskom.
* Java s Spring Bootom.

## Odločitev

Izbrana možnost: "Node.js z Expressom", ker ima projekt tako en jezik (JavaScript) za frontend in backend, Express pa je majhno, dobro dokumentirano ogrodje, s katerim API postavimo brez veliko nastavitev.

### Posledice

* Dobro, ker je za ves projekt potreben en jezik in eno orodje za pakete (npm).
* Dobro, ker Express ne vsiljuje dodatnih plasti, zato projekt ostane majhen.
* Slabo, ker Express ne vsiljuje strukture; red med potmi, pravili in dostopom do baze moramo vzdrževati sami.
* Slabo, ker JavaScript nima statičnih tipov; napake v podatkih zaznamo šele pri izvajanju ali v testih.
