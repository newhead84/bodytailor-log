import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

let currentUid = null;
export function setUid(uid) {
  currentUid = uid;
}

// Mirrors the shape of Claude's artifact window.storage API:
// get(key) -> { key, value, shared } | null
// set(key, value) -> { key, value, shared } | null
// Each key becomes one Firestore document at users/{uid}/data/{key}.
export const storage = {
  async get(key) {
    if (!currentUid) throw new Error("not signed in yet");
    const ref = doc(db, "users", currentUid, "data", key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { key, value: snap.data().value, shared: false };
  },
  async set(key, value) {
    if (!currentUid) throw new Error("not signed in yet");
    const ref = doc(db, "users", currentUid, "data", key);
    await setDoc(ref, { value, updatedAt: Date.now() });
    return { key, value, shared: false };
  },
};
