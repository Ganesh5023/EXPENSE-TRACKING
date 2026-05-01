const admin = require('firebase-admin');
const path = require('path');

// To get this file, go to your Firebase Console:
// 1. Settings > Project Settings > Service accounts
// 2. Click "Generate new private key"
// 3. Save it as backend/serviceAccountKey.json

const serviceAccountKeyPath = path.join(__dirname, 'serviceAccountKey.json');

try {
    const serviceAccount = require(serviceAccountKeyPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK Initialized with Service Account');
} catch (error) {
    console.warn('⚠️ Could not find serviceAccountKey.json. Attempting to initialize with default credentials...');
    admin.initializeApp();
}

const db = admin.firestore();

module.exports = { db };
