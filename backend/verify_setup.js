const { db } = require('./firebaseConfig');

async function testConnection() {
    console.log('🔍 Testing Firebase Firestore connection...');
    try {
        const testDoc = await db.collection('system_checks').add({
            test: true,
            timestamp: new Date().toISOString(),
            message: "Setup verification successful"
        });
        console.log('✅ Successfully wrote to Firestore! ID:', testDoc.id);
        await db.collection('system_checks').doc(testDoc.id).delete();
        console.log('✅ Successfully cleaned up test document.');
        console.log('\n🌟 YOUR SETUP IS COMPLETE! You can now start the server.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection test failed!');
        console.error('Possible issues:');
        console.error('1. Your serviceAccountKey.json might be invalid or for a different project.');
        console.error('2. Firestore Database hasn\'t been "created" in the Firebase Console yet.');
        console.error('3. You are offline.');
        console.error('\nError Details:', err.message);
        process.exit(1);
    }
}

testConnection();
