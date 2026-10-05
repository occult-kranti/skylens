import { deg2rad, twoPi } from '../constants.js';
import { jday } from '../ext.js';
function gstimeInternal(jdut1) {
    const tut1 = (jdut1 - 2451545.0) / 36525.0;
    let temp = -6.2e-6 * tut1 * tut1 * tut1 + 0.093104 * tut1 * tut1 + (876600.0 * 3600 + 8640184.812866) * tut1 + 67310.54841;
    temp = temp * deg2rad / 240.0 % twoPi;
    if (temp < 0.0) {
        temp += twoPi;
    }
    return temp;
}
export function gstime(first, month, day, hour, minute, second, millisecond) {
    if (first instanceof Date) {
        return gstimeInternal(jday(first));
    }
    if (month !== undefined) {
        return gstimeInternal(jday(first, month, day, hour, minute, second, millisecond));
    }
    return gstimeInternal(first);
}
