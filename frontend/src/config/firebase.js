import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC25jFb7MLx8j7RxzOFvJ0yGBuQsLDq31I",
  authDomain: "study-swap-f3875.firebaseapp.com",
  projectId: "study-swap-f3875",
  storageBucket: "study-swap-f3875.firebasestorage.app",
  messagingSenderId: "187789577283",
  appId: "1:187789577283:web:51e3dae6c6f0946ac0d8f6",
  measurementId: "G-D736G1TMH9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
