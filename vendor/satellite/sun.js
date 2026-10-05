import { deg2rad, pi, twoPi } from './constants.js';
export function sunPos(jday) {
    const tut1 = (jday - 2451545) / 36525;
    const meanlong = (280.46 + 36000.77 * tut1) % 360;
    let meananomaly = (357.5277233 + 35999.05034 * tut1) * deg2rad % twoPi;
    if (meananomaly < 0) {
        meananomaly += twoPi;
    }
    const eclplong_raw = (meanlong + 1.914666471 * Math.sin(meananomaly) + 0.019994643 * Math.sin(2.0 * meananomaly)) % 360.0 * deg2rad;
    const obliquity = (23.439291 - 0.0130042 * tut1) * deg2rad;
    const magr = 1.000140612 - 0.016708617 * Math.cos(meananomaly) - 0.000139589 * Math.cos(2.0 * meananomaly);
    const rsun = {
        x: magr * Math.cos(eclplong_raw),
        y: magr * Math.cos(obliquity) * Math.sin(eclplong_raw),
        z: magr * Math.sin(obliquity) * Math.sin(eclplong_raw)
    };
    const rtasc_raw = Math.atan(Math.cos(obliquity) * Math.tan(eclplong_raw));
    let eclplong = eclplong_raw;
    if (eclplong < 0.0) {
        eclplong += twoPi;
    }
    let rtasc = rtasc_raw;
    if (Math.abs(eclplong_raw - rtasc) > pi * 0.5) {
        rtasc += 0.5 * pi * Math.round((eclplong_raw - rtasc_raw) / (0.5 * pi));
    }
    const decl = Math.asin(Math.sin(obliquity) * Math.sin(eclplong_raw));
    return {
        rsun,
        rtasc,
        decl
    };
}
