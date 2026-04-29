const THEME_KEY = 'theme';
const root = document.documentElement;

applyTheme(getStoredTheme());

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle-btn');
  if (!themeToggle) return;

  updateThemeToggle(themeToggle, root.dataset.theme || 'light');

  themeToggle.addEventListener('click', () => {
    const nextTheme = (root.dataset.theme || 'light') === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    localStorage.setItem(THEME_KEY, nextTheme);
    updateThemeToggle(themeToggle, nextTheme);
  });
});

function getStoredTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  return savedTheme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  document.body?.classList.remove('dark-theme');
}

function updateThemeToggle(toggle, theme) {
  const isLight = theme === 'light';
  const icon = toggle.querySelector('.theme-toggle-icon');
  const label = toggle.querySelector('.theme-toggle-label');

  toggle.setAttribute('aria-pressed', String(isLight));
  toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');

  if (icon) icon.textContent = isLight ? '☀' : '☾';
  if (label) label.textContent = isLight ? 'Light Mode' : 'Dark Mode';
}
