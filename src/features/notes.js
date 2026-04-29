import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getCurrentUser } from '../core/state.js';
import { showToast } from '../core/utils.js';
import { db } from '../services/firebase.js';

let notesCache = [];
let listenersBound = false;

function notesRef(userId) {
  return collection(db, 'users', userId, 'notes');
}

function noteDocRef(userId, id) {
  return doc(db, 'users', userId, 'notes', id);
}

export function initNotes() {
  if (listenersBound) return;
  listenersBound = true;

  document.getElementById('add-note-btn')?.addEventListener('click', () => openNoteModal());
  document.getElementById('note-search')?.addEventListener('input', renderNotes);
  document.getElementById('note-sort')?.addEventListener('change', renderNotes);
  document.getElementById('note-modal-save')?.addEventListener('click', saveNote);
  document.getElementById('note-modal-cancel')?.addEventListener('click', closeNoteModal);
  document.getElementById('view-modal-done')?.addEventListener('click', closeViewModal);
  document.getElementById('view-edit-btn')?.addEventListener('click', () => {
    const id = document.getElementById('view-modal')?.dataset.noteId;
    if (id) editNote(id);
  });
  document.getElementById('del-cancel-btn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('del-confirm-btn')?.addEventListener('click', () => {
    const id = document.getElementById('del-modal')?.dataset.noteId;
    if (id) deleteNote(id);
  });
}

export async function renderNotesSection() {
  const user = getCurrentUser();
  if (!user?.uid) {
    renderNotesLogin();
    return;
  }

  await fetchNotes(user.uid);
  renderNotes();
}

export function openNoteModalForCountry(country) {
  openNoteModal(null, country);
}

export function closeNoteModal() {
  document.getElementById('note-modal')?.classList.remove('open');
}

export function closeViewModal() {
  document.getElementById('view-modal')?.classList.remove('open');
}

export function closeDeleteModal() {
  document.getElementById('del-modal')?.classList.remove('open');
}

async function fetchNotes(userId) {
  try {
    const notesQuery = query(notesRef(userId), orderBy('created', 'desc'));
    const snapshot = await getDocs(notesQuery);
    notesCache = snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
  } catch (error) {
    console.error('Fetch notes error:', error);
    showToast('Failed to load notes.', 'error');
  }
}

function renderNotesLogin() {
  document.getElementById('notes-stats').innerHTML = '';
  document.getElementById('notes-grid').innerHTML = `
    <div class="empty-state">
      <h3>Sign in to access notes</h3>
      <p>Your study notes are saved privately to your account.</p>
      <button class="btn btn-primary empty-state-action" id="notes-login-btn">Sign In Now</button>
    </div>
  `;
  document.getElementById('notes-login-btn')?.addEventListener('click', () => {
    document.getElementById('nav-login-btn')?.click();
  });
}

function renderNotes() {
  const searchTerm = document.getElementById('note-search')?.value.toLowerCase() || '';
  const sortValue = document.getElementById('note-sort')?.value || 'newest';

  let visibleNotes = notesCache.filter((note) =>
    note.country?.toLowerCase().includes(searchTerm) ||
    note.content?.toLowerCase().includes(searchTerm)
  );

  visibleNotes = sortNotes(visibleNotes, sortValue);

  const total = notesCache.length;
  const countries = new Set(notesCache.map((note) => note.country)).size;

  document.getElementById('notes-stats').innerHTML = `
    <div class="stat-item"><span class="stat-num">${total}</span><span class="stat-label">Notes</span></div>
    <div class="stat-item"><span class="stat-num">${countries}</span><span class="stat-label">Countries</span></div>
  `;

  if (!visibleNotes.length) {
    document.getElementById('notes-grid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <h3>No notes yet</h3>
        <p>Start exploring countries and save your thoughts.</p>
        <button class="btn btn-gold empty-state-action" id="notes-add-first">Add Your First Note</button>
      </div>
    `;
    document.getElementById('notes-add-first')?.addEventListener('click', () => openNoteModal());
    return;
  }

  // Generate a consistent accent color per country name
  const accentColors = [
    'linear-gradient(90deg,#3b82f6,#6366f1)',
    'linear-gradient(90deg,#14b8a6,#06b6d4)',
    'linear-gradient(90deg,#f59e0b,#f97316)',
    'linear-gradient(90deg,#8b5cf6,#ec4899)',
    'linear-gradient(90deg,#10b981,#14b8a6)',
    'linear-gradient(90deg,#f43f5e,#f97316)',
  ];
  const getAccent = (str) => accentColors[(str || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % accentColors.length];

  document.getElementById('notes-grid').innerHTML = visibleNotes.map((note) => `
    <div class="note-card" data-note-id="${note.id}">
      <div class="note-card-top" style="background:${getAccent(note.country)};height:4px;"></div>
      <div class="note-header">
        <span class="note-country-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/></svg>
          ${escapeHtml(note.country)}
        </span>
        <div class="note-actions">
          <button class="btn-icon" data-action="view" title="View">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn-icon" data-action="edit" title="Edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-action="delete" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <div class="note-body">${escapeHtml(note.content)}</div>
      <div class="note-footer">
        <span class="note-date">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${formatFirestoreDate(note.created)}
        </span>
        <span class="note-read-hint">Click to read →</span>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.note-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.note-actions')) return;
      viewNote(card.dataset.noteId);
    });
  });

  document.querySelectorAll('[data-action="view"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = event.target.closest('.note-card')?.dataset.noteId;
      if (id) viewNote(id);
    });
  });

  document.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = event.target.closest('.note-card')?.dataset.noteId;
      if (id) editNote(id);
    });
  });

  document.querySelectorAll('[data-action="delete"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = event.target.closest('.note-card')?.dataset.noteId;
      if (id) confirmDelete(id);
    });
  });
}

function openNoteModal(note = null, country = '') {
  const modal = document.getElementById('note-modal');
  const countryInput = document.getElementById('note-country');
  const contentTextarea = document.getElementById('note-content');

  if (!modal || !countryInput || !contentTextarea) return;

  if (note) {
    countryInput.value = note.country;
    contentTextarea.value = note.content;
    modal.dataset.noteId = note.id;
  } else {
    countryInput.value = country || document.getElementById('country-input')?.value || '';
    contentTextarea.value = '';
    delete modal.dataset.noteId;
  }

  modal.classList.add('open');
}

async function saveNote() {
  const user = getCurrentUser();
  if (!user?.uid) return;

  const country = document.getElementById('note-country')?.value.trim() || '';
  const content = document.getElementById('note-content')?.value.trim() || '';
  if (!country || !content) {
    showToast('Please fill in all fields.', 'error');
    return;
  }

  const modal = document.getElementById('note-modal');
  const noteId = modal?.dataset.noteId;

  try {
    if (noteId) {
      await updateDoc(noteDocRef(user.uid, noteId), { country, content });
      notesCache = notesCache.map((note) => note.id === noteId ? { ...note, country, content } : note);
      showToast('Note updated.', 'success');
    } else {
      const data = { country, content, created: serverTimestamp() };
      const ref = await addDoc(notesRef(user.uid), data);
      notesCache.unshift({ id: ref.id, ...data, created: new Date() });
      showToast('Note saved.', 'success');
    }

    closeNoteModal();
    renderNotes();
  } catch (error) {
    console.error('Save note error:', error);
    showToast('Failed to save note.', 'error');
  }
}

function viewNote(id) {
  const note = notesCache.find((entry) => entry.id === id);
  if (!note) return;

  const modal = document.getElementById('view-modal');
  if (!modal) return;

  modal.dataset.noteId = id;
  document.getElementById('view-modal-body').innerHTML = `
    <div class="note-detail">
      <p class="note-country" style="font-size:1.2rem; font-weight:700; color:var(--blue2); margin-bottom:0.5rem;">${escapeHtml(note.country)}</p>
      <p class="note-content-full">${escapeHtml(note.content)}</p>
      <p class="note-date">Created: ${formatFirestoreDate(note.created, true)}</p>
    </div>
  `;
  modal.classList.add('open');
}

function editNote(id) {
  const note = notesCache.find((entry) => entry.id === id);
  if (!note) return;

  closeViewModal();
  openNoteModal(note);
}

function confirmDelete(id) {
  const modal = document.getElementById('del-modal');
  if (!modal) return;
  modal.dataset.noteId = id;
  modal.classList.add('open');
}

async function deleteNote(id) {
  const user = getCurrentUser();
  if (!user?.uid) return;

  try {
    await deleteDoc(noteDocRef(user.uid, id));
    notesCache = notesCache.filter((note) => note.id !== id);
    closeDeleteModal();
    renderNotes();
    showToast('Note deleted.', 'info');
  } catch (error) {
    console.error('Delete note error:', error);
    showToast('Failed to delete note.', 'error');
  }
}

function sortNotes(notes, sort) {
  return [...notes].sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return getDateValue(a.created) - getDateValue(b.created);
      case 'country':
        return (a.country || '').localeCompare(b.country || '');
      case 'newest':
      default:
        return getDateValue(b.created) - getDateValue(a.created);
    }
  });
}

function getDateValue(value) {
  return value?.toDate?.()?.getTime?.() || new Date(value).getTime() || 0;
}

function formatFirestoreDate(value, includeTime = false) {
  const date = value?.toDate?.() || (value instanceof Date ? value : new Date(value));
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}
