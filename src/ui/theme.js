/**
 * @file Light/dark theme switch, remembered in this browser.
 */

/** Switches between light and dark; the choice is stored per browser. */
export function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('ikcrm.theme', root.dataset.theme);
  } catch {
    /* storage blocked: the theme still applies for this visit */
  }
}
