const STORAGE_KEY = "tenet-theme";

export function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private browsing */
  }
  return null;
}

export function getTheme() {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  return next;
}

export function initTheme() {
  return applyTheme(getTheme());
}

export function setTheme(theme) {
  const next = applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  return setTheme(current === "light" ? "dark" : "light");
}

export function onThemeChange(cb) {
  const observer = new MutationObserver(() => {
    cb(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
