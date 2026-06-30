// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBF_SrtsqjpgbGNSQ5q0ut0SbZOA0Y-mYY",
  authDomain: "lilo-23fef.firebaseapp.com",
  projectId: "lilo-23fef",
  storageBucket: "lilo-23fef.firebasestorage.app",
  messagingSenderId: "950183292908",
  appId: "1:950183292908:web:9976691ecb3e327f941ac9",
  measurementId: "G-7FPZ6SREX3",
  databaseURL: "https://lilo-23fef-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Initialize Functions with the correct region (us-central1)
// This ensures all Cloud Functions calls connect to the correct region
const functions = getFunctions(app, 'us-central1');

// Uncomment to use Functions emulator for local development
// if (__DEV__) {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

export { auth, db, rtdb, functions };
