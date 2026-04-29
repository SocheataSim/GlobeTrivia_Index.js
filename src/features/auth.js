import { auth, db } from '../services/firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { setCurrentUser } from '../core/state.js';
import { showToast } from '../core/utils.js';

//  STATE
export let currentUser = null;

//  AUTH STATE LISTENER
export function initAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    setCurrentUser(user);
    if (user) {
      updateNavUser(user);
      await onLogin(user);
    } else {
      updateNavUser(null);
      onLogout();
    }
  });
}

//  REGISTER
export async function register() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  clearAuthErrors();

  let valid = true;
  if (!name)                         { showAuthError('err-reg-name',     'Name is required.');           valid = false; }
  if (!email)                        { showAuthError('err-reg-email',    'Email is required.');          valid = false; }
  if (password.length < 6)           { showAuthError('err-reg-password', 'Minimum 6 characters.');      valid = false; }
  if (password !== confirm)          { showAuthError('err-reg-confirm',  'Passwords do not match.');    valid = false; }
  if (!valid) return;

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      name, email, created: serverTimestamp()
    });
    closeAuthModal();
    showToast(`👋 Welcome, ${name}!`);
  } catch (err) {
    console.error('Register error:', err);
    showAuthError('err-reg-email', friendlyError(err.code));
  } finally {
    btn.disabled = false; btn.textContent = 'Create Account';
  }
}

//  LOGIN
export async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  clearAuthErrors();

  let valid = true;
  if (!email)    { showAuthError('err-login-email',    'Email is required.');    valid = false; }
  if (!password) { showAuthError('err-login-password', 'Password is required.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
    showToast('✅ Welcome back!');
  } catch (err) {
    console.error('Login error:', err);
    showAuthError('err-login-password', friendlyError(err.code));
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

//  LOGOUT
export async function logout() {
  await signOut(auth);
  showToast('👋 Signed out.', 'info');
  window.location.hash = '#home';
}

//  NAV USER DISPLAY
function updateNavUser(user) {
  const guestEl  = document.getElementById('nav-guest');
  const userEl   = document.getElementById('nav-user');
  const nameEl   = document.getElementById('nav-username');
  if (!guestEl || !userEl) return;
  if (user) {
    guestEl.style.display = 'none';
    userEl.style.display  = 'flex';
    if (nameEl) nameEl.textContent = user.displayName || user.email.split('@')[0];
  } else {
    guestEl.style.display = 'flex';
    userEl.style.display  = 'none';
  }
}

//  MODAL HELPERS
export function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal').classList.add('open');
  switchAuthTab(tab);
}
export function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.remove('open');
  clearAuthErrors();
  ['reg-name','reg-email','reg-password','reg-confirm','login-email','login-password']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}
export function switchAuthTab(tab) {
  document.getElementById('auth-login-panel')?.classList.toggle('is-hidden', tab !== 'login');
  document.getElementById('auth-reg-panel')?.classList.toggle('is-hidden', tab !== 'register');
  document.getElementById('auth-tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function clearAuthErrors() {
  ['err-reg-name','err-reg-email','err-reg-password','err-reg-confirm',
   'err-login-email','err-login-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':    'This email is already registered.',
    'auth/invalid-email':           'Invalid email address.',
    'auth/weak-password':           'Password is too weak.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/too-many-requests':       'Too many attempts. Try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
