const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!process.env.FIREBASE_PROJECT_ID) {
  // Try to use application default credentials if initialized from dev server
}
// We can just wipe it locally by modifying server.ts to not restore
