export function days2mdhms(year, days) {
    const lmonth = [
        31,
        year % 4 === 0 ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
    ];
    const dayofyr = Math.floor(days);
    let i = 1;
    let inttemp = 0;
    while(dayofyr > inttemp + lmonth[i - 1] && i < 12){
        inttemp += lmonth[i - 1];
        i += 1;
    }
    const mon = i;
    const day = dayofyr - inttemp;
    let temp = (days - dayofyr) * 24.0;
    const hr = Math.floor(temp);
    temp = (temp - hr) * 60.0;
    const minute = Math.floor(temp);
    const sec = (temp - minute) * 60.0;
    return {
        mon,
        day,
        hr,
        minute,
        sec
    };
}
function jdayInternal(year, mon, day, hr, minute, sec, msec = 0) {
    return 367.0 * year - Math.floor(7 * (year + Math.floor((mon + 9) / 12.0)) * 0.25) + Math.floor(275 * mon / 9.0) + day + 1721013.5 + ((msec / 60000 + sec / 60.0 + minute) / 60.0 + hr) / 24.0;
}
export function jday(yearOrDate, mon, day, hr, minute, sec, msec = 0) {
    if (yearOrDate instanceof Date) {
        const date = yearOrDate;
        return jdayInternal(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
    }
    return jdayInternal(yearOrDate, mon, day, hr, minute, sec, msec);
}
export function invjday(jd, asArray) {
    const temp = jd - 2415019.5;
    const tu = temp / 365.25;
    let year = 1900 + Math.floor(tu);
    let leapyrs = Math.floor((year - 1901) * 0.25);
    let days = temp - ((year - 1900) * 365.0 + leapyrs) + 0.00000000001;
    if (days < 1.0) {
        year -= 1;
        leapyrs = Math.floor((year - 1901) * 0.25);
        days = temp - ((year - 1900) * 365.0 + leapyrs);
    }
    const mdhms = days2mdhms(year, days);
    const { mon, day, hr, minute } = mdhms;
    const sec = mdhms.sec - 0.000000864;
    if (asArray) {
        return [
            year,
            mon,
            day,
            hr,
            minute,
            Math.floor(sec)
        ];
    }
    return new Date(Date.UTC(year, mon - 1, day, hr, minute, Math.floor(sec)));
}
