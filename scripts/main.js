const externalInfo = require('./externalInfo');
const dbHelper = require('./dbHelper');
const {
    GeoPoint
} = require("@google-cloud/firestore");

const {
    actionssdk,
    dialogflow,
    Permission,
    Image,
} = require('actions-on-google');

console.log(' ');
console.log('======= SERVER RESTARTED ==============================');

var knownUsers = {};

dbHelper.db.collection('users').get()
    .then(list => {
        list.forEach(doc => knownUsers[doc.id] = doc.data());
        console.log(`Initial load from db: ${Object.keys(knownUsers).length} users.`);
        //console.log('knownusers B', knownUsers);
    }).catch(err => {
        console.log(err);
    });

const app = dialogflow({
    debug: false
});

/*
  known: {
      location: {place: 'Calgary', country: 'Canada'},
      coords: { latitude: 51, longitude: -113 },
      givenName: 'John',
      zoneName: 'America/Edmonton'
  }


*/


function getUserInfo(conv) {
    var userId = conv.user._id;
    var known = knownUsers[userId];

    if (!known) {
        known = knownUsers[userId] = {
            times: 1
        };
    }

    var ref = dbHelper.db.collection('users').doc(userId);
    ref.get().then(doc => {
            var data = doc.data();
            // console.log('user data', data);
            if (!data) {
                ref.set(known);
                console.log('added new to db');
            }
        })
        .catch(err => {
            console.log(err);
        });

    return {
        known: known,
        ref: ref
    }
}


app.intent('get date', conv => {
    var user = getUserInfo(conv);

    // if (conv.sandbox) {
    //     conv.ask(`You are in sandbox mode.`);
    // }
    conv.ask(`Hi, how is it going? I'm the fulfillment code.`);

    // var test1 = conv.contexts.input.test1;
    // console.log('test1 context: ', test1);

    // var count = (test1 && test1.parameters.count || 0) + 1;
    // conv.add(`Visit #${count}!`);

    // conv.contexts.set('test1', 2, {
    //     count: count,
    //     hello: 'test hello'
    // });
});

app.intent('event - getting permission', (conv, input, granted) => {
    if (!granted) {
        conv.ask(`That's okay. I won't be able to tell you when the Badí’ day starts or ends. If you change your mind, just tell me that you've moved and I'll ask again.`);
        return;
    }

    var userInfo = getUserInfo(conv);
    var known = userInfo.known;

    var coords = conv.device.location.coordinates;
    if (coords) {
        known.coords = new GeoPoint(coords.latitude, coords.longitude);
    }

    var p1 = externalInfo.getTimezoneInfo(known);
    var p2 = externalInfo.getLocationName(known);

    Promise.all([p1, p2]).then(x => {
        // console.log('in all', known);
        userInfo.ref.update({
            location: known.location,
            zoneName: known.zoneName
        });
    }).catch(err => {
        console.log(err);
    });

    var givenName = conv.user.storage.givenName = conv.user.name.given;
    if (givenName) {
        known.givenName = givenName;
        userRef.update({
            givenName: givenName
        });
    }

    if (known.givenName) {
        var msg = `Thanks, ${known.givenName}.`;
        if (known.location) {
            msg += ` Warmest greetings to you and your friends in ${known.location.place}, ${known.location.country}!`;
        }
        conv.ask(msg);
    } else {
        conv.ask('Thanks!');
    }
});

app.intent('Default Welcome Intent', conv => {
    console.log('Default Welcome Intent');

    var userInfo = getUserInfo(conv);
    // if (!conv.user.storage.rnd) {
    //     // test storage
    //     conv.user.storage.rnd = Math.random();
    // }

    var known = userInfo.known;
    if (known.givenName) {
        conv.ask(`Welcome back, ${known.givenName}.`);
    } else {
        conv.ask(new Permission({
            context: 'Hello, to get acquainted',
            permissions: ['NAME', 'DEVICE_PRECISE_LOCATION']
                // DEVICE_COARSE_LOCATION would be fine, but doesn't work
        }));
    }
});

app.intent('User Moved', conv => {
    conv.ask(new Permission({
        context: 'No problem',
        // DEVICE_COARSE_LOCATION would be fine, but doesn't work
        permissions: ['DEVICE_PRECISE_LOCATION']
    }));
});

module.exports = {
    app
};
