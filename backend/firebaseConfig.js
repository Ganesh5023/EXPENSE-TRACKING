const admin = require('firebase-admin');
const path = require('path');

try {
    let serviceAccount;

    // 1. First try to load from Environment Variable (for Render/Production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('✅ Loaded Firebase credentials from Environment Variable');
    } 
    // 2. Fallback to local file (for local development)
    else {
        const serviceAccountKeyPath = path.join(__dirname, 'serviceAccountKey.json');
        serviceAccount = require(serviceAccountKeyPath);
        console.log('✅ Loaded Firebase credentials from local file');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK Initialized Successfully');
} catch (error) {
    console.warn('⚠️ Could not initialize Firebase Admin SDK. Please set FIREBASE_SERVICE_ACCOUNT or add serviceAccountKey.json.');
    console.error(error.message);
}

const db = admin.firestore();

module.exports = { db };
