import { j2, twoPi, x2o3, xke } from '../constants.js';
import { gstime } from './gstime.js';
export function initl(options) {
    const { ecco, epoch, inclo, opsmode } = options;
    let { no } = options;
    const eccsq = ecco * ecco;
    const omeosq = 1.0 - eccsq;
    const rteosq = Math.sqrt(omeosq);
    const cosio = Math.cos(inclo);
    const cosio2 = cosio * cosio;
    const ak = (xke / no) ** x2o3;
    const d1 = 0.75 * j2 * (3.0 * cosio2 - 1.0) / (rteosq * omeosq);
    let delPrime = d1 / (ak * ak);
    const adel = ak * (1.0 - delPrime * delPrime - delPrime * (1.0 / 3.0 + 134.0 * delPrime * delPrime / 81.0));
    delPrime = d1 / (adel * adel);
    no /= 1.0 + delPrime;
    const ao = (xke / no) ** x2o3;
    const sinio = Math.sin(inclo);
    const po = ao * omeosq;
    const con42 = 1.0 - 5.0 * cosio2;
    const con41 = -con42 - cosio2 - cosio2;
    const ainv = 1.0 / ao;
    const posq = po * po;
    const rp = ao * (1.0 - ecco);
    const method = 'n';
    let gsto;
    if (opsmode === 'a') {
        const ts70 = epoch - 7305.0;
        const ds70 = Math.floor(ts70 + 1.0e-8);
        const tfrac = ts70 - ds70;
        const c1 = 1.72027916940703639e-2;
        const thgr70 = 1.7321343856509374;
        const fk5r = 5.07551419432269442e-15;
        const c1p2p = c1 + twoPi;
        gsto = (thgr70 + c1 * ds70 + c1p2p * tfrac + ts70 * ts70 * fk5r) % twoPi;
        if (gsto < 0.0) {
            gsto += twoPi;
        }
    } else {
        gsto = gstime(epoch + 2433281.5);
    }
    return {
        no,
        method,
        ainv,
        ao,
        con41,
        con42,
        cosio,
        cosio2,
        eccsq,
        omeosq,
        posq,
        rp,
        rteosq,
        sinio,
        gsto
    };
}
