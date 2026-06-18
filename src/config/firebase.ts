import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Secure Firebase configuration. Prepares to receive ENV variables.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBOqTZTgkFYfnd318pJTlWC86oSjXzb3mE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pvt-chat-df40d.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://pvt-chat-df40d-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pvt-chat-df40d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pvt-chat-df40d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "506549084982",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:506549084982:web:3b3af391261aab8e53c997",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DSKGN9ZWEF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export default app;
