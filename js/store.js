// =====================================================================
//  store.js — saves and loads patient files.
//   • Local mode  : browser storage on this device only.
//   • Cloud mode  : Firebase (login + live sync across all devices).
//  Each user only sees their own patients (see firestore.rules).
// =====================================================================
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LOCAL_KEY = 'pn_patients_v1';
const clean = (o) => JSON.parse(JSON.stringify(o)); // removes undefined values

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

class LocalStore {
  constructor() { this.mode = 'local'; this.user = null; this.listeners = []; }
  async init(onAuth) { onAuth(null); }
  _read() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; } }
  _write(all) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); }
    catch (e) { alert('Could not save on this device: ' + e.message); }
    this.listeners.forEach((cb) => cb(Object.values(all)));
  }
  subscribe(cb) { this.listeners.push(cb); cb(Object.values(this._read())); return () => { this.listeners = this.listeners.filter((x) => x !== cb); }; }
  async save(p) { const all = this._read(); p.updatedAt = new Date().toISOString(); all[p.id] = clean(p); this._write(all); }
  async remove(id) { const all = this._read(); delete all[id]; this._write(all); }
}

class FirebaseStore {
  constructor() { this.mode = 'cloud'; this.user = null; this.unsub = null; }
  async init(onAuth) {
    const [{ initializeApp }, auth, fs] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js'),
    ]);
    this.a = auth; this.f = fs;
    const app = initializeApp(firebaseConfig);
    this.auth = auth.getAuth(app);
    try {
      // Offline cache: the app keeps working without internet and syncs later.
      this.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch { this.db = fs.getFirestore(app); }
    auth.onAuthStateChanged(this.auth, (u) => { this.user = u; onAuth(u); });
  }
  signIn(email, pw) { return this.a.signInWithEmailAndPassword(this.auth, email, pw); }
  signUp(email, pw) { return this.a.createUserWithEmailAndPassword(this.auth, email, pw); }
  reset(email) { return this.a.sendPasswordResetEmail(this.auth, email); }
  signOut() { return this.a.signOut(this.auth); }
  _col() { return this.f.collection(this.db, 'users', this.user.uid, 'patients'); }
  subscribe(cb) {
    if (!this.user) { cb([]); return () => {}; }
    return this.f.onSnapshot(this._col(), (snap) => cb(snap.docs.map((d) => d.data())),
      (err) => alert('Sync error: ' + err.message));
  }
  async save(p) {
    p.updatedAt = new Date().toISOString();
    p.ownerUid = this.user.uid;
    await this.f.setDoc(this.f.doc(this._col(), p.id), clean(p));
  }
  async remove(id) { await this.f.deleteDoc(this.f.doc(this._col(), id)); }
}

export const store = firebaseConfig ? new FirebaseStore() : new LocalStore();
