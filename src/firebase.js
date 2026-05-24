import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAIWGFUCEmcE9rhwlKk6GvckOfLK_5qhNc",
  authDomain: "test-run-builtday.firebaseapp.com",
  projectId: "test-run-builtday",
  storageBucket: "test-run-builtday.firebasestorage.app",
  messagingSenderId: "558517457410",
  appId: "1:558517457410:web:3f1426a32df93339708d1b",
  measurementId: "G-8W8GH8DMBM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
