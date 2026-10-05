import { earthRadius } from './constants.js';
const SUN_RADIUS = 695700;
const KM_PER_AU = 149597870.69098932;
function vecLength(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}
function vecDot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function vecNegate(v) {
    return [
        -v[0],
        -v[1],
        -v[2]
    ];
}
function vecNormalize(v) {
    const len = vecLength(v);
    return [
        v[0] / len,
        v[1] / len,
        v[2] / len
    ];
}
function vecScale(v, s) {
    return [
        v[0] * s,
        v[1] * s,
        v[2] * s
    ];
}
export function shadowFraction(sunEciAU, satelliteEciKm) {
    const sunECIinKM = vecScale([
        sunEciAU.x,
        sunEciAU.y,
        sunEciAU.z
    ], KM_PER_AU);
    const antisolar = vecNormalize(vecNegate(sunECIinKM));
    const positionVec = [
        satelliteEciKm.x,
        satelliteEciKm.y,
        satelliteEciKm.z
    ];
    const positionLength = vecLength(positionVec);
    const positionAndAntisolarDot = vecDot(positionVec, antisolar);
    if (positionAndAntisolarDot <= 0) {
        return 0;
    }
    const rE = Math.asin(earthRadius / positionLength);
    const rS = Math.asin(SUN_RADIUS / vecLength(sunECIinKM));
    const d = Math.acos(positionAndAntisolarDot / positionLength);
    if (d <= rE - rS) {
        return 1;
    }
    if (d >= rE + rS) {
        return 0;
    }
    const part1 = rS * rS * Math.acos((d * d + rS * rS - rE * rE) / (2 * d * rS));
    const part2 = rE * rE * Math.acos((d * d + rE * rE - rS * rS) / (2 * d * rE));
    const part3 = 0.5 * Math.sqrt((-d + rS + rE) * (d + rS - rE) * (d - rS + rE) * (d + rS + rE));
    const overlapArea = part1 + part2 - part3;
    const sunDiscArea = Math.PI * rS * rS;
    return overlapArea / sunDiscArea;
}
