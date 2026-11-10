import { ustvariApp } from './app.js';
import { odpriBazo } from './baza.js';

const skrivnost = process.env.SESSION_SECRET;
if (!skrivnost) {
  console.error('Manjka SESSION_SECRET. Kopiraj .env.example v .env in vpiši svojo skrivnost (glej README).');
  process.exit(1);
}

const baza = odpriBazo();
if (baza.prepare('SELECT COUNT(*) AS n FROM uporabnik').get().n === 0) {
  console.log('Baza je prazna, prijava ne bo mogoča. Najprej zaženi: npm run seed');
}

const vrata = process.env.PORT || 3000;
ustvariApp({ baza, skrivnost }).listen(vrata, () => {
  console.log(`Opremnica teče na http://localhost:${vrata}`);
});
