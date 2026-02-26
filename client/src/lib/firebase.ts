// ✅ FILE: client/src/lib/firebase.ts
// Fix: remove `any` in catch + make error handling typed without eslint violations

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCCaTBZ8hxGFilKz-0HrulxCUtZ6XhZ5PA",
  authDomain: "instabrasil-91039.firebaseapp.com",
  projectId: "instabrasil-91039",
  storageBucket: "instabrasil-91039.firebasestorage.app",
  messagingSenderId: "923323771134",
  appId: "1:923323771134:web:7c0cd5d705e5680190ddaf",
  measurementId: "G-FCGC93W9FQ"
};

export function initFirebase() {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
}

export const auth = () => getAuth();
export const db = () => getFirestore();

function getErrorCode(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "";
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

export async function signInAnon() {
  const a = auth();
  if (a.currentUser) return a.currentUser;

  try {
    try {
      await setPersistence(a, browserLocalPersistence);
    } catch {
      await setPersistence(a, browserSessionPersistence);
    }

    const cred = await signInAnonymously(a);
    return cred.user;
  } catch (err: unknown) {
    const code = getErrorCode(err);

    if (code === "auth/configuration-not-found") {
      console.error(
        [
          "Firebase Auth configuration not found.",
          "✅ Fix:",
          "1) Firebase Console → Authentication → Sign-in method",
          "2) Enable 'Anonymous' provider → Save",
          "3) Authentication → Settings → Authorized domains → add localhost + your deploy domain"
        ].join("\n")
      );
    } else {
      console.error("Firebase Auth error:", getErrorMessage(err));
    }

    throw err;
  }
}