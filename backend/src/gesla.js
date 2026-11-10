import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// geslo -> 'sol:zgoščena vrednost' (oboje hex); sol je za vsako geslo druga
export function zgostiGeslo(geslo) {
  const sol = randomBytes(16);
  return sol.toString('hex') + ':' + scryptSync(geslo, sol, 64).toString('hex');
}

export function preveriGeslo(geslo, shranjeno) {
  const [sol, zgosceno] = shranjeno.split(':').map((del) => Buffer.from(del, 'hex'));
  return timingSafeEqual(scryptSync(geslo, sol, 64), zgosceno);
}
