var firebaseAdmin = require("firebase-admin");
var serviceAccount = require("../firebaseAccount.json");

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
});

var db = firebaseAdmin.firestore();
db.settings({
    timestampsInSnapshots: true
});

var usage = db.collection('general').doc('usage');

usage.get()
    .then(doc => {
        //        console.log('usage info', doc.data());
        usage.update({
            last_access: new Date()
        });

    }).catch(err => {
        console.error(err);
    });



module.exports = {
    db
}
