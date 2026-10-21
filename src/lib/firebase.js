import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { appName, firebaseConfig, isFirebaseConfigured } from './config';
const placeholderConfig = {
    apiKey: 'not-configured',
    authDomain: 'not-configured.firebaseapp.com',
    projectId: 'not-configured',
    storageBucket: 'not-configured.appspot.com',
    messagingSenderId: '0',
    appId: 'not-configured'
};
let app;
if (isFirebaseConfigured) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig, appName);
}
else {
    // The UI blocks usage until .env is filled in; this keeps module imports safe.
    app = initializeApp(placeholderConfig, appName);
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-south1');
export { app };
