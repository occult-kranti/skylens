import { deg2rad, xpdotp } from './constants.js';
import { days2mdhms, jday } from './ext.js';
import { sgp4init } from './propagation/sgp4init.js';
function initSatrec(satrec, opsmode) {
    sgp4init(satrec, {
        opsmode,
        satn: satrec.satnum,
        epoch: satrec.jdsatepoch - 2433281.5,
        xbstar: satrec.bstar,
        xecco: satrec.ecco,
        xargpo: satrec.argpo,
        xinclo: satrec.inclo,
        xmo: satrec.mo,
        xno: satrec.no,
        xnodeo: satrec.nodeo
    });
}
export function twoline2satrec(longstr1, longstr2) {
    const opsmode = 'i';
    const error = 0;
    const satnum = longstr1.substring(2, 7);
    const epochyr = parseInt(longstr1.substring(18, 20), 10);
    const epochdays = parseFloat(longstr1.substring(20, 32));
    let ndot = parseFloat(longstr1.substring(33, 43));
    let nddot = parseFloat(`${longstr1.substring(44, 45)}.${longstr1.substring(45, 50)}E${longstr1.substring(50, 52)}`);
    const bstar = parseFloat(`${longstr1.substring(53, 54)}.${longstr1.substring(54, 59)}E${longstr1.substring(59, 61)}`);
    const inclo = parseFloat(longstr2.substring(8, 16)) * deg2rad;
    const nodeo = parseFloat(longstr2.substring(17, 25)) * deg2rad;
    const ecco = parseFloat(`.${longstr2.substring(26, 33).replace(/\s/g, '0')}`);
    const argpo = parseFloat(longstr2.substring(34, 42)) * deg2rad;
    const mo = parseFloat(longstr2.substring(43, 51)) * deg2rad;
    const no = parseFloat(longstr2.substring(52, 63)) / xpdotp;
    ndot /= xpdotp * 1440.0;
    nddot /= xpdotp * 1440.0 * 1440;
    const year = epochyr < 57 ? epochyr + 2000 : epochyr + 1900;
    const mdhmsResult = days2mdhms(year, epochdays);
    const { mon, day, hr, minute, sec } = mdhmsResult;
    const jdsatepoch = jday(year, mon, day, hr, minute, sec);
    const satrec = {
        error,
        satnum,
        epochyr,
        epochdays,
        ndot,
        nddot,
        bstar,
        inclo,
        nodeo,
        ecco,
        argpo,
        mo,
        no,
        jdsatepoch
    };
    initSatrec(satrec, opsmode);
    return satrec;
}
export function json2satrec(jsonobj, opsmode = 'i') {
    const error = 0;
    const satnum = jsonobj.NORAD_CAT_ID.toString();
    const epoch = new Date(jsonobj.EPOCH.endsWith('Z') ? jsonobj.EPOCH : `${jsonobj.EPOCH}Z`);
    const year = epoch.getUTCFullYear();
    const epochyr = Number(year.toString().slice(-2));
    const epochdays = (epoch.valueOf() - new Date(Date.UTC(year, 0, 1, 0, 0, 0)).valueOf()) / (86400 * 1000) + 1;
    let ndot = Number(jsonobj.MEAN_MOTION_DOT);
    let nddot = Number(jsonobj.MEAN_MOTION_DDOT);
    ndot /= xpdotp * 1440.0;
    nddot /= xpdotp * 1440.0 * 1440;
    const bstar = Number(jsonobj.BSTAR);
    const inclo = Number(jsonobj.INCLINATION) * deg2rad;
    const nodeo = Number(jsonobj.RA_OF_ASC_NODE) * deg2rad;
    const ecco = Number(jsonobj.ECCENTRICITY);
    const argpo = Number(jsonobj.ARG_OF_PERICENTER) * deg2rad;
    const mo = Number(jsonobj.MEAN_ANOMALY) * deg2rad;
    const no = Number(jsonobj.MEAN_MOTION) / xpdotp;
    const mdhmsResult = days2mdhms(year, epochdays);
    const { mon, day, hr, minute, sec } = mdhmsResult;
    const jdsatepoch = jday(year, mon, day, hr, minute, sec);
    const satrec = {
        error,
        satnum,
        epochyr,
        epochdays,
        ndot,
        nddot,
        bstar,
        inclo,
        nodeo,
        ecco,
        argpo,
        mo,
        no,
        jdsatepoch
    };
    initSatrec(satrec, opsmode);
    return satrec;
}
