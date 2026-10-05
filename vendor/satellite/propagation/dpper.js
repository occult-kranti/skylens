import { pi, twoPi } from '../constants.js';
export function dpper(satrec, options) {
    const { e3, ee2, peo, pgho, pho, pinco, plo, se2, se3, sgh2, sgh3, sgh4, sh2, sh3, si2, si3, sl2, sl3, sl4, t, xgh2, xgh3, xgh4, xh2, xh3, xi2, xi3, xl2, xl3, xl4, zmol, zmos } = satrec;
    const { init, opsmode } = options;
    let { ep, inclp, nodep, argpp, mp } = options;
    let alfdp;
    let betdp;
    let cosip;
    let sinip;
    let cosop;
    let sinop;
    let dalf;
    let dbet;
    let dls;
    let f2;
    let f3;
    let pe;
    let pgh;
    let ph;
    let pinc;
    let pl;
    let sinzf;
    let xls;
    let xnoh;
    let zf;
    let zm;
    const zns = 1.19459e-5;
    const zes = 0.01675;
    const znl = 1.5835218e-4;
    const zel = 0.0549;
    zm = zmos + zns * t;
    if (init === 'y') {
        zm = zmos;
    }
    zf = zm + 2.0 * zes * Math.sin(zm);
    sinzf = Math.sin(zf);
    f2 = 0.5 * sinzf * sinzf - 0.25;
    f3 = -0.5 * sinzf * Math.cos(zf);
    const ses = se2 * f2 + se3 * f3;
    const sis = si2 * f2 + si3 * f3;
    const sls = sl2 * f2 + sl3 * f3 + sl4 * sinzf;
    const sghs = sgh2 * f2 + sgh3 * f3 + sgh4 * sinzf;
    const shs = sh2 * f2 + sh3 * f3;
    zm = zmol + znl * t;
    if (init === 'y') {
        zm = zmol;
    }
    zf = zm + 2.0 * zel * Math.sin(zm);
    sinzf = Math.sin(zf);
    f2 = 0.5 * sinzf * sinzf - 0.25;
    f3 = -0.5 * sinzf * Math.cos(zf);
    const sel = ee2 * f2 + e3 * f3;
    const sil = xi2 * f2 + xi3 * f3;
    const sll = xl2 * f2 + xl3 * f3 + xl4 * sinzf;
    const sghl = xgh2 * f2 + xgh3 * f3 + xgh4 * sinzf;
    const shll = xh2 * f2 + xh3 * f3;
    pe = ses + sel;
    pinc = sis + sil;
    pl = sls + sll;
    pgh = sghs + sghl;
    ph = shs + shll;
    if (init === 'n') {
        pe -= peo;
        pinc -= pinco;
        pl -= plo;
        pgh -= pgho;
        ph -= pho;
        inclp += pinc;
        ep += pe;
        sinip = Math.sin(inclp);
        cosip = Math.cos(inclp);
        if (inclp >= 0.2) {
            ph /= sinip;
            pgh -= cosip * ph;
            argpp += pgh;
            nodep += ph;
            mp += pl;
        } else {
            sinop = Math.sin(nodep);
            cosop = Math.cos(nodep);
            alfdp = sinip * sinop;
            betdp = sinip * cosop;
            dalf = ph * cosop + pinc * cosip * sinop;
            dbet = -ph * sinop + pinc * cosip * cosop;
            alfdp += dalf;
            betdp += dbet;
            nodep %= twoPi;
            if (nodep < 0.0 && opsmode === 'a') {
                nodep += twoPi;
            }
            xls = mp + argpp + cosip * nodep;
            dls = pl + pgh - pinc * nodep * sinip;
            xls += dls;
            xnoh = nodep;
            nodep = Math.atan2(alfdp, betdp);
            if (nodep < 0.0 && opsmode === 'a') {
                nodep += twoPi;
            }
            if (Math.abs(xnoh - nodep) > pi) {
                if (nodep < xnoh) {
                    nodep += twoPi;
                } else {
                    nodep -= twoPi;
                }
            }
            mp += pl;
            argpp = xls - mp - cosip * nodep;
        }
    }
    return {
        ep,
        inclp,
        nodep,
        argpp,
        mp
    };
}
