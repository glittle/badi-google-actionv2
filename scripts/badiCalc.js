'use strict'

const moment = require('moment-timezone');
const sunCalc = require('./sunCalc');
const general = require('./general');
const messages = require('./messagehelper');

var _nawRuzOffsetFrom21 = [];
var _twinHolyBirthdays = [];
const splitSeparator = /[,،]+/;

const sunCalcReady = false;

var use24HourClock = getMessage('use24HourClock') === 'true';
var ordinal = getMessage('ordinal').split(splitSeparator);
var ordinalNames = getMessage('ordinalNames').split(splitSeparator);
var elements = getMessage('elements').split(splitSeparator);

function getMessage(a, b, c) {
    return messages.get(a, b, c);
}

fillDatePresets();


function addFeastTimes(userInfo, useArNames, speech, text) {
    var zoneName = userInfo.zoneName;
    var nowTz = moment.tz(zoneName);
    var coord = userInfo.coord;
    var bDateInfo = getBDateInfo(nowTz, coord, zoneName);
    var di = makeDi(nowTz, bDateInfo, coord, useArNames);

    if (di.bDay === 1) {
        // today is Feast day!
        speech.push(`Today is the Feast of ${di.bMonthNamePri} (${di.bMonthNameSec}).`.replace(/[`’ʿ]/g, ''));
        text.push(`Today is the Feast of ${di.bMonthNamePri} (${di.bMonthNameSec}).\n`);
        addSunTimes2(`The`, userInfo, 0, speech, text);
    } else {
        var daysAway = 20 - di.bDay;
        console.log(di.bDay, daysAway);
        nowTz = moment.tz(zoneName).add(daysAway, 'days');
        bDateInfo = getBDateInfo(nowTz, coord, zoneName);
        di = makeDi(nowTz, bDateInfo, coord, useArNames);

        var daysUntil = daysAway - 1;
        var days = daysUntil === 0 ? 'this evening' : (daysUntil === 1 ? `tomorrow` : `in ${daysUntil} days`);
        console.log(daysUntil, days);

        speech.push(`The next Feast is ${days}. It is the Feast of ${di.bMonthNamePri} (${di.bMonthNameSec}).`.replace(/[`’ʿ]/g, ''));
        text.push(`The next Feast is ${days}.\nIt is the Feast of ${di.bMonthNamePri} (${di.bMonthNameSec}).\n`);
        addSunTimes2(`It's`, userInfo, daysAway, speech, text);
    }


}

function addSunTimes(userInfo, speech, text) {
    addSunTimes2(`Today's`, userInfo, 0, speech, text);
}

function addSunTimes2(whatDay, userInfo, daysAway, speech, text) {
    var coord = userInfo.coord;
    if (!coord) {
        general.addToBoth('Sorry. I don\'t know where you are, so can\'t tell you when sunset is.', speech, text);
    }
    var location = userInfo.location;

    var zoneName = userInfo.zoneName;
    var now = moment.tz(zoneName);
    var timeInDayTz = moment(now).add(daysAway, 'days');
    var noonTz = moment(timeInDayTz).hour(12).minute(0).second(0);
    var tomorrowNoonTz = moment(noonTz).add(24, 'hours');

    var sun1 = sunCalc.getTimes(noonTz, coord.lat, coord.lng);
    var sunrise1Tz = moment.tz(sun1.sunrise, zoneName)
    var sunset1Tz = moment.tz(sun1.sunset, zoneName)

    if (timeInDayTz.isAfter(sunset1Tz)) {
        // eve of day1 into day2
        var sun2 = sunCalc.getTimes(tomorrowNoonTz, coord.lat, coord.lng);
        var sunrise2Tz = moment.tz(sun2.sunrise, zoneName);
        var sunset2Tz = moment.tz(sun2.sunset, zoneName);
        addSunTimesInternal(whatDay, now, location, sunset1Tz, timeInDayTz, sunrise2Tz, sunset2Tz, speech, text);

    } else {
        // get prior sunset
        var sun0 = sunCalc.getTimes(moment(noonTz).subtract(24, 'hours'), coord.lat, coord.lng);
        var sunset0 = moment.tz(sun0.sunset, zoneName);

        addSunTimesInternal(whatDay, now, location, sunset0, timeInDayTz, sunrise1Tz, sunset1Tz, speech, text);
    }
}

function addSunTimesInternal(whatDay, now, location, sunsetStart, timeInDay, sunrise, sunset, speech, text) {
    const timeAndDate = 'h:mm a on dddd, MMMM D';
    const noDate = 'h:mm a on dddd';
    const timeOnly = 'h:mm a';

    if (now.isBefore(sunsetStart) || timeInDay.isBefore(sunsetStart)) {
        speech.push(`<break time="1s"/>${whatDay} starting sunset in ${location} will be around ${sunsetStart.format(timeAndDate)}.`);
        text.push(`${whatDay} starting sunset in ${location} will be around ${sunsetStart.format(timeAndDate)}.`);
    } else {
        speech.push(`<break time="1s"/>${whatDay} starting sunset in ${location} was around ${sunsetStart.format(timeAndDate)}.`);
        text.push(`${whatDay} starting sunset in ${location} was around ${sunsetStart.format(timeAndDate)}.`);
    }

    var showNow = now.isAfter(sunsetStart);

    if (timeInDay.isBefore(sunrise) || !showNow) {
        if (showNow) {
            speech.push(`<break time="1s"/>It is now ${timeInDay.format(timeAndDate)}.`);
            text.push(`\nIt is now ${timeInDay.format(timeAndDate)}.`);
        }
        speech.push(`<break time="1s"/>Sunrise will be around ${sunrise.format(timeOnly)}.`);
        text.push(`\nSunrise will be around ${sunrise.format(timeOnly)}.`);
    } else {
        speech.push(`<break time="1s"/>Sunrise was around ${sunrise.format(timeOnly)}.`);
        text.push(`\nSunrise was around ${sunrise.format(timeOnly)}.`);
        speech.push(`<break time="1s"/>It is now ${timeInDay.format(timeAndDate)}.`);
        text.push(`\nIt is now ${timeInDay.format(timeAndDate)}.`);
    }

    // dates are always today or the future, never past
    speech.push(`<break time="1s"/>${whatDay} ending sunset will be around ${sunset.format(timeAndDate)}.`);
    text.push(`\n${whatDay} ending sunset will be around ${sunset.format(timeAndDate)}.`);

}

function addTodayDetails(useArNames, userInfo, speech, text) {
    var zoneName = userInfo.zoneName;
    var timeInDayTz = moment.tz(zoneName);
    var coord = userInfo.coord;
    var bDateInfo = getBDateInfo(timeInDayTz, coord, zoneName);
    var di = makeDi(timeInDayTz, bDateInfo, coord, useArNames);

    // console.log(di);

    var msg = 'This is the weekday of {bWeekdayNamePri}, the day of {bDayNamePri}, of the month of {bMonthNamePri}, of the year {bYearInVahidNamePri}, of the {bVahidOrdinalName} {VahidLabelPri}, of the {bKullishayOrdinalName} {KullishayLabelPri}.'.filledWith(di);

    // console.log(msg);
    var plain = msg.replace(/<u>/g, '').replace(/<\/u>/g, '');

    speech.push(plain);
    text.push(plain);
}

function makeDi(nowTz, bDateInfo, coord, useArNames) {
    var currentTime = nowTz.toDate();

    var bMonthNameAr = getMessage("bMonthNameAr").split(splitSeparator);
    var bMonthMeaning = getMessage("bMonthMeaning").split(splitSeparator);

    var bWeekdayNameAr = getMessage("bWeekdayNameAr").split(splitSeparator); // from Saturday
    var bWeekdayMeaning = getMessage("bWeekDayMeaning").split(splitSeparator);

    var bYearInVahidNameAr = getMessage("bYearInVahidNameAr").split(splitSeparator);
    var bYearInVahidMeaning = getMessage("bYearInVahidMeaning").split(splitSeparator);

    var bMonthNamePri;
    var bMonthNameSec;
    var bWeekdayNamePri;
    var bWeekdayNameSec;
    var bYearInVahidNamePri;
    var bYearInVahidNameSec;

    bMonthNamePri = useArNames ? bMonthNameAr : bMonthMeaning;
    bMonthNameSec = !useArNames ? bMonthNameAr : bMonthMeaning;
    bWeekdayNamePri = useArNames ? bWeekdayNameAr : bWeekdayMeaning;
    bWeekdayNameSec = !useArNames ? bWeekdayNameAr : bWeekdayMeaning;
    bYearInVahidNamePri = useArNames ? bYearInVahidNameAr : bYearInVahidMeaning;
    bYearInVahidNameSec = !useArNames ? bYearInVahidNameAr : bYearInVahidMeaning;

    var gWeekdayLong = getMessage("gWeekdayLong").split(splitSeparator);
    var gWeekdayShort = getMessage("gWeekdayShort").split(splitSeparator);
    var gMonthLong = getMessage("gMonthLong").split(splitSeparator);
    var gMonthShort = getMessage("gMonthShort").split(splitSeparator);


    var minDate = new Date(1844, 2, 21, 0, 0, 0, 0);
    if (currentTime < minDate) {
        currentTime = minDate;
    } else {
        var maxDate = new Date(2844, 2, 20, 0, 0, 0, 0);
        if (currentTime > maxDate) {
            currentTime = maxDate;
        }
    }

    // var known = knownDateInfos[currentTime];
    // if (known) {
    //     return known;
    // }

    var bNow = bDateInfo.bDate;
    // console.log('bNow', bNow)
    // if (onlyStamp) {
    //     return {
    //         stamp: JSON.stringify(bNow),
    //         stampDay: '{y}.{m}.{d}'.filledWith(bNow)
    //     };
    // }

    // split the Baha'i day to be "Eve" - sunset to midnight;
    // and "Morn" - from midnight through to sunset
    var frag1Noon = new Date(currentTime.getTime());
    frag1Noon.setHours(12, 0, 0, 0);
    if (!bNow.eve) {
        // if not already frag1, make it so
        frag1Noon.setDate(frag1Noon.getDate() - 1);
    }
    var frag2Noon = new Date(frag1Noon.getTime());
    frag2Noon.setDate(frag2Noon.getDate() + 1);

    var frag1SunTimes = sunCalc.getTimes(frag1Noon, coord.lat, coord.lng);
    var frag2SunTimes = sunCalc.getTimes(frag2Noon, coord.lat, coord.lng);

    var di = { // date info
        frag1: frag1Noon,
        frag1Year: frag1Noon.getFullYear(),
        frag1Month: frag1Noon.getMonth(),
        frag1Day: frag1Noon.getDate(),
        frag1Weekday: frag1Noon.getDay(),

        frag2: frag2Noon,
        frag2Year: frag2Noon.getFullYear(),
        frag2Month: frag2Noon.getMonth(), // 0 based
        frag2Day: frag2Noon.getDate(),
        frag2Weekday: frag2Noon.getDay(),

        currentYear: currentTime.getFullYear(),
        currentMonth: currentTime.getMonth(), // 0 based
        currentMonth1: 1 + currentTime.getMonth(),
        currentDay: currentTime.getDate(),
        currentDay00: digitPad2(currentTime.getDate()),
        currentWeekday: currentTime.getDay(),
        currentTime: currentTime,

        startingSunsetDesc12: showTime(frag1SunTimes.sunset),
        startingSunsetDesc24: showTime(frag1SunTimes.sunset, 24),
        endingSunsetDesc12: showTime(frag2SunTimes.sunset),
        endingSunsetDesc24: showTime(frag2SunTimes.sunset, 24),
        frag1SunTimes: frag1SunTimes,
        frag2SunTimes: frag2SunTimes,

        sunriseDesc12: showTime(frag2SunTimes.sunrise),
        sunriseDesc24: showTime(frag2SunTimes.sunrise, 24),

        bNow: bNow,
        bDay: bNow.d,
        bWeekday: 1 + (frag2Noon.getDay() + 1) % 7,
        bMonth: bNow.m,
        bYear: bNow.y,
        bVahid: Math.floor(1 + (bNow.y - 1) / 19),
        bDateCode: bNow.m + '.' + bNow.d,

        bDayNameAr: bMonthNameAr[bNow.d],
        bDayMeaning: bMonthMeaning[bNow.d],
        bMonthNameAr: bMonthNameAr[bNow.m],
        bMonthMeaning: bMonthMeaning[bNow.m],

        bEraLong: getMessage('eraLong'),
        bEraAbbrev: getMessage('eraAbbrev'),
        bEraShort: getMessage('eraShort'),

        stamp: JSON.stringify(bNow) // used to compare to other dates and for developer reference
    };

    di.bDayNamePri = useArNames ? di.bDayNameAr : di.bDayMeaning;
    di.bDayNameSec = !useArNames ? di.bDayNameAr : di.bDayMeaning;
    di.bMonthNamePri = useArNames ? di.bMonthNameAr : di.bMonthMeaning;
    di.bMonthNameSec = !useArNames ? di.bMonthNameAr : di.bMonthMeaning;

    di.VahidLabelPri = useArNames ? getMessage('Vahid') : getMessage('VahidLocal');
    di.VahidLabelSec = !useArNames ? getMessage('Vahid') : getMessage('VahidLocal');

    di.KullishayLabelPri = useArNames ? getMessage('Kullishay') : getMessage('KullishayLocal');
    di.KullishayLabelSec = !useArNames ? getMessage('Kullishay') : getMessage('KullishayLocal');

    di.bKullishay = Math.floor(1 + (di.bVahid - 1) / 19);
    di.bVahid = di.bVahid - (di.bKullishay - 1) * 19;
    di.bYearInVahid = di.bYear - (di.bVahid - 1) * 19 - (di.bKullishay - 1) * 19 * 19;

    di.bYearInVahidNameAr = bYearInVahidNameAr[di.bYearInVahid];
    di.bYearInVahidMeaning = bYearInVahidMeaning[di.bYearInVahid];
    di.bYearInVahidNamePri = useArNames ? di.bYearInVahidNameAr : di.bYearInVahidMeaning;
    di.bYearInVahidNameSec = !useArNames ? di.bYearInVahidNameAr : di.bYearInVahidMeaning;

    // console.log(bWeekdayNameAr, di.bWeekday);
    di.bWeekdayNameAr = bWeekdayNameAr[di.bWeekday];
    di.bWeekdayMeaning = bWeekdayMeaning[di.bWeekday];
    di.bWeekdayNamePri = useArNames ? di.bWeekdayNameAr : di.bWeekdayMeaning;
    di.bWeekdayNameSec = !useArNames ? di.bWeekdayNameAr : di.bWeekdayMeaning;

    di.elementNum = getElementNum(bNow.m);
    di.element = elements[di.elementNum - 1];

    di.bDayOrdinal = di.bDay + getOrdinal(di.bDay);
    di.bVahidOrdinal = di.bVahid + getOrdinal(di.bVahid);
    di.bKullishayOrdinal = di.bKullishay + getOrdinal(di.bKullishay);
    di.bDayOrdinalName = getOrdinalName(di.bDay);
    di.bVahidOrdinalName = getOrdinalName(di.bVahid);
    di.bKullishayOrdinalName = getOrdinalName(di.bKullishay);

    di.bDay00 = digitPad2(di.bDay);
    di.frag1Day00 = digitPad2(di.frag1Day);
    di.currentMonth01 = digitPad2(di.currentMonth1);
    di.frag2Day00 = digitPad2(di.frag2Day);
    di.frag1Month00 = digitPad2(1 + di.frag1Month); // change from 0 based
    di.frag2Month00 = digitPad2(1 + di.frag2Month); // change from 0 based
    di.bMonth00 = digitPad2(di.bMonth);
    di.bYearInVahid00 = digitPad2(di.bYearInVahid);
    di.bVahid00 = digitPad2(di.bVahid);

    di.startingSunsetDesc = use24HourClock ? di.startingSunsetDesc24 : di.startingSunsetDesc12;
    di.endingSunsetDesc = use24HourClock ? di.endingSunsetDesc24 : di.endingSunsetDesc12;
    di.sunriseDesc = use24HourClock ? di.sunriseDesc24 : di.sunriseDesc12;

    di.frag1MonthLong = gMonthLong[di.frag1Month];
    di.frag1MonthShort = gMonthShort[di.frag1Month];
    di.frag1WeekdayLong = gWeekdayLong[di.frag1Weekday];
    di.frag1WeekdayShort = gWeekdayShort[di.frag1Weekday];

    di.frag2MonthLong = gMonthLong[di.frag2Month];
    di.frag2MonthShort = gMonthShort[di.frag2Month];
    di.frag2WeekdayLong = gWeekdayLong[di.frag2Weekday];
    di.frag2WeekdayShort = gWeekdayShort[di.frag2Weekday];

    di.currentMonthLong = gMonthLong[di.currentMonth];
    di.currentMonthShort = gMonthShort[di.currentMonth];
    di.currentWeekdayLong = gWeekdayLong[di.currentWeekday];
    di.currentWeekdayShort = gWeekdayShort[di.currentWeekday];
    di.currentDateString = moment(di.currentTime).format('YYYY-MM-DD');


    di.currentRelationToSunset = getMessage(bNow.eve ? 'afterSunset' : 'beforeSunset');
    var thisMoment = new Date().getTime();
    di.dayStarted = getMessage(thisMoment > di.frag1SunTimes.sunset.getTime() ? 'dayStartedPast' : 'dayStartedFuture');
    di.dayEnded = getMessage(thisMoment > di.frag2SunTimes.sunset.getTime() ? 'dayEndedPast' : 'dayEndedFuture');
    di.dayStartedLower = di.dayStarted.toLocaleLowerCase();
    di.dayEndedLower = di.dayEnded.toLocaleLowerCase();

    // di.bMonthDayYear = getMessage('gMonthDayYear', di);

    if (di.frag1Year !== di.frag2Year) {
        // Dec 31/Jan 1
        // Dec 31, 2015/Jan 1, 2015
        di.gCombined = getMessage('gCombined_3', di);
        di.gCombinedY = getMessage('gCombinedY_3', di);
    } else if (di.frag1Month !== di.frag2Month) {
        // Mar 31/Apr 1
        // Mar 31/Apr 1, 2015
        di.gCombined = getMessage('gCombined_2', di);
        di.gCombinedY = getMessage('gCombinedY_2', di);
    } else {
        // Jul 12/13
        // Jul 12/13, 2015
        di.gCombined = getMessage('gCombined_1', di);
        di.gCombinedY = getMessage('gCombinedY_1', di);
    }
    di.nearestSunset = getMessage(bNow.eve ? "nearestSunsetEve" : "nearestSunsetDay", di);

    di.stampDay = '{y}.{m}.{d}'.filledWith(di.bNow); // ignore eve/day

    return di;

}

function digitPad2(num) {
    return ('00' + num).slice(-2);
}

function getOrdinal(num) {
    return ordinal[num] || ordinal[0] || num;
}

function getOrdinalName(num) {
    return ordinalNames[num] || num;
}

function getElementNum(num) {
    // the Bab's designations, found in 'https://books.google.ca/books?id=XTfoaK15t64C&pg=PA394&lpg=PA394&dq=get+of+the+heart+nader+bab&source=bl&ots=vyF-pWLAr8&sig=ruiuoE48sGWWgaB_AFKcSfkHvqw&hl=en&sa=X&ei=hbp0VfGwIon6oQSTk4Mg&ved=0CDAQ6AEwAw#v=snippet&q=%22air%20of%20eternity%22&f=false'

    //  1, 2, 3
    //  4, 5, 6, 7
    //  8, 9,10,11,12,13
    // 14,15,16,17,18,19
    var element = 1;
    if (num >= 4 && num <= 7) {
        element = 2;
    } else if (num >= 8 && num <= 13) {
        element = 3;
    } else if (num >= 14 && num <= 19) {
        element = 4;
    } else if (num === 0) {
        element = 0;
    }
    return element;
}

function showTime(d, use24) {
    var hoursType = use24HourClock || (use24 === 24) ? 24 : 0;
    var show24Hour = hoursType === 24;
    var hours24 = d.getHours();
    var pm = hours24 >= 12;
    var hours = show24Hour ?
        hours24 :
        hours24 > 12 ?
        hours24 - 12 :
        hours24 === 0 ?
        12 :
        hours24;
    var minutes = d.getMinutes();
    var time = hours + ':' + ('0' + minutes).slice(-2);
    if (!show24Hour) {
        if (hours24 === 12 && minutes === 0) {
            time = getMessage('noon');
        } else if (hours24 === 0 && minutes === 0) {
            time = getMessage('midnight');
        } else {
            time = getMessage('timeFormat12')
                .filledWith({
                    time: time,
                    ampm: pm ? getMessage('pm') : getMessage('am')
                });
        }
    }
    return time;
};


function addTodayInfoToAnswers(userInfo, speech, text) {
    var zoneName = userInfo.zoneName;
    var nowTz = moment.tz(zoneName);

    var coord = userInfo.coord;
    var bDateInfo = getBDateInfo(nowTz, coord, zoneName);
    var bDate = bDateInfo.bDate;
    var location = userInfo.location;
    // speech.push(`It is currently <say-as interpret-as="time" format="hm12">${nowTz.format('h:mm a')}</say-as> in ${profile.location}.`)
    // text.push(`It is currently ${nowTz.format('h:mm a')} in ${profile.location}.`)

    var nowHours = nowTz.hours();
    var greeting;
    if (nowHours >= 5 && nowHours <= 12) {
        greeting = (`This morning in ${location} is`);
    } else if (nowHours >= 19 || nowHours < 5) {
        greeting = (`This evening in ${location} is`); //, ${profile.first_name}
    } else {
        greeting = (`Today is`);
    }

    speech.push(greeting + ` the <say-as interpret-as="ordinal">${bDate.d}</say-as> day of ${monthMeaning[bDate.m]}!`);
    text.push(greeting + ` the ${bDate.d + general.getOrdinal(bDate.d)} day of ${monthMeaning[bDate.m]}!`);

    speech.push(` The <say-as interpret-as="ordinal">${bDate.d}</say-as> day is named ${monthMeaning[bDate.d]}!`);
    text.push(` The ${bDate.d + general.getOrdinal(bDate.d)} day is named ${monthMeaning[bDate.d]}!`);

    var age = nowTz.diff(bDateInfo.startingSunset, 'minute');

    speech.push('<break time="1s"/>');
    text.push('\n\n');

    if (age >= 0 && age < 5) {
        speech.push(`It just started with sunset at <say-as interpret-as="time" format="hm12" detail="2">${bDateInfo.startingSunset.format('h:mm a')}</say-as>!`);
        text.push(`It just started with sunset at ${bDateInfo.startingSunset.format('h:mm a')}!`);
    } else if (bDate.eve) {
        speech.push(`It started with sunset at <say-as interpret-as="time" format="hm12" detail="2">${bDateInfo.startingSunset.format('h:mm a')}</say-as>!`);
        text.push(`It started with sunset at ${bDateInfo.startingSunset.format('h:mm a')}!`);
    } else {
        speech.push(`It lasts until sunset at <say-as interpret-as="time" format="hm12" detail="2">${bDateInfo.endingSunset.format('h:mm a')}</say-as>.`);
        text.push(`It lasts until sunset at ${bDateInfo.endingSunset.format('h:mm a')}.`);
    }
}

//function getUserNowTime(serverDiff) {
//  var now = new Date();
//  if (serverDiff) {
//    now.setHours(now.getHours() + serverDiff);
//  }
//  return now;
//}


var getBDateInfo = function(nowTz, coord, zoneName) {
    if (!coord) {
        general.addToBoth('Sorry. I don\'t know where you are, so can\'t tell you when sunset is.', speech, text);
    }

    var noonTz = moment(nowTz).hour(12).minute(0).second(0);

    var sun1 = sunCalc.getTimes(noonTz, coord.lat, coord.lng);

    //  console.log('local now ' + nowTz.format());
    //  console.log('local noon ' + noonTz.format());
    //  console.log(sun1);
    var sunsetTz = moment.tz(sun1.sunset, zoneName)

    //  console.log('local sunset ' + sunsetTz.format());

    var afterSunset = nowTz.isSameOrAfter(sunsetTz, 'minute');

    if (afterSunset) {
        //    console.log('after sunset');
        noonTz.add(24, 'hours');
    }
    //  console.log('noon of target day ' + noonTz.format());


    var gYear = noonTz.year();
    var gDayOfNawRuz = getNawRuz(gYear, true);
    var gDayLoftiness1 = copyAndAddDays(gDayOfNawRuz, -19);

    var bYear = gYear - (noonTz >= gDayOfNawRuz ? 1843 : 1844);
    var bMonth, bDay;

    var isBeforeLoftiness = noonTz < gDayLoftiness1;
    if (isBeforeLoftiness) {
        // back: Jan --> end of AyyamiHa
        var gDayLoftiness1LastYear = copyAndAddDays(getNawRuz(gYear - 1, true), -19);

        var daysAfterLoftiness1LastYear = Math.round((noonTz - gDayLoftiness1LastYear) / 864e5);
        var numMonthsFromLoftinessLastYear = Math.floor(daysAfterLoftiness1LastYear / 19);

        bDay = 1 + daysAfterLoftiness1LastYear - numMonthsFromLoftinessLastYear * 19;
        bMonth = numMonthsFromLoftinessLastYear;

        if (bMonth === 19) {
            bMonth = 0;
        }
    } else {
        // forward: Loftiness --> Dec
        var bDaysAfterLoftiness1 = Math.round((noonTz - gDayLoftiness1) / 864e5);
        var bNumMonthsFromLoftiness = Math.floor(bDaysAfterLoftiness1 / 19);

        bDay = 1 + bDaysAfterLoftiness1 - bNumMonthsFromLoftiness * 19;
        bMonth = bNumMonthsFromLoftiness;

        if (bMonth === 0) {
            bMonth = 19;
        }
    }

    var sun0 = !afterSunset ? sunCalc.getTimes(moment(noonTz).subtract(24, 'hours'), coord.lat, coord.lng) : null;
    var sun2 = afterSunset ? sunCalc.getTimes(moment(noonTz).add(24, 'hours'), coord.lat, coord.lng) : null;

    return {
        bDate: {
            y: bYear,
            m: bMonth,
            d: bDay,
            eve: afterSunset
        },
        startingSunset: afterSunset ? sunsetTz : moment.tz(sun0.sunset, zoneName),
        sunrise: afterSunset ? moment.tz(sun2.sunrise, zoneName) : moment.tz(sun1.sunrise, zoneName),
        endingSunset: afterSunset ? moment.tz(sun2.sunset, zoneName) : sunsetTz
    };
};

function getNawRuz(gYear, frag2DateOnly) {
    // get NawRuz for this gregorian year
    var nawRuz = new Date(
        gYear,
        2, // 0 based
        (frag2DateOnly ? 21 : 20) + (_nawRuzOffsetFrom21[gYear - 1843] || 0),
        12, // default to noon
        0,
        0,
        0
    );

    if (frag2DateOnly) {
        return nawRuz;
    }

    var eveSunset = new Date(nawRuz);
    //  if (typeof sunCalculator != 'undefined') {
    nawRuz = sunCalculator.getTimes(eveSunset, _locationLat, _locationLong).sunset;
    //  } else {
    //    // default to 6:30pm
    //    eveSunset.setHours(18, 30, 0, 0);
    //  }
    return nawRuz;
};


function daysInAyyamiHa(bYear) {
    var firstDayOfAyyamiHa = copyAndAddDays(getGregorianDate(bYear, 18, 19), 1);
    var lastDayOfAyyamiHa = copyAndAddDays(getGregorianDate(bYear, 19, 1), -1);

    return daysBetween(firstDayOfAyyamiHa, lastDayOfAyyamiHa);
}

function copyAndAddDays(oldDate, daysOffset) {
    var d = new Date(oldDate);
    d.setDate(d.getDate() + daysOffset);
    return d;
}

function daysBetween(d1, d2) {
    return 1 + Math.round(Math.abs((d1.getTime() - d2.getTime()) / 864e5));
};

function addDays(d, days) {
    d.setDate(d.getDate() + days);
}

function addHours(d, hours) {
    d.setHours(d.getHours() + hours);
}


function fillDatePresets() {

    _nawRuzOffsetFrom21 = {
        // by default and historically, on March 21. If not, year is listed here with the offset... 173 is March 20
        // can be 0, -1, -2? and will never change by more than 1 day between years
        // extracted from UHJ documents and http://www.bahaidate.today/table-of-dates
        173: -1,
        174: -1,
        175: 0,
        176: 0,
        177: -1,
        178: -1,
        179: 0,
        180: 0,
        181: -1,
        182: -1,
        183: 0,
        184: 0,
        185: -1,
        186: -1,
        187: -1,
        188: 0,
        189: -1,
        190: -1,
        191: -1,
        192: 0,
        193: -1,
        194: -1,
        195: -1,
        196: 0,
        197: -1,
        198: -1,
        199: -1,
        200: 0,
        201: -1,
        202: -1,
        203: -1,
        204: 0,
        205: -1,
        206: -1,
        207: -1,
        208: 0,
        209: -1,
        210: -1,
        211: -1,
        212: 0,
        213: -1,
        214: -1,
        215: -1,
        216: -1,
        217: -1,
        218: -1,
        219: -1,
        220: -1,
        221: -1,
        222: -1,
        223: -1,
        224: -1,
        225: -1,
        226: -1,
        227: -1,
        228: -1,
        229: -1,
        230: -1,
        231: -1,
        232: -1,
        233: -1,
        234: -1,
        235: -1,
        236: -1,
        237: -1,
        238: -1,
        239: -1,
        240: -1,
        241: -1,
        242: -1,
        243: -1,
        244: -1,
        245: -1,
        246: -1,
        247: -1,
        248: -1,
        249: -2,
        250: -1,
        251: -1,
        252: -1,
        253: -2,
        254: -1,
        255: -1,
        256: -1,
        257: -1,
        258: 0,
        259: 0,
        260: 0,
        261: -1,
        262: 0,
        263: 0,
        264: 0,
        265: -1,
        266: 0,
        267: 0,
        268: 0,
        269: -1,
        270: 0,
        271: 0,
        272: 0,
        273: -1,
        274: 0,
        275: 0,
        276: 0,
        277: -1,
        278: 0,
        279: 0,
        280: 0,
        281: -1,
        282: -1,
        283: 0,
        284: 0,
        285: -1,
        286: -1,
        287: 0,
        288: 0,
        289: -1,
        290: -1,
        291: 0,
        292: 0,
        293: -1,
        294: -1,
        295: 0,
        296: 0,
        297: -1,
        298: -1,
        299: 0,
        300: 0,
        301: -1,
        302: -1,
        303: 0,
        304: 0,
        305: -1,
        306: -1,
        307: 0,
        308: 0,
        309: -1,
        310: -1,
        311: 0,
        312: 0,
        313: -1,
        314: -1,
        315: -1,
        316: 0,
        317: -1,
        318: -1,
        319: -1,
        320: 0,
        321: -1,
        322: -1,
        323: -1,
        324: 0,
        325: -1,
        326: -1,
        327: -1,
        328: 0,
        329: -1,
        330: -1,
        331: -1,
        332: 0,
        333: -1,
        334: -1,
        335: -1,
        336: 0,
        337: -1,
        338: -1,
        339: -1,
        340: 0,
        341: -1,
        342: -1,
        343: -1,
        344: 0,
        345: -1,
        346: -1,
        347: -1,
        348: -1,
        349: -1,
        350: -1,
        351: -1,
        352: -1,
        353: -1,
        354: -1,
        355: -1,
        356: -1,
        357: 0,
        358: 0,
        359: 0,
        360: 0,
        361: 0,
        362: 0,
        363: 0,
        364: 0,
        365: 0,
        366: 0,
        367: 0,
        368: 0,
        369: 0,
        370: 0,
        371: 0,
        372: 0,
        373: 0,
        374: 0,
        375: 0,
        376: 0,
        377: 0,
        378: 0,
        379: 0,
        380: 0,
        381: -1,
        382: 0,
        383: 0,
        384: 0,
        385: -1,
        386: 0,
        387: 0,
        388: 0,
        389: -1,
        390: 0,
        391: 0,
        392: 0,
        393: -1,
        394: 0,
        395: 0,
        396: 0,
        397: -1,
        398: 0,
        399: 0,
        400: 0,
        401: -1,
        402: 0,
        403: 0,
        404: 0,
        405: -1,
        406: 0,
        407: 0,
        408: 0,
        409: -1,
        410: 0,
        411: 0,
        412: 0,
        413: -1,
        414: -1,
        415: 0,
        416: 0,
        417: -1,
        418: -1,
        419: 0,
        420: 0,
        421: -1,
        422: -1,
        423: 0,
        424: 0,
        425: -1,
        426: -1,
        427: 0,
        428: 0,
        429: -1,
        430: -1,
        431: 0,
        432: 0,
        433: -1,
        434: -1,
        435: 0,
        436: 0,
        437: -1,
        438: -1,
        439: 0,
        440: 0,
        441: -1,
        442: -1,
        443: 0,
        444: 0,
        445: -1,
        446: -1,
        447: -1,
        448: 0,
        449: -1,
        450: -1,
        451: -1,
        452: 0,
        453: -1,
        454: -1,
        455: -1,
        456: 0,
        457: 0,
        458: 0,
        459: 0,
        460: 1,
        461: 0,
        462: 0,
        463: 0,
        464: 1,
        465: 0,
        466: 0,
        467: 0,
        468: 1,
        469: 0,
        470: 0,
        471: 0,
        472: 1,
        473: 0,
        474: 0,
        475: 0,
        476: 1,
        477: 0,
        478: 0,
        479: 0,
        480: 0,
        481: 0,
        482: 0,
        483: 0,
        484: 0,
        485: 0,
        486: 0,
        487: 0,
        488: 0,
        489: 0,
        490: 0,
        491: 0,
        492: 0,
        493: 0,
        494: 0,
        495: 0,
        496: 0,
        497: 0,
        498: 0,
        499: 0,
        500: 0,
        501: 0,
        502: 0,
        503: 0,
        504: 0,
        505: 0,
        506: 0,
        507: 0,
        508: 0,
        509: 0,
        510: 0,
        511: 0,
        512: 0,
        513: -1,
        514: 0,
        515: 0,
        516: 0,
        517: -1,
        518: 0,
        519: 0,
        520: 0,
        521: -1,
        522: 0,
        523: 0,
        524: 0,
        525: -1,
        526: 0,
        527: 0,
        528: 0,
        529: -1,
        530: 0,
        531: 0,
        532: 0,
        533: -1,
        534: 0,
        535: 0,
        536: 0,
        537: -1,
        538: 0,
        539: 0,
        540: 0,
        541: -1,
        542: -1,
        543: 0,
        544: 0,
        545: -1,
        546: -1,
        547: 0,
        548: 0,
        549: -1,
        550: -1,
        551: 0,
        552: 0,
        553: -1,
        554: -1,
        555: 0,
        556: 0,
        557: -1,
        558: -1,
        559: 0,
        560: 0,
        561: -1,
        562: -1,
        563: 0,
        564: 0,
        565: -1,
        566: -1,
        567: 0,
        568: 0,
        569: -1,
        570: -1,
        571: 0,
        572: 0,
        573: -1,
        574: -1,
        575: 0,
        576: 0,
        577: -1,
        578: -1,
        579: -1,
        580: 0,
        581: -1,
        582: -1,
        583: -1,
        584: 0,
        585: -1,
        586: -1,
        587: -1,
        588: 0,
        589: -1,
        590: -1,
        591: -1,
        592: 0,
        593: -1,
        594: -1,
        595: -1,
        596: 0,
        597: -1,
        598: -1,
        599: -1,
        600: 0,
        601: -1,
        602: -1,
        603: -1,
        604: 0,
        605: -1,
        606: -1,
        607: -1,
        608: 0,
        609: -1,
        610: -1,
        611: -1,
        612: -1,
        613: -1,
        614: -1,
        615: -1,
        616: -1,
        617: -1,
        618: -1,
        619: -1,
        620: -1,
        621: -1,
        622: -1,
        623: -1,
        624: -1,
        625: -1,
        626: -1,
        627: -1,
        628: -1,
        629: -1,
        630: -1,
        631: -1,
        632: -1,
        633: -1,
        634: -1,
        635: -1,
        636: -1,
        637: -1,
        638: -1,
        639: -1,
        640: -1,
        641: -1,
        642: -1,
        643: -1,
        644: -1,
        645: -2,
        646: -1,
        647: -1,
        648: -1,
        649: -2,
        650: -1,
        651: -1,
        652: -1,
        653: -2,
        654: -1,
        655: -1,
        656: -1,
        657: -1,
        658: 0,
        659: 0,
        660: 0,
        661: -1,
        662: 0,
        663: 0,
        664: 0,
        665: -1,
        666: 0,
        667: 0,
        668: 0,
        669: -1,
        670: 0,
        671: 0,
        672: 0,
        673: -1,
        674: -1,
        675: 0,
        676: 0,
        677: -1,
        678: -1,
        679: 0,
        680: 0,
        681: -1,
        682: -1,
        683: 0,
        684: 0,
        685: -1,
        686: -1,
        687: 0,
        688: 0,
        689: -1,
        690: -1,
        691: 0,
        692: 0,
        693: -1,
        694: -1,
        695: 0,
        696: 0,
        697: -1,
        698: -1,
        699: 0,
        700: 0,
        701: -1,
        702: -1,
        703: 0,
        704: 0,
        705: -1,
        706: -1,
        707: -1,
        708: 0,
        709: -1,
        710: -1,
        711: -1,
        712: 0,
        713: -1,
        714: -1,
        715: -1,
        716: 0,
        717: -1,
        718: -1,
        719: -1,
        720: 0,
        721: -1,
        722: -1,
        723: -1,
        724: 0,
        725: -1,
        726: -1,
        727: -1,
        728: 0,
        729: -1,
        730: -1,
        731: -1,
        732: 0,
        733: -1,
        734: -1,
        735: -1,
        736: 0,
        737: -1,
        738: -1,
        739: -1,
        740: -1,
        741: -1,
        742: -1,
        743: -1,
        744: -1,
        745: -1,
        746: -1,
        747: -1,
        748: -1,
        749: -1,
        750: -1,
        751: -1,
        752: -1,
        753: -1,
        754: -1,
        755: -1,
        756: -1,
        757: 0,
        758: 0,
        759: 0,
        760: 0,
        761: 0,
        762: 0,
        763: 0,
        764: 0,
        765: 0,
        766: 0,
        767: 0,
        768: 0,
        769: 0,
        770: 0,
        771: 0,
        772: 0,
        773: -1,
        774: 0,
        775: 0,
        776: 0,
        777: -1,
        778: 0,
        779: 0,
        780: 0,
        781: -1,
        782: 0,
        783: 0,
        784: 0,
        785: -1,
        786: 0,
        787: 0,
        788: 0,
        789: -1,
        790: 0,
        791: 0,
        792: 0,
        793: -1,
        794: 0,
        795: 0,
        796: 0,
        797: -1,
        798: 0,
        799: 0,
        800: 0,
        801: -1,
        802: 0,
        803: 0,
        804: 0,
        805: -1,
        806: -1,
        807: 0,
        808: 0,
        809: -1,
        810: -1,
        811: 0,
        812: 0,
        813: -1,
        814: -1,
        815: 0,
        816: 0,
        817: -1,
        818: -1,
        819: 0,
        820: 0,
        821: -1,
        822: -1,
        823: 0,
        824: 0,
        825: -1,
        826: -1,
        827: 0,
        828: 0,
        829: -1,
        830: -1,
        831: 0,
        832: 0,
        833: -1,
        834: -1,
        835: 0,
        836: 0,
        837: -1,
        838: -1,
        839: -1,
        840: 0,
        841: -1,
        842: -1,
        843: -1,
        844: 0,
        845: -1,
        846: -1,
        847: -1,
        848: 0,
        849: -1,
        850: -1,
        851: -1,
        852: 0,
        853: -1,
        854: -1,
        855: -1,
        856: 0,
        857: 0,
        858: 0,
        859: 0,
        860: 1,
        861: 0,
        862: 0,
        863: 0,
        864: 1,
        865: 0,
        866: 0,
        867: 0,
        868: 1,
        869: 0,
        870: 0,
        871: 0,
        872: 0,
        873: 0,
        874: 0,
        875: 0,
        876: 0,
        877: 0,
        878: 0,
        879: 0,
        880: 0,
        881: 0,
        882: 0,
        883: 0,
        884: 0,
        885: 0,
        886: 0,
        887: 0,
        888: 0,
        889: 0,
        890: 0,
        891: 0,
        892: 0,
        893: 0,
        894: 0,
        895: 0,
        896: 0,
        897: 0,
        898: 0,
        899: 0,
        900: 0,
        901: 0,
        902: 0,
        903: 0,
        904: 0,
        905: -1,
        906: 0,
        907: 0,
        908: 0,
        909: -1,
        910: 0,
        911: 0,
        912: 0,
        913: -1,
        914: 0,
        915: 0,
        916: 0,
        917: -1,
        918: 0,
        919: 0,
        920: 0,
        921: -1,
        922: 0,
        923: 0,
        924: 0,
        925: -1,
        926: 0,
        927: 0,
        928: 0,
        929: -1,
        930: 0,
        931: 0,
        932: 0,
        933: -1,
        934: 0,
        935: 0,
        936: 0,
        937: -1,
        938: -1,
        939: 0,
        940: 0,
        941: -1,
        942: -1,
        943: 0,
        944: 0,
        945: -1,
        946: -1,
        947: 0,
        948: 0,
        949: -1,
        950: -1,
        951: 0,
        952: 0,
        953: -1,
        954: -1,
        955: 0,
        956: 0,
        957: -1,
        958: -1,
        959: 0,
        960: 0,
        961: -1,
        962: -1,
        963: 0,
        964: 0,
        965: -1,
        966: -1,
        967: 0,
        968: 0,
        969: -1,
        970: -1,
        971: -1,
        972: 0,
        973: -1,
        974: -1,
        975: -1,
        976: 0,
        977: -1,
        978: -1,
        979: -1,
        980: 0,
        981: -1,
        982: -1,
        983: -1,
        984: 0,
        985: -1,
        986: -1,
        987: -1,
        988: 0,
        989: -1,
        990: -1,
        991: -1,
        992: 0,
        993: -1,
        994: -1,
        995: -1,
        996: 0,
        997: -1,
        998: -1,
        999: -1,
        1000: 0
    };


    // =============================================================
    // table of Twin Holy birthday dates
    _twinHolyBirthdays = {
        // first of the two days, in Badi date code
        // extracted from "Bahá’í Dates 172 to 221 B.E." and http://www.bahaidate.today/table-of-dates
        172: '13.10',
        173: '12.18',
        174: '12.7',
        175: '13.6',
        176: '12.14',
        177: '12.4',
        178: '13.4',
        179: '12.11',
        180: '12.1',
        181: '12.19',
        182: '12.8',
        183: '13.7',
        184: '12.15',
        185: '12.5',
        186: '13.5',
        187: '12.14',
        188: '12.2',
        189: '13.2',
        190: '12.10',
        191: '13.10',
        192: '12.17',
        193: '12.6',
        194: '13.6',
        195: '12.15',
        196: '12.4',
        197: '13.4',
        198: '12.12',
        199: '12.1',
        200: '12.19',
        201: '12.8',
        202: '13.8',
        203: '12.16',
        204: '12.5',
        205: '13.5',
        206: '12.14',
        207: '12.3',
        208: '13.2',
        209: '12.10',
        210: '13.9',
        211: '12.18',
        212: '12.6',
        213: '13.6',
        214: '12.15',
        215: '12.4',
        216: '13.4',
        217: '12.11',
        218: '11.19',
        219: '12.19',
        220: '12.9',
        221: '13.8',
        222: '12.16',
        223: '12.6',
        224: '13.6',
        225: '12.13',
        226: '12.2',
        227: '13.2',
        228: '12.10',
        229: '13.9',
        230: '12.18',
        231: '12.7',
        232: '13.7',
        233: '12.15',
        234: '12.4',
        235: '13.4',
        236: '12.12',
        237: '11.19',
        238: '12.19',
        239: '12.9',
        240: '13.9',
        241: '12.16',
        242: '12.6',
        243: '13.5',
        244: '12.13',
        245: '12.2',
        246: '13.1',
        247: '12.10',
        248: '13.10',
        249: '12.19',
        250: '12.7',
        251: '13.7',
        252: '12.15',
        253: '12.4',
        254: '13.3',
        255: '12.11',
        256: '12.1',
        257: '13.1',
        258: '12.9',
        259: '13.9',
        260: '12.17',
        261: '12.6',
        262: '13.5',
        263: '12.13',
        264: '12.2',
        265: '13.2',
        266: '12.10',
        267: '13.10',
        268: '12.19',
        269: '12.8',
        270: '13.7',
        271: '12.15',
        272: '12.4',
        273: '13.4',
        274: '12.11',
        275: '12.1',
        276: '13.1',
        277: '12.9',
        278: '13.8',
        279: '12.16',
        280: '12.5',
        281: '13.5',
        282: '12.14',
        283: '12.2',
        284: '13.2',
        285: '12.11',
        286: '13.11',
        287: '12.18',
        288: '12.7',
        289: '13.7',
        290: '12.15',
        291: '12.4',
        292: '13.4',
        293: '12.12',
        294: '12.2',
        295: '13.1',
        296: '12.9',
        297: '13.9',
        298: '12.17',
        299: '12.5',
        300: '13.5',
        301: '12.14',
        302: '12.3',
        303: '13.2',
        304: '12.11',
        305: '13.10',
        306: '12.18',
        307: '12.6',
        308: '13.6',
        309: '12.15',
        310: '12.5',
        311: '13.4',
        312: '12.12',
        313: '12.1',
        314: '13.1',
        315: '12.9',
        316: '13.8',
        317: '12.16',
        318: '12.6',
        319: '13.6',
        320: '12.14',
        321: '12.3',
        322: '13.3',
        323: '12.11',
        324: '13.10',
        325: '12.18',
        326: '12.7',
        327: '13.7',
        328: '12.15',
        329: '12.5',
        330: '13.5',
        331: '12.13',
        332: '12.1',
        333: '12.19',
        334: '12.9',
        335: '13.9',
        336: '12.16',
        337: '12.6',
        338: '13.6',
        339: '12.14',
        340: '12.3',
        341: '13.2',
        342: '12.10',
        343: '11.19',
        344: '12.18',
        345: '12.7',
        346: '13.7',
        347: '12.16',
        348: '12.5',
        349: '13.4',
        350: '12.12',
        351: '12.1',
        352: '13.1',
        353: '12.9',
        354: '13.9',
        355: '12.17',
        356: '12.7',
        357: '13.6',
        358: '12.14',
        359: '12.3',
        360: '13.3',
        361: '12.10',
        362: '13.10',
        363: '12.19',
        364: '12.8',
        365: '13.7',
        366: '12.16',
        367: '12.5',
        368: '13.4',
        369: '12.11',
        370: '12.1',
        371: '13.1',
        372: '12.10',
        373: '13.9',
        374: '12.17',
        375: '12.6',
        376: '13.6',
        377: '12.13',
        378: '12.2',
        379: '13.2',
        380: '12.11',
        381: '12.1',
        382: '12.19',
        383: '12.8',
        384: '13.8',
        385: '12.16',
        386: '12.4',
        387: '13.4',
        388: '12.12',
        389: '12.2',
        390: '13.1',
        391: '12.10',
        392: '13.10',
        393: '12.18',
        394: '12.6',
        395: '13.5',
        396: '12.14',
        397: '12.3',
        398: '13.2',
        399: '12.11',
        400: '13.11',
        401: '12.19',
        402: '12.8',
        403: '13.7',
        404: '12.15',
        405: '12.5',
        406: '13.4',
        407: '12.12',
        408: '12.2',
        409: '13.2',
        410: '12.9',
        411: '13.9',
        412: '12.17',
        413: '12.6',
        414: '13.6',
        415: '12.14',
        416: '12.3',
        417: '13.3',
        418: '12.12',
        419: '13.11',
        420: '12.19',
        421: '12.8',
        422: '13.8',
        423: '12.15',
        424: '12.4',
        425: '13.5',
        426: '12.13',
        427: '12.2',
        428: '13.2',
        429: '12.10',
        430: '13.9',
        431: '12.16',
        432: '12.6',
        433: '13.6',
        434: '12.15',
        435: '12.3',
        436: '13.3',
        437: '12.11',
        438: '11.19',
        439: '12.18',
        440: '12.7',
        441: '13.7',
        442: '12.16',
        443: '12.5',
        444: '13.5',
        445: '12.13',
        446: '12.2',
        447: '13.2',
        448: '12.9',
        449: '13.9',
        450: '12.17',
        451: '12.7',
        452: '13.6',
        453: '12.15',
        454: '12.4',
        455: '13.4',
        456: '12.11',
        457: '11.19',
        458: '12.19',
        459: '12.8',
        460: '13.7',
        461: '12.16',
        462: '12.5',
        463: '13.5',
        464: '12.12',
        465: '12.1',
        466: '13.1',
        467: '12.10',
        468: '13.9',
        469: '12.17',
        470: '12.7',
        471: '13.7',
        472: '12.14',
        473: '12.3',
        474: '13.3',
        475: '12.11',
        476: '11.18',
        477: '12.18',
        478: '12.8',
        479: '13.8',
        480: '12.17',
        481: '12.5',
        482: '13.5',
        483: '12.13',
        484: '12.2',
        485: '13.1',
        486: '12.9',
        487: '13.10',
        488: '12.18',
        489: '12.7',
        490: '13.7',
        491: '12.15',
        492: '12.4',
        493: '13.2',
        494: '12.11',
        495: '11.19',
        496: '13.1',
        497: '12.8',
        498: '13.8',
        499: '12.16',
        500: '12.5',
        501: '13.4',
        502: '12.12',
        503: '12.2',
        504: '13.2',
        505: '12.9',
        506: '13.10',
        507: '12.18',
        508: '12.7',
        509: '13.6',
        510: '12.14',
        511: '12.3',
        512: '13.3',
        513: '12.12',
        514: '11.19',
        515: '12.19',
        516: '12.9',
        517: '13.9',
        518: '12.16',
        519: '12.5',
        520: '13.5',
        521: '12.13',
        522: '12.2',
        523: '13.2',
        524: '12.10',
        525: '13.10',
        526: '12.17',
        527: '12.6',
        528: '13.6',
        529: '12.14',
        530: '12.3',
        531: '13.3',
        532: '12.12',
        533: '12.1',
        534: '12.19',
        535: '12.8',
        536: '13.8',
        537: '12.16',
        538: '12.4',
        539: '13.4',
        540: '12.13',
        541: '12.3',
        542: '13.3',
        543: '12.10',
        544: '13.10',
        545: '12.18',
        546: '12.7',
        547: '13.6',
        548: '12.14',
        549: '12.4',
        550: '13.4',
        551: '12.12',
        552: '12.1',
        553: '13.1',
        554: '12.9',
        555: '13.7',
        556: '12.16',
        557: '12.5',
        558: '13.5',
        559: '12.13',
        560: '12.2',
        561: '13.2',
        562: '12.10',
        563: '13.9',
        564: '12.17',
        565: '12.7',
        566: '13.7',
        567: '12.14',
        568: '12.4',
        569: '13.4',
        570: '12.12',
        571: '11.19',
        572: '12.19',
        573: '12.8',
        574: '13.8',
        575: '12.16',
        576: '12.5',
        577: '13.5',
        578: '12.14',
        579: '12.3',
        580: '13.2',
        581: '12.10',
        582: '13.10',
        583: '12.18',
        584: '12.7',
        585: '13.7',
        586: '12.15',
        587: '12.5',
        588: '13.3',
        589: '12.11',
        590: '12.1',
        591: '12.19',
        592: '12.8',
        593: '13.8',
        594: '12.17',
        595: '12.6',
        596: '13.5',
        597: '12.13',
        598: '12.2',
        599: '13.2',
        600: '12.9',
        601: '13.9',
        602: '12.18',
        603: '12.8',
        604: '13.7',
        605: '12.15',
        606: '12.4',
        607: '13.4',
        608: '12.11',
        609: '11.19',
        610: '12.19',
        611: '12.9',
        612: '13.9',
        613: '12.17',
        614: '12.6',
        615: '13.6',
        616: '12.14',
        617: '12.2',
        618: '13.2',
        619: '12.10',
        620: '13.10',
        621: '12.18',
        622: '12.7',
        623: '13.7',
        624: '12.15',
        625: '12.3',
        626: '13.3',
        627: '12.12',
        628: '12.1',
        629: '12.19',
        630: '12.9',
        631: '13.9',
        632: '12.17',
        633: '12.5',
        634: '13.5',
        635: '12.13',
        636: '12.3',
        637: '13.2',
        638: '12.10',
        639: '13.10',
        640: '12.19',
        641: '12.7',
        642: '13.7',
        643: '12.15',
        644: '12.4',
        645: '13.4',
        646: '12.12',
        647: '12.1',
        648: '13.1',
        649: '12.10',
        650: '13.8',
        651: '12.16',
        652: '12.6',
        653: '13.5',
        654: '12.13',
        655: '12.3',
        656: '13.3',
        657: '12.11',
        658: '13.10',
        659: '12.18',
        660: '12.7',
        661: '13.7',
        662: '12.14',
        663: '12.4',
        664: '13.4',
        665: '12.13',
        666: '12.1',
        667: '13.1',
        668: '12.9',
        669: '13.9',
        670: '12.16',
        671: '12.5',
        672: '13.5',
        673: '12.14',
        674: '12.4',
        675: '13.3',
        676: '12.11',
        677: '11.19',
        678: '12.19',
        679: '12.7',
        680: '13.7',
        681: '12.15',
        682: '12.5',
        683: '13.4',
        684: '12.12',
        685: '12.2',
        686: '13.1',
        687: '12.8',
        688: '13.8',
        689: '12.17',
        690: '12.6',
        691: '13.5',
        692: '12.14',
        693: '12.3',
        694: '13.3',
        695: '12.10',
        696: '13.10',
        697: '12.18',
        698: '12.8',
        699: '13.7',
        700: '12.15',
        701: '12.5',
        702: '13.5',
        703: '12.12',
        704: '12.1',
        705: '13.1',
        706: '12.9',
        707: '13.9',
        708: '12.17',
        709: '12.6',
        710: '13.6',
        711: '12.15',
        712: '12.3',
        713: '13.2',
        714: '12.10',
        715: '11.19',
        716: '12.18',
        717: '12.8',
        718: '13.8',
        719: '12.16',
        720: '12.4',
        721: '13.4',
        722: '12.12',
        723: '12.1',
        724: '12.19',
        725: '12.9',
        726: '13.9',
        727: '12.18',
        728: '12.6',
        729: '13.6',
        730: '12.14',
        731: '12.3',
        732: '13.2',
        733: '12.10',
        734: '11.19',
        735: '12.19',
        736: '12.8',
        737: '13.8',
        738: '12.16',
        739: '12.5',
        740: '13.4',
        741: '12.12',
        742: '12.1',
        743: '13.1',
        744: '12.10',
        745: '13.9',
        746: '12.17',
        747: '12.7',
        748: '13.6',
        749: '12.13',
        750: '12.3',
        751: '13.3',
        752: '12.11',
        753: '13.10',
        754: '12.19',
        755: '12.8',
        756: '13.8',
        757: '12.15',
        758: '12.4',
        759: '13.4',
        760: '12.13',
        761: '12.1',
        762: '13.1',
        763: '12.10',
        764: '13.10',
        765: '12.17',
        766: '12.6',
        767: '13.6',
        768: '12.14',
        769: '12.3',
        770: '13.3',
        771: '12.11',
        772: '13.11',
        773: '13.1',
        774: '12.8',
        775: '13.7',
        776: '12.15',
        777: '12.5',
        778: '13.4',
        779: '12.13',
        780: '12.2',
        781: '13.2',
        782: '12.9',
        783: '13.9',
        784: '12.17',
        785: '12.6',
        786: '13.5',
        787: '12.14',
        788: '12.4',
        789: '13.4',
        790: '12.11',
        791: '13.11',
        792: '12.19',
        793: '12.8',
        794: '13.7',
        795: '12.15',
        796: '12.5',
        797: '13.5',
        798: '12.13',
        799: '12.2',
        800: '13.2',
        801: '12.10',
        802: '13.8',
        803: '12.17',
        804: '12.6',
        805: '13.6',
        806: '12.15',
        807: '12.3',
        808: '13.3',
        809: '12.11',
        810: '11.19',
        811: '12.18',
        812: '12.8',
        813: '13.8',
        814: '12.16',
        815: '12.5',
        816: '13.5',
        817: '12.13',
        818: '12.2',
        819: '13.1',
        820: '12.9',
        821: '13.9',
        822: '12.17',
        823: '12.6',
        824: '13.6',
        825: '12.15',
        826: '12.4',
        827: '13.3',
        828: '12.11',
        829: '11.19',
        830: '12.19',
        831: '12.7',
        832: '13.8',
        833: '12.16',
        834: '12.6',
        835: '13.5',
        836: '12.13',
        837: '12.2',
        838: '13.1',
        839: '12.10',
        840: '13.9',
        841: '12.18',
        842: '12.7',
        843: '13.7',
        844: '12.14',
        845: '12.3',
        846: '13.3',
        847: '12.11',
        848: '11.19',
        849: '12.19',
        850: '12.8',
        851: '13.9',
        852: '12.16',
        853: '12.5',
        854: '13.5',
        855: '12.13',
        856: '12.1',
        857: '13.1',
        858: '12.10',
        859: '13.10',
        860: '12.17',
        861: '12.7',
        862: '13.7',
        863: '12.15',
        864: '12.3',
        865: '13.3',
        866: '12.11',
        867: '12.1',
        868: '12.19',
        869: '12.8',
        870: '13.8',
        871: '12.16',
        872: '12.5',
        873: '13.4',
        874: '12.12',
        875: '12.2',
        876: '13.2',
        877: '12.10',
        878: '13.10',
        879: '12.18',
        880: '12.7',
        881: '13.6',
        882: '12.14',
        883: '12.3',
        884: '13.3',
        885: '12.11',
        886: '12.1',
        887: '13.1',
        888: '12.9',
        889: '13.8',
        890: '12.16',
        891: '12.5',
        892: '13.5',
        893: '12.12',
        894: '12.2',
        895: '13.2',
        896: '12.11',
        897: '13.10',
        898: '12.18',
        899: '12.7',
        900: '13.6',
        901: '12.14',
        902: '12.3',
        903: '13.3',
        904: '12.12',
        905: '12.1',
        906: '12.19',
        907: '12.8',
        908: '13.8',
        909: '12.16',
        910: '12.5',
        911: '13.5',
        912: '12.13',
        913: '12.3',
        914: '13.2',
        915: '12.10',
        916: '13.10',
        917: '12.18',
        918: '12.6',
        919: '13.6',
        920: '12.15',
        921: '12.4',
        922: '13.3',
        923: '12.12',
        924: '12.1',
        925: '13.1',
        926: '12.8',
        927: '13.8',
        928: '12.16',
        929: '12.6',
        930: '13.5',
        931: '12.13',
        932: '12.3',
        933: '13.2',
        934: '12.9',
        935: '13.9',
        936: '12.17',
        937: '12.7',
        938: '13.7',
        939: '12.15',
        940: '12.4',
        941: '13.4',
        942: '12.12',
        943: '11.19',
        944: '12.19',
        945: '12.8',
        946: '13.8',
        947: '12.16',
        948: '12.6',
        949: '13.6',
        950: '12.14',
        951: '12.2',
        952: '13.2',
        953: '12.10',
        954: '11.18',
        955: '12.17',
        956: '12.7',
        957: '13.7',
        958: '12.16',
        959: '12.4',
        960: '13.4',
        961: '12.12',
        962: '12.1',
        963: '12.19',
        964: '12.8',
        965: '13.8',
        966: '12.17',
        967: '12.5',
        968: '13.5',
        969: '12.13',
        970: '12.2',
        971: '13.2',
        972: '12.10',
        973: '13.10',
        974: '12.18',
        975: '12.8',
        976: '13.7',
        977: '12.15',
        978: '12.4',
        979: '13.4',
        980: '12.11',
        981: '12.1',
        982: '13.1',
        983: '12.9',
        984: '13.8',
        985: '12.17',
        986: '12.6',
        987: '13.6',
        988: '12.13',
        989: '12.2',
        990: '13.2',
        991: '12.11',
        992: '13.10',
        993: '12.18',
        994: '12.8',
        995: '13.7',
        996: '12.14',
        997: '12.4',
        998: '13.3',
        999: '12.12',
        1000: '12.1'
    };
}

var monthMeaning = "Intercalary Days,Splendor,Glory,Beauty,Grandeur,Light,Mercy,Words,Perfection,Names,Might,Will,Knowledge,Power,Speech,Questions,Honor,Sovereignty,Dominion,Loftiness".split(',');
var monthAr = "Ayyám-i-Há,Bahá,Jalál,Jamál,`Azamat,Núr,Rahmat,Kalimát,Kamál,Asmá’,`Izzat,Mashíyyat,`Ilm,Qudrat,Qawl,Masá'il,Sharaf,Sultán,Mulk,`Alá’".split(',');
var gMonthLong = "January,February,March,April,May,June,July,August,September,October,November,December".split(',');


module.exports = {
    addSunTimes: addSunTimes,
    addTodayDetails: addTodayDetails,
    addTodayInfoToAnswers: addTodayInfoToAnswers,
    monthsEnglish: monthMeaning,
    monthsArabic: monthAr,
    addFeastTimes: addFeastTimes
};
