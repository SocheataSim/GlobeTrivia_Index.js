import { db } from '../services/firebase.js';
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from '../core/state.js';
import { showToast } from '../core/utils.js';

let lbCache = [];

function lbRef(userId) { return collection(db, 'users', userId, 'leaderboard'); }
function lbDocRef(userId, id) { return doc(db, 'users', userId, 'leaderboard', id); }

async function fetchLBFromDB(userId) {
  const q        = query(lbRef(userId), orderBy('created', 'desc'));
  const snapshot = await getDocs(q);
  lbCache        = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveScore(entry) {
  const userId = getCurrentUser()?.uid;
  if (!userId) return;
  try {
    const data = { ...entry, created: Date.now() };
    const ref  = await addDoc(lbRef(userId), data);
    lbCache.unshift({ id: ref.id, ...data });
    renderLeaderboard();
  } catch (err) { console.error('saveScore failed:', err); }
}

export function clearLeaderboard() {
  const userId = getCurrentUser()?.uid;
  if (!userId || !confirm('Clear all your scores?')) return;
  Promise.all(lbCache.map(e => deleteDoc(lbDocRef(userId, e.id))))
    .then(() => { lbCache = []; renderLeaderboard(); showToast('Leaderboard cleared.', 'error'); })
    .catch(() => showToast('❌ Failed to clear.', 'error'));
}

export function deleteLBEntry(id) {
  const userId = getCurrentUser()?.uid;
  if (!userId) return;
  deleteDoc(lbDocRef(userId, id))
    .then(() => { lbCache = lbCache.filter(x => x.id !== id); renderLeaderboard(); showToast('Quiz Result removed.', 'error'); })
    .catch(() => showToast('❌ Failed to remove.', 'error'));
}

export function renderLeaderboard() {
  const el = document.getElementById('lb-container');
  if (!el) return;

  if (!getCurrentUser()) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔐</div>
      <h3>Sign in to see your scores</h3>
      <p>Your quiz scores are saved privately to your account.</p>
      <button class="btn btn-primary empty-state-action" id="lb-login-btn">Sign In</button>
    </div>`;
    document.getElementById('lb-login-btn')?.addEventListener('click', () => document.getElementById('nav-login-btn')?.click());
    return;
  }

  if (!lbCache.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🏆</div>
      <h3>No scores yet.</h3>
      <p>Complete a quiz to see your results here!</p>
    </div>`;
    return;
  }

  const sortedCache = [...lbCache].sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    if (b.score !== a.score) return b.score - a.score;
    return b.created - a.created;
  });

  const categories = [
    { id: 'easy', label: '🌱 Easy Mode', icon: '🟢' },
    { id: 'medium', label: '⚖️ Medium Mode', icon: '🟠' },
    { id: 'hard', label: '🔥 Hard Mode', icon: '🔴' },
    { id: 'any', label: '🌐 Other Quizzes', icon: '⚪' }
  ];

  const grouped = { easy: [], medium: [], hard: [], any: [] };
  sortedCache.forEach(entry => {
    const d = entry.diff?.toLowerCase();
    if (grouped[d]) grouped[d].push(entry);
    else grouped.any.push(entry);
  });

  let html = '<div class="lb-categories-grid">';
  categories.forEach(cat => {
    const entries = grouped[cat.id];
    if (entries.length > 0) {
      html += `
        <div class="lb-category-card">
          <div class="lb-category-header">
            <h4 class="lb-category-title">${cat.label}</h4>
            <span class="lb-category-count">${entries.length}</span>
          </div>
          <div class="lb-list">
            ${entries.map((entry) => {
              const pctClass = entry.pct >= 80 ? 'good' : entry.pct >= 50 ? 'mid' : 'low';
              return `
                <div class="lb-card">
                  <div class="lb-pie-container">
                    <div class="lb-pie ${pctClass}" style="--pct: ${entry.pct}%" data-pct="${entry.pct}">
                      <span class="lb-pie-val">${entry.pct}%</span>
                    </div>
                  </div>
                  <div class="lb-main">
                    <div class="lb-top">
                      <span class="lb-score-alt">${entry.score} / ${entry.total}</span>
                      <span class="lb-date-record">${entry.date}</span>
                    </div>
                    <div class="lb-bar-mini"><div class="lb-fill ${pctClass}" style="width: ${entry.pct}%"></div></div>
                  </div>
                  <button class="btn-icon danger" data-lb-delete="${entry.id}">✕</button>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }
  });
  html += '</div>';

  el.innerHTML = (lbCache.length > 0) ? html : `
    <div class="empty-state">
      <div class="empty-icon">🏆</div>
      <h3>No scores yet.</h3>
      <p>Complete a quiz to see your results here!</p>
    </div>`;

  el.querySelectorAll('[data-lb-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteLBEntry(btn.dataset.lbDelete));
  });
  el.querySelectorAll('.lb-fill').forEach(fill => {
    setTimeout(() => { fill.style.width = `${fill.dataset.pct}%`; }, 50);
  });
}

export async function initLeaderboard(userId) {
  lbCache = [];
  if (userId) {
    try { await fetchLBFromDB(userId); } catch (err) { console.error(err); }
  }
  renderLeaderboard();
}
