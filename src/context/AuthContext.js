import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Check admin claim
        const token = await firebaseUser.getIdTokenResult();
        setIsAdmin(!!token.claims.isAdmin);
        // Load profile
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) setProfile(snap.data());
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureProfile(result.user);
    return result.user;
  }

  async function loginWithEmail(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }

  async function registerWithEmail(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await ensureProfile(result.user, displayName);
    return result.user;
  }

  async function ensureProfile(firebaseUser, displayName) {
    const ref = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const profileData = {
        uid: firebaseUser.uid,
        displayName: displayName || firebaseUser.displayName || "Builder",
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL || null,
        projectType: null,
        bio: "",
        followersCount: 0,
        followingCount: 0,
        createdAt: serverTimestamp()
      };
      await setDoc(ref, profileData);
      setProfile(profileData);
    }
  }

  async function updateUserProfile(updates) {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    await setDoc(ref, updates, { merge: true });
    setProfile(prev => ({ ...prev, ...updates }));
  }

  function logout() {
    return signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, loginWithGoogle, loginWithEmail, registerWithEmail, updateUserProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
