'use strict';

require('dotenv').config({
    path: './.env'
});

// var bst = require('bespoken-tools');
// var bstKey = process.env.bstKey;
// var logless = bst.Logless.middleware(bstKey);

const main = require('./scripts/main');

let express = require('express');
let expressApp = express();
expressApp.set('port', (process.env.PORT || 8006));

let bodyParser = require('body-parser');
expressApp.use(bodyParser.json({
    type: 'application/json'
}));

expressApp.get('/*', function(request, response) {
    console.log('incoming GET - should be testing only!');
    response.send('Hello from V2 at ' + new Date().toLocaleString());
});

try {
    // main incoming call
    expressApp.post('/', function(request, response) {
        console.log('post')
        return main.handlePost(request, response);
    });
} catch (error) {
    console.log(error);
}


// Start the server
let server = expressApp.listen(expressApp.get('port'), function() {
    console.log('App listening on port %s', server.address().port);
    console.log('Press Ctrl+C to quit.');
});
