import { api, ZACETEK } from './skupno.js';

const obrazec = document.querySelector('#prijava');
const napaka = document.querySelector('#napaka');

// že prijavljen? potem naravnost na svoj začetni zaslon
api('jaz').then((jaz) => location.replace(ZACETEK[jaz.vloga]), () => {});

obrazec.addEventListener('submit', async (dogodek) => {
  dogodek.preventDefault();
  napaka.hidden = true;
  try {
    const { vloga } = await api('prijava', { email: obrazec.email.value, geslo: obrazec.geslo.value });
    location.replace(ZACETEK[vloga]);
  } catch (e) {
    napaka.textContent = e.message;
    napaka.hidden = false;
  }
});
