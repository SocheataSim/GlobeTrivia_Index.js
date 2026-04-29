import { initRouter, navigateTo, getCurrentRoute } from './router.js';
import { initAuth, openAuthModal, closeAuthModal, switchAuthTab, login, register, logout } from '../features/auth.js';
import { initExplore, renderExploreLogin, renderExploreSection } from '../features/explore.js';
import { initQuiz } from '../features/quiz.js';
import { initNotes, renderNotesSection, closeNoteModal, closeViewModal, closeDeleteModal } from '../features/notes.js';
import { initLeaderboard } from '../features/leaderboard.js';
import { renderHistorySection } from '../features/history.js';

import { getCurrentUser } from '../core/state.js';

bindStaticEventListeners();
initExplore();
initQuiz();
initNotes();

initAuth(
  async (user) => {
    await initLeaderboard(user?.uid || null);
    await initQuiz();
    handleRouteChange(getCurrentRoute());
  },
  async () => {
    await initLeaderboard(null);
    await initQuiz();
    handleRouteChange(getCurrentRoute());
  }
);

initRouter(handleRouteChange);

function bindStaticEventListeners() {
  document.getElementById('nav-logo-btn')?.addEventListener('click', () => navigateTo('home'));
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const href = link.getAttribute('href') || '#home';
      navigateTo(href.replace(/^#/, ''));
    });
  });

  document.getElementById('hero-start-btn')
  ?.addEventListener('click', () => {
    localStorage.setItem('exploreMode', 'true'); 
    showExplore();
  });
  document.getElementById('explore-back-btn')?.addEventListener('click', () => showHomeHero());

  document.getElementById('nav-login-btn')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('nav-register-btn')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('nav-logout-btn')?.addEventListener('click', logout);
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  document.getElementById('auth-tab-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('auth-tab-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('switch-to-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('switch-to-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('login-btn')?.addEventListener('click', login);
  document.getElementById('reg-btn')?.addEventListener('click', register);

  document.getElementById('note-modal-close')?.addEventListener('click', closeNoteModal);
  document.getElementById('view-modal-close')?.addEventListener('click', closeViewModal);
  document.getElementById('del-modal-close')?.addEventListener('click', closeDeleteModal);

  bindOverlayClose('auth-modal', closeAuthModal);
  bindOverlayClose('note-modal', closeNoteModal);
  bindOverlayClose('view-modal', closeViewModal);
  bindOverlayClose('del-modal', closeDeleteModal);

  syncNavPanelState();
  document.getElementById('nav-toggle-btn')?.addEventListener('click', () => {
    if (!isMobileNav()) return;
    const panel = document.getElementById('nav-panel');
    const isOpen = panel?.getAttribute('aria-hidden') === 'false';
    setNavPanelState(!isOpen);
  });
  window.addEventListener('resize', syncNavPanelState);
}


function handleRouteChange(route) {
  const isExploreMode = localStorage.getItem('exploreMode') === 'true';

  if (route === 'home') {
    if (isExploreMode) {
      showExplore();   
    } else {
      showHomeHero();
    }
  }

  switch (route) {
    case 'home':
      renderExploreSection();
      break;
    case 'quiz':
      initQuiz();
      break;
    case 'notes':
      renderNotesSection();
      break;
    case 'history':
      renderHistorySection();
      break;
    default:
      break;
  }

  if (isMobileNav()) {
    setNavPanelState(false);
  }
}

function bindOverlayClose(id, onClose) {
  document.getElementById(id)?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  });
}

function isMobileNav() {
  return window.matchMedia('(max-width: 980px)').matches;
}

function setNavPanelState(isOpen) {
  const panel = document.getElementById('nav-panel');
  const toggle = document.getElementById('nav-toggle-btn');
  const nav = document.querySelector('nav');
  if (!panel || !toggle || !nav) return;

  panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  if (isOpen) panel.removeAttribute('inert');
  else panel.setAttribute('inert', '');

  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  nav.classList.toggle('nav-open', isOpen);
  document.body.classList.toggle('nav-locked', isOpen);
}

function syncNavPanelState() {
  if (isMobileNav()) {
    setNavPanelState(false);
    return;
  }

  const panel = document.getElementById('nav-panel');
  const toggle = document.getElementById('nav-toggle-btn');
  const nav = document.querySelector('nav');
  if (!panel || !toggle || !nav) return;

  panel.setAttribute('aria-hidden', 'false');
  panel.removeAttribute('inert');
  toggle.setAttribute('aria-expanded', 'false');
  nav.classList.remove('nav-open');
  document.body.classList.remove('nav-locked');
}

function showExplore() {
  const welcomeHero = document.querySelector('.welcome-hero');
  const exploreHero = document.querySelector('.explore-hero');
  const resultWrapper = document.querySelector('.result-wrapper');

  if (welcomeHero) welcomeHero.style.display = 'none';
  if (exploreHero) exploreHero.style.display = 'block';
  if (resultWrapper) resultWrapper.style.display = 'block';

  // If not logged in, show the prompt immediately
  if (!getCurrentUser()) {
    renderExploreLogin();
  } else {
    setTimeout(() => {
      document.getElementById('country-input')?.focus();
    }, 100);
  }
}

function showHomeHero() {
  const welcomeHero = document.querySelector('.welcome-hero');
  const exploreHero = document.querySelector('.explore-hero');
  const resultWrapper = document.querySelector('.result-wrapper');
  const homeLayout = document.querySelector('.home-hero-layout');
  const homeCopy = document.querySelector('.home-hero-copy');
  const heroH1 = document.querySelector('.hero-h1');
  const heroSub = document.querySelector('.hero-sub');
  const heroFeatures = document.querySelector('.hero-features');
  const btnHero = document.querySelector('.btn-hero');
  const homeArt = document.querySelector('.home-hero-art');

  if (welcomeHero) welcomeHero.style.display = '';
  if (exploreHero) exploreHero.style.display = 'none';
  if (resultWrapper) resultWrapper.style.display = 'none';

  const exploreLoading = document.getElementById('explore-loading');
  const exploreResult = document.getElementById('explore-result');
  const exploreError = document.getElementById('explore-error');
  if (exploreLoading) exploreLoading.style.display = 'none';
  if (exploreResult) exploreResult.style.display = 'none';
  if (exploreError) exploreError.style.display = 'none';

  if (homeLayout) {
    homeLayout.style.flexDirection = 'row';
    homeLayout.style.alignItems = 'center';
    homeLayout.style.justifyContent = 'space-between';
    homeLayout.style.textAlign = 'left';
  }
  if (homeCopy) {
    homeCopy.style.alignItems = 'flex-start';
    homeCopy.style.textAlign = 'left';
    homeCopy.style.maxWidth = '560px';
    homeCopy.style.margin = '0';
  }
  if (heroH1) {
    heroH1.style.textAlign = 'left';
    heroH1.style.marginInline = '0';
  }
  if (heroSub) {
    heroSub.style.textAlign = 'left';
    heroSub.style.marginLeft = '0';
    heroSub.style.marginRight = '0';
  }
  if (heroFeatures) {
    heroFeatures.style.marginLeft = '0';
    heroFeatures.style.marginRight = '0';
  }
  if (btnHero) {
    btnHero.style.alignSelf = 'flex-start';
  }
  if (homeArt) {
    homeArt.style.display = 'flex';
  }
}
