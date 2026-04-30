// src/services/firebase.js

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  getAuth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ── Firebase Config ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyArDpmLSj1TNEXmbWeQW1iXicH00z_eHI8",
  authDomain: "automate-a4cee.firebaseapp.com",
  projectId: "automate-a4cee",
  storageBucket: "automate-a4cee.appspot.com",
  messagingSenderId: "170566136505",
  appId: "1:170566136505:web:e94f6927e395dbaca0e168"
};

// ── Initialize App (singleton) ─────────────────────────
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

// ── Initialize Auth (singleton) ────────────────────────
export const auth = (() => {
  try {
    // If already initialized, get the existing instance
    return getAuth(app);
  } catch (e) {
    // Otherwise, initialize with persistence
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
})();

// ── Firestore ──────────────────────────────────────────
export const db = getFirestore(app);

// ── Auth helpers ──────────────────────────────────────
export const registerUser = async (fullName, email, password) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  await updateProfile(user, { displayName: fullName });

  await setDoc(doc(db, 'users', user.uid), {
    fullName,
    email,
    createdAt: serverTimestamp(),
    uid: user.uid,
  });

  return user;
};

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export {
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
};