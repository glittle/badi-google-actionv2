const {
    dialogflow,
    BasicCard,
    BrowseCarousel,
    BrowseCarouselItem,
    Button,
    Carousel,
    Image,
    LinkOutSuggestion,
    List,
    MediaObject,
    Permission,
    Suggestions,
    SimpleResponse,
    Table,
} = require('actions-on-google');

// const {WebhookClient} = require('dialogflow-fulfillment');

const moment = require('moment-timezone');
const util = require('util')
const badiCalc = require('./badiCalc');
const verseHelper = require('./verseHelper');
const externalInfo = require('./externalInfo');
const general = require('./general');
const dbHelper = require('./db');

console.log(' ');
console.log('======= SERVER RESTARTED ==============================');


var knownUsers = null;

dbHelper.knownUsersRef.once('value', function(snapshot) {
    knownUsers = snapshot.val() || {};
    console.log('initial load from db', Object.keys(knownUsers).length, 'users.');
    // console.log(knownUsers);
});


const appV2 = dialogflow({
    // debug: true,
});


function handlePost(request, response) {

    var now = new Date();
    var body = request.body;
    var conv = null;
    var userInfo = {};
    var userId = '';
    var userRef = {};

    // console.log('address', request.connection.remoteAddress)

    console.log('\r\n\r\n---------------------------');
    console.log('------ incoming POST ------');
    console.log(`------ ${now.toLocaleTimeString()} ---`);
    // console.log('request body:');
    // console.log(util.inspect(request.body));
    // console.log('---------------------------');
    // return;
    // appV2.intent('Welcome', (conv, { name }) => {
    //     conv.ask(`How are you?`);
    //     console.log(conv);
    // });

    // appV2.catch((conv, error) => {
    //     conv.tell(`Test 123!`);
    //     console.error(error);
    // });

    // appV2.fallback((conv) => {
    //     console.log(conv.intent);
    //     conv.ask(`I couldn't understand. Can you say that again and again?`);
    // });

    // appV2(request, response);

    // return;
    // console.log(request);

    // if (appV1.getArgument('is_health_check') === '1') {
    //     console.log('Health Check. Doing great!')
    //     appV1.tell(`Thanks for the health check! I'm feeling great!`)
    //     return;
    // }

    // console.log('Intent:', appV1.getIntent());
    // console.log('Intent name:', body.result.metadata.intentName);
    // console.log('From:', body.originalRequest.source, " Version:", body.originalRequest.version);
    // console.log('Parameters:', body.result.parameters);
    // console.log('Body', JSON.stringify(body));

    // console.log('users', knownUsers);



    // console.log(appV2.getUser())

    // try {
    //   console.log(4)
    //   appV1.askForPermission('To address you by name', [appV1.SupportedPermissions.NAME]);
    //   console.log(5);
    // } catch (error) {
    //   console.log(3, error)
    // }

    function welcome() {
        // console.log('default welcome')
        if (!userInfo || !userInfo.coord) {
            // conv.askForPermission('Hello! Welcome to the "Badíʿ Calendar"!  Before we get started, to give you correct answers, ', conv.SupportedPermissions.DEVICE_PRECISE_LOCATION);
            conv.ask(new Permission({
                // need split speech/text
                context: 'Hello from "Badi Today"!  Before we get started, to know when sunset is in your area, ',
                permissions: 'DEVICE_PRECISE_LOCATION'
            }));
            return;
        }

        // app.setContext('location_known', 99, userInfo.coord);
        askWithoutWhatElse([
            `allowabha! What would you like to hear? Say \'Help\' if you would like some tips!`
        ], [
            'Alláh-u-Abhá! What would you like to hear?\n\nSay "help" if you would like some tips!'
        ]);
    }

    function tellSunset() {
        var speech = [];
        var text = [];
        var daysAway = 0;

        badiCalc.addSunTimes(userInfo, speech, text);

        ask(speech, text, conv.isDeepLink);

        if (conv.isDeepLink) {
            conv.close();
        }
    }

    function tellFeast() {
        var speech = [];
        var text = [];
        var useArNames = conv.parameters.language === 'arabic';

        badiCalc.addFeastTimes(userInfo, useArNames, speech, text);

        ask(speech, text, conv.isDeepLink);

        if (conv.isDeepLink) {
            conv.close();
        }
    }

    function tellVerse() {
        tell('verse');
    }

    function tellDate() {
        tell('date');
    }

    function tellDateAndVerse() {
        tell('both');
    }

    function tellDateFull() {
        var speech = [];
        var text = [];

        var useArNames = conv.parameters.language === 'arabic';

        badiCalc.addTodayDetails(useArNames, userInfo, speech, text);
        ask(speech, text);
    }

    function tellAgain() {
        var repeatNum = +conv.parameters.repeatNum || 1;
        console.log('last', repeatNum, userInfo.lastRequest);
        var lastTopic = userInfo.lastRequest || 'verse';
        tell(lastTopic, true, repeatNum);
    }

    function tell(topic, again, repeatNum) {
        userRef.update({
            lastRequest: topic
        });
        userInfo.lastRequest = topic;

        const voiceNormal = '<voice gender="female" variant="2">';
        const voiceVerse = '<voice gender="male" variant="2">';
        const voiceEnd = '</voice>';

        var speech = [];
        var text = [];
        speech.push(voiceNormal);

        if (topic === 'date' || topic === 'both') {
            badiCalc.addTodayInfoToAnswers(userInfo, speech, text);
        }
        if (topic === 'both') {
            speech.push('<break time="2s"/>');
            text.push('\n');
        }
        if (topic === 'verse' || topic === 'both') {
            var now = moment.tz(userInfo.zoneName);
            console.log(conv.parameters.verseTime);
            var info = verseHelper.forNow(now, conv.parameters.verseTime);
            if (again) {
                repeatNum = repeatNum || 1;
                for (var r = 0; r < repeatNum; r++) {
                    if (r > 0) {
                        speech.push('<break time="5s"/>');
                        text.push('\n  \n  \n');
                    }
                    if (r > 0 || repeatNum > 1) {
                        speech.push(`<say-as interpret-as="ordinal">${r + 1}</say-as>`);
                        text.push(`${r + 1}:\n`);
                        speech.push('<break time="1s"/>');
                    }
                    speech.push(voiceEnd);
                    speech.push(voiceVerse);

                    speech.push(general.cleanVerseForSpeech(info.verse));
                    text.push(info.verse);

                    speech.push(voiceEnd);
                    speech.push(voiceNormal);

                }
            } else {
                const intro = info.forEvening ?
                    "The evening verse for today is: " :
                    "The morning verse for today is: ";
                speech.push(intro);
                text.push(intro + '\n\n');
                speech.push('<break time="1s"/>');
                speech.push(voiceEnd);

                speech.push(voiceVerse);

                speech.push(general.cleanVerseForSpeech(info.verse));
                text.push(info.verse);
                // speak.push(` - Bahá'u'lláh.  `);

                speech.push(voiceEnd);
                speech.push(voiceNormal);

                if (!conv.isDeepLink) {
                    speech.push('<break time="2s"/>');
                    speech.push('(We can repeat that a number of times if you wish. Just let me know how many times!)');
                    text.push('\n  \n  \n(We can repeat that a number of times if you wish. Just let me know how many times!)');
                }
            }
        }

        if (speech.length <= 2) {
            general.addToBoth(`Sorry, I didn't understand that. Please try again!`, speech, text);
        } else {
            if (!conv.isDeepLink) {
                addWhatElse(speech, text);
            }
        }

        speech.push(voiceEnd);

        askWithoutWhatElse(speech, text);

        if (conv.isDeepLink) {
            conv.close();
        }
    }

    function askWithoutWhatElse(speech, text) {
        ask(speech, text, true);
    }

    function ask(speech, text, doNotAddWhatElse) {
        if (!doNotAddWhatElse) {
            addWhatElse(speech, text);
        }

        speech = speech.join(' ');
        text = text.join(' ');

        console.log('Text', text);
        console.log('Speech', speech);
        const maxAnswerLength = 640;

        if (text.length > maxAnswerLength) {
            while (text.length > maxAnswerLength) {
                // find 2nd last space...
                var space = text.lastIndexOf(' ', text.lastIndexOf(' ', maxAnswerLength) - 1);
                var part1 = text.substring(0, space);
                text = text.substring(space + 1);
                if (speech) {
                    conv.ask(new SimpleResponse({
                        speech: '<speak>' + speech + '</speak>',
                        text: part1
                    }));
                    speech = null;
                } else {
                    conv.ask(part1);
                }
            }
            if (text) {
                conv.ask(text);
            }
        } else {
            conv.ask(new SimpleResponse({
                speech: '<speak>' + speech + '</speak>',
                text: text
            }));
        }
    }

    function addWhatElse(speech, text) {
        const msgs = [
            'What else would you like to hear?',
            'What else would you like to know?',
            'What else would you like to learn?',
            'What else can I tell you?',
            'What more can I tell you?'
        ]
        var max = msgs.length;
        var msg = msgs[Math.floor(Math.random() * (max - 1))];

        speech.push('<break time="1s"/>' + msg);
        text.push('\n\n' + msg);
    }

    function receiveLocation() {
        const location = conv.device.location;
        let userInfo = userId ? knownUsers[userId] : {}; // if not known, use dummy object
        if (location) {
            /*
               Device {
                  location:
                   { coordinates: { latitude: 51.1000941, longitude: -113.9594449 },
                     formattedAddress: 'Castleridge Boulevard Northeast, Calgary, Alberta ',
                     city: 'Calgary' } }
            */
            var coordRaw = location.coordinates;
            let coord = {
                lat: coordRaw.latitude,
                lng: coordRaw.longitude
            };

            userInfo.coord = coord;
            userInfo.location = location.city || '';

            externalInfo.getTimezoneInfo(userRef, userId, userInfo);

            let msg = [`Thank you! Google says you are in ${userInfo.location}. What would you like to hear now?  Say Help if you want to learn what I can do.`];
            askWithoutWhatElse(msg, msg);

        } else {
            let coord = {
                lat: 32.8033872,
                lng: 34.9858567
            };
            userInfo.coord = coord;
            userInfo.location = 'Haifa';

            externalInfo.getTimezoneInfo(userRef, userId, userInfo);

            let msg = [`Okay. I'll give you answers as if you were in Haifa Israel! The fix that later, say "Change my location".`];
            askWithoutWhatElse(msg, msg);
        }

        if (userId) {
            userRef.update({
                coord: userInfo.coord,
                location: userInfo.location
            });
        }
    }

    function spacedOut(s) {
        return s.split('').join(' ');
    }

    function whoAmI() {
        //    <say-as interpret-as="characters">${spacedOut(userId)}</say-as>
        var speech = [userId ?
            userId !== 'sandbox' ?
            `All I have is an ID of ${spacedOut(userId)} (Wow! That was quite a mouthful!)` :
            `You are using the sandbox, you don't have a real ID.` :
            `Sorry, I don't know who you are.`
        ];

        var text = [userId ?
            userId !== 'sandbox' ?
            `All I have is an ID of ${userId}.` :
            `You are using the sandbox, you don't have an ID.` :
            `Sorry, I don't know who you are.`
        ];

        ask(speech, text);
    }

    function tellMonthNames() {
        var lang = conv.parameters.language || 'english';
        var doBoth = lang === 'both';
        var list = lang === 'arabic' ? badiCalc.monthsArabic : badiCalc.monthsEnglish;

        console.log(lang, list);

        var speech = [];
        var text = [];

        // if (lang === 'arabic') {
        //     speak.push('(Please excuse my pronounciation!) ')
        // }
        general.addToBoth('Here are the names of the months in the Badíʿ Calendar:\n', speech, text);
        for (var i = 1; i < list.length; i++) {
            var item = list[i];
            item = item.replace(/[`’ʿ]/g, '');

            speech.push(`${i}<break time="1s"/>`);
            text.push(`${i}: `);

            if (doBoth) {
                // element is already in English
                var ar = badiCalc.monthsArabic[i].replace(/[`’ʿ]/g, '');

                speech.push(`${ar} <break time=".5s"/> ${item}`);
                text.push(`${ar} - ${item}\n`);

            } else {
                speech.push(`${item}`);
                text.push(`${item}\n`);
            }
            speech.push(`<break time="2s"/>`);

        }

        ask(speech, text);
    }

    function resetLocation() {
        if (userId) {
            var userInfo = knownUsers[userId];
            delete userInfo.coord;
            delete userInfo.location;
            delete userInfo.zoneName;
            userRef.set(userInfo);
        }

        conv.user.permissions = null;

        // conv.askForPermission('Sure. ', conv.SupportedPermissions.DEVICE_PRECISE_LOCATION);
        conv.ask(new Permission({
            context: 'Sure. ',
            permissions: 'DEVICE_PRECISE_LOCATION',
        }));
    }

    function tellLocation() {
        var speech = [];
        var text = [];
        var known = false;
        if (userInfo.location) {
            speech.push(`From what I've learned, you are in ${userInfo.location}.`);
            text.push(`From what I've learned, you are in ${userInfo.location}.`);
        } else {
            speech.push(`Sorry, I don't know where you are!`);
            text.push(`Sorry, I don't know where you are!`);
        }

        if (userInfo.zoneName) {
            speech.push(`You are in the ${userInfo.zoneName.replace(/\//, ': ').replace(/_/g, ' ')} timezone.`);
            text.push(`You are in the ${userInfo.zoneName} timezone.`);

            var now = moment.tz(userInfo.zoneName);
            var time = now.format('h:mm a');

            speech.push(`It is about <say-as interpret-as="time" format="hms12">${time}</say-as> right now.`);
            text.push(`It is about ${time} right now.`);

        } else {
            speech.push(`I don't know what timezone you are in.`);
            text.push(`I don't know what timezone you are in.`);
        }

        let msg = `To update this, say "Change my location".`;
        speech.push(msg);
        text.push(msg);

        ask(speech, text);
    }


    function tellUsers() {
        var speech = [];
        var text = [];

        var locations = {};
        const somewhere = 'an unknown location';

        Object.keys(knownUsers).forEach(function(key) {
            var u = knownUsers[key];
            var loc = u.location || somewhere;
            if (loc) {
                if (locations[loc]) {
                    locations[loc]++;
                } else {
                    locations[loc] = 1;
                }
            }
        });
        var array1 = [];
        Object.keys(locations).forEach(function(key) {
            var num = locations[key];
            array1.push({
                l: key,
                num: num
            });
        });
        array1.sort(function(a, b) {
            return a.num > b.num ? -1 : 1;
        });
        var array2 = array1.map(x => x.num === 1 ? x.l : `${x.l} (${x.num} people)`);
        if (array2.length > 1) {
            array2[array2.length - 1] = 'and ' + array2[array2.length - 1];
        }

        speech.push(`I've talked to ${Object.keys(knownUsers).length} people so far from ${array2.length} locations: ${array2.join(', ')}.`);

        text.push(`I've talked to ${Object.keys(knownUsers).length} people so far from ${array2.length} locations! \n${array2.join('\n')}.`);

        ask(speech, text);
    }

    function getUserInfo() {

        userId = conv.data.Id || conv.user.storage.Id || '';

        if (!userId) {
            var verified = conv.user.verification === 'VERIFIED';

            if (verified) {
                userId = general.makeUserId();
                conv.user.storage.Id = userId;
                conv.data.Id = userId;
                console.log('New id: ', conv.user.storage.Id);
            } else {
                userId = '';
            }
        }

        if (!userId) {
            console.log('No id');
            return;
        }

        // user.storage sometimes doesn't work
        conv.data.Id = userId;

        console.log('Using id: ', userId);

        // determine who this is
        // userId = general.extractUserId(request);
        // console.log('userId', userId)
        userInfo = knownUsers[userId];
        if (!userInfo) {
            userInfo = knownUsers[userId] = {
                times: 1
            };
        }
        console.log('userInfo', userInfo);

        userRef = dbHelper.knownUsersRef.child(userId);

        var times = (userInfo.times || 1) + 1;
        userInfo.last_access = now;
        userInfo.times = times;

        userRef.update({
            times: times,
            last_access: now
        });
    }

    let actionMap = new Map();

    appV2.fallback((incomingConv) => {

        // assign to global
        conv = incomingConv;
        console.log('User Storage', conv.user.storage);
        console.log('Data', conv.data);

        conv.isDeepLink = conv.type === 'NEW';

        getUserInfo();

        console.log('User', conv.user);
        console.log('Parameters', conv.parameters);
        // console.log('Type', conv.type);
        // console.log('Device', conv.device);


        const fn = actionMap.get(conv.action);
        console.log(`Intent: ${conv.action} (${conv.intent}) --> ${fn.name}`);

        if (fn) {
            fn();
            return;
        }

        conv.ask(`I couldn't understand. Can you say that again and again?`);
    });


    actionMap.set('input.welcome', welcome);
    actionMap.set('Welcome.Welcome-fallback', receiveLocation);

    actionMap.set('get.verse', tellVerse);
    actionMap.set('get.date', tellDate);
    actionMap.set('get.both', tellDateAndVerse);
    actionMap.set('get.date.full1', tellDateFull);

    actionMap.set('tell.again', tellAgain);

    actionMap.set('get.names', tellMonthNames);
    actionMap.set('get.feast', tellFeast);

    actionMap.set('change.location', resetLocation);
    actionMap.set('Changelocation.Changelocation-fallback', receiveLocation);

    actionMap.set('where.am.i', tellLocation);
    actionMap.set('when.is.sunset', tellSunset);

    actionMap.set('who_am_i', whoAmI);
    actionMap.set('user.list', tellUsers);

    appV2(request, response);
}


module.exports = {
    handlePost
};
