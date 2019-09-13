// https://www.npmjs.com/package/node-rest-client

const Client = require('node-rest-client-promise').Client();

function getTimezoneInfo(known) {
    // refernce https://timezonedb.com/references/get-time-zone

    var coords = known.coords;
    var params = {
        key: process.env.timeZoneKey,
        format: 'json',
        fields: 'zoneName,formatted',
        by: 'position',
        lat: coords.latitude,
        lng: coords.longitude,
    };
    var host = 'https://api.timezonedb.com/v2/get-time-zone?';
    var query = toQueryString(params);

    var p = Client.getPromise(host + query);
    return p.then(info => {
        var data = info.data;
        known.zoneName = data.zoneName;
        // console.log('returning from get zone');
    });
}

function getLocationName(known) {
    var coords = known.coords;
    var url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}`;

    var p = Client.getPromise(url);
    return p.then(info => {

        var results = info.data.results;
        var place = '';
        var country = '';

        // get longest locality
        for (var r = 0; r < results.length; r++) {
            var components = results[r].address_components;
            for (var i = 0; i < components.length; i++) {
                var component = components[i];
                if (component.types.includes('locality')) {
                    // longest locality
                    if (component.short_name.length > place.length) {
                        place = component.short_name;
                    }
                }
                if (component.types.includes('country')) {
                    country = component.long_name;
                }
            }
        }

        if (!place) {
            place = 'an unknown location';
        }
        if (!country) {
            country = 'an unknown country';
        }

        console.log(`==> ${place}, ${country}`);

        known.location = {
            place,
            country
        };
        // userInfo.ref.update({
        //     location: userInfo.known.location
        // });
        // console.log('returning from get location');
    });
}

function toQueryString(obj) {
    return Object.keys(obj).map(k => {
            return encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]);
        })
        .join("&");
}

module.exports = {
    getTimezoneInfo,
    getLocationName
};
