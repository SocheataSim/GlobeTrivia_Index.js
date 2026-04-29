const ROUTES = ['home', 'quiz', 'notes', 'leaderboard', 'history'];

let routeChangeHandler = null;

export function initRouter(onRouteChange) {
  routeChangeHandler = onRouteChange;
  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange();
}

export function navigateTo(route) {
  const normalizedRoute = normalizeRoute(route);
  const targetHash = `#${normalizedRoute}`;
  if (window.location.hash === targetHash) {
    renderRoute(normalizedRoute);
    routeChangeHandler?.(normalizedRoute);
    return;
  }
  window.location.hash = targetHash;
}

export function getCurrentRoute() {
  return normalizeRoute(window.location.hash.replace(/^#/, ''));
}

function handleRouteChange() {
  const route = getCurrentRoute();
  renderRoute(route);
  routeChangeHandler?.(route);
}

function renderRoute(route) {
  document.querySelectorAll('.section').forEach((section) => {
    section.classList.toggle('active', section.id === `section-${route}`);
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const linkRoute = normalizeRoute(href.replace(/^#/, ''));
    link.classList.toggle('active', linkRoute === route);
  });
}

function normalizeRoute(route) {
  const cleanRoute = (route || 'home').trim().toLowerCase();
  return ROUTES.includes(cleanRoute) ? cleanRoute : 'home';
}
