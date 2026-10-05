import { twoPi } from '../constants.js';
export function dspace(options) {
    const { irez, d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232, d5421, d5433, dedt, del1, del2, del3, didt, dmdt, dnodt, domdt, argpo, argpdot, t, tc, gsto, xfact, xlamo, no } = options;
    let { atime, em, argpm, inclm, xli, mm, xni, nodem, nm } = options;
    const fasx2 = 0.13130908;
    const fasx4 = 2.8843198;
    const fasx6 = 0.37448087;
    const g22 = 5.7686396;
    const g32 = 0.95240898;
    const g44 = 1.8014998;
    const g52 = 1.050833;
    const g54 = 4.4108898;
    const rptim = 4.37526908801129966e-3;
    const stepp = 720.0;
    const stepn = -720.0;
    const step2 = 259200.0;
    let delt;
    let x2li;
    let x2omi;
    let xl;
    let xldot;
    let xnddt;
    let xndt;
    let xomi;
    let dndt = 0.0;
    let ft = 0.0;
    const theta = (gsto + tc * rptim) % twoPi;
    em += dedt * t;
    inclm += didt * t;
    argpm += domdt * t;
    nodem += dnodt * t;
    mm += dmdt * t;
    if (irez !== 0) {
        if (atime === 0.0 || t * atime <= 0.0 || Math.abs(t) < Math.abs(atime)) {
            atime = 0.0;
            xni = no;
            xli = xlamo;
        }
        if (t > 0.0) {
            delt = stepp;
        } else {
            delt = stepn;
        }
        let iretn = 381;
        while(iretn === 381){
            if (irez !== 2) {
                xndt = del1 * Math.sin(xli - fasx2) + del2 * Math.sin(2.0 * (xli - fasx4)) + del3 * Math.sin(3.0 * (xli - fasx6));
                xldot = xni + xfact;
                xnddt = del1 * Math.cos(xli - fasx2) + 2.0 * del2 * Math.cos(2.0 * (xli - fasx4)) + 3.0 * del3 * Math.cos(3.0 * (xli - fasx6));
                xnddt *= xldot;
            } else {
                xomi = argpo + argpdot * atime;
                x2omi = xomi + xomi;
                x2li = xli + xli;
                xndt = d2201 * Math.sin(x2omi + xli - g22) + d2211 * Math.sin(xli - g22) + d3210 * Math.sin(xomi + xli - g32) + d3222 * Math.sin(-xomi + xli - g32) + d4410 * Math.sin(x2omi + x2li - g44) + d4422 * Math.sin(x2li - g44) + d5220 * Math.sin(xomi + xli - g52) + d5232 * Math.sin(-xomi + xli - g52) + d5421 * Math.sin(xomi + x2li - g54) + d5433 * Math.sin(-xomi + x2li - g54);
                xldot = xni + xfact;
                xnddt = d2201 * Math.cos(x2omi + xli - g22) + d2211 * Math.cos(xli - g22) + d3210 * Math.cos(xomi + xli - g32) + d3222 * Math.cos(-xomi + xli - g32) + d5220 * Math.cos(xomi + xli - g52) + d5232 * Math.cos(-xomi + xli - g52) + 2.0 * (d4410 * Math.cos(x2omi + x2li - g44) + d4422 * Math.cos(x2li - g44) + d5421 * Math.cos(xomi + x2li - g54) + d5433 * Math.cos(-xomi + x2li - g54));
                xnddt *= xldot;
            }
            if (Math.abs(t - atime) >= stepp) {
                iretn = 381;
            } else {
                ft = t - atime;
                iretn = 0;
            }
            if (iretn === 381) {
                xli += xldot * delt + xndt * step2;
                xni += xndt * delt + xnddt * step2;
                atime += delt;
            }
        }
        nm = xni + xndt * ft + xnddt * ft * ft * 0.5;
        xl = xli + xldot * ft + xndt * ft * ft * 0.5;
        if (irez !== 1) {
            mm = xl - 2.0 * nodem + 2.0 * theta;
            dndt = nm - no;
        } else {
            mm = xl - nodem - argpm + theta;
            dndt = nm - no;
        }
        nm = no + dndt;
    }
    return {
        atime,
        em,
        argpm,
        inclm,
        xli,
        mm,
        xni,
        nodem,
        dndt,
        nm
    };
}
