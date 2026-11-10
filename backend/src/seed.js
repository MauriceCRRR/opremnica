// npm run seed                 -> vpiše začetne podatke v prazno bazo
// npm run seed -- --ponastavi  -> POBRIŠE vse podatke in jih vpiše na novo
import { odpriBazo, POT_BAZE } from './baza.js';
import { danes } from './datumi.js';
import { vpisiZacetnePodatke, TESTNO_GESLO } from './zacetniPodatki.js';

const baza = odpriBazo();
const vpisano = vpisiZacetnePodatke(baza, danes(new Date()), process.argv.includes('--ponastavi'));
baza.close();

if (vpisano) {
  console.log(`Začetni podatki so v ${POT_BAZE}. Geslo testnih računov: ${TESTNO_GESLO}`);
} else {
  console.log('Baza že ima podatke, zato je nisem spreminjal.');
  console.log('Če jo res želiš pobrisati in naložiti na novo: npm run seed -- --ponastavi');
}
