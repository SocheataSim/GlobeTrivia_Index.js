import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser, authReady } from '../core/state.js';
import { navigateTo } from '../core/router.js';
import { db } from '../services/firebase.js';
import { searchCountryByName } from './explore.js';
import { renderLeaderboard, clearLeaderboard } from './leaderboard.js';

export async function renderHistorySection() {
  // Wait for Firebase Auth to restore the session before checking the user.
  // Without this, getCurrentUser() returns null on every page refresh.
  const content = document.getElementById('history-content');
  if (content) {
    content.innerHTML = `<div class="loading-state"><p>Loading history…</p></div>`;
  }

  await authReady;

  const user = getCurrentUser();
  if (!user?.uid) {
    renderHistoryLogin();
    return;
  }

  try {
    const [notesSnapshot, historySnapshot] = await Promise.all([
      getDocs(query(collection(db, 'users', user.uid, 'notes'), orderBy('created', 'desc'))),
      getDocs(query(collection(db, 'users', user.uid, 'history'), orderBy('created', 'desc')))
    ]);

    const notes = notesSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const history = historySnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));


    const countryMap = new Map();

    const upsert = (country, activity, note = null) => {
      if (!country) return; 
      if (!countryMap.has(country)) {
        countryMap.set(country, { lastActivity: null, notes: [] });
      }
      const entry = countryMap.get(country);
      
      if (activity != null) {
        const incoming = getDateValue(activity);
        const existing = getDateValue(entry.lastActivity);
        if (incoming > existing) {
          entry.lastActivity = activity;
        }
      }
      if (note) entry.notes.push(note);
    };

    history.forEach((item) => upsert(item.country, item.created));
    notes.forEach((note) => upsert(note.country, note.created, note));

    // Fetch flag URLs for all countries in parallel from REST Countries API
    const countryNames = Array.from(countryMap.keys());
    const flagMap = await fetchFlagMap(countryNames);

    const countries = Array.from(countryMap.entries())
      .map(([country, data]) => ({
        country,
        notes: data.notes,
        noteCount: data.notes.length,
        lastActivity: data.lastActivity,
        flagUrl: flagMap.get(country) || null
      }))
      .sort((a, b) => getDateValue(b.lastActivity) - getDateValue(a.lastActivity));

    renderHistory(countries);
  } catch (error) {
    console.error('Fetch history error:', error);
    if (content) content.innerHTML = '<p>Failed to load history. Please try again.</p>';
  }
}

function renderHistoryLogin() {
  document.getElementById('history-content').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon"></div>
      <h3>Sign in to view history</h3>
      <p>Your learning history is saved privately to your account.</p>
      <button class="btn btn-primary empty-state-action" id="history-login-btn">Sign In</button>
    </div>
  `;
  document.getElementById('history-login-btn')?.addEventListener('click', () =>
    document.getElementById('nav-login-btn')?.click()
  );
}

function renderHistory(countries) {
  const content = document.getElementById('history-content');
  if (!content) return;

  if (!countries.length) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <h3>No history yet</h3>
        <p>Start exploring countries to build your learning history.</p>
        <button class="btn btn-primary empty-state-action" id="history-explore-btn">Explore Countries</button>
      </div>
    `;
    document.getElementById('history-explore-btn')?.addEventListener('click', () => navigateTo('home'));
    return;
  }

  content.innerHTML = `
    <div class="history-stats">
      <div class="stat-item">
        <span class="stat-num">${countries.length}</span>
        <span class="stat-label">Countries Explored</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">${countries.reduce((sum, c) => sum + c.noteCount, 0)}</span>
        <span class="stat-label">Notes Taken</span>
      </div>
    </div>
    <div class="history-grid ${countries.length > 4 ? 'collapsed' : ''}" id="history-grid">
      ${countries.map((country) => `
        <div class="history-card" data-country="${country.country}">
          <div class="history-card-flag">
            ${country.flagUrl
              ? `<img src="${country.flagUrl}" alt="${country.country} flag" class="history-flag-img" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
              : ''
            }
            <span class="history-flag-emoji" style="display:${country.flagUrl ? 'none' : 'flex'}">${getEmojiFlag()}</span>
          </div>
          <div class="history-card-body">
            <h3 class="history-card-name">${country.country}</h3>
            <span class="history-card-date">${formatDate(country.lastActivity)}</span>
            <div class="history-card-metrics">
              <span class="history-card-metric">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                ${country.noteCount} note${country.noteCount !== 1 ? 's' : ''}
              </span>
            </div>
            ${country.notes.length ? `
              <div class="history-card-previews">
                ${country.notes.slice(0, 2).map(n => 
                  `<div class="history-note-preview">
                    ${escapeHtml(n.content?.slice(0, 40) || '')}
                  </div>`
                ).join('')}
              </div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    ${countries.length > 4 ? `
      <div class="see-more-wrap">
        <button class="btn btn-ghost see-more-btn" id="history-see-more-btn">
          See More 
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 4px">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>` : ''}

    <div class="history-lb-section">
      <div class="history-lb-header">
        <h3 class="history-lb-title">🏆 Quiz Scores</h3>
        <button class="btn btn-danger btn-sm" id="history-clear-lb-btn">Clear All</button>
      </div>
      <div class="card" id="lb-container"></div>
    </div>
  `;

  document.getElementById('history-see-more-btn')?.addEventListener('click', (e) => {
    const grid = document.getElementById('history-grid');
    if (grid) {
      grid.classList.remove('collapsed');
      e.currentTarget.parentElement.remove();
    }
  });

  document.getElementById('history-clear-lb-btn')?.addEventListener('click', clearLeaderboard);

  renderLeaderboard();
}

async function fetchFlagMap(countryNames) {
  const flagMap = new Map();
  if (!countryNames.length) return flagMap;
  try {
    const res = await fetch('https://restcountries.com/v3.1/all?fields=name,flags');
    if (!res.ok) return flagMap;
    const data = await res.json();
    const lookup = new Map(data.map(c => [c.name.common.toLowerCase(), c.flags?.png || c.flags?.svg || null]));
    countryNames.forEach(name => {
      const url = lookup.get(name.toLowerCase());
      if (url) flagMap.set(name, url);
    });
  } catch {
  }
  return flagMap;
}

function getEmojiFlag() {
  return '🌍';
}


function getDateValue(value) {
  if (value == null) return 0;
  const ms = value?.toDate?.()?.getTime?.() ?? new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function formatDate(value) {
  if (value == null) return 'Unknown date';
  const date = value?.toDate?.() ?? new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString();
}


function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}