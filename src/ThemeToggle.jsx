import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "./theme.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    setTheme(getTheme());
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(toggleTheme())}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-16h1.5v3H12V2Zm0 17h1.5v3H12v-3ZM4.2 4.2l2.1 2.1-1.1 1.1-2.1-2.1 1.1-1.1Zm13.6 13.6 2.1 2.1-1.1 1.1-2.1-2.1 1.1-1.1ZM2 11h3v1.5H2V11Zm17 0h3v1.5h-3V11ZM6.3 17.7l1.1 1.1-2.1 2.1-1.1-1.1 2.1-2.1Zm11.3-11.3 1.1 1.1-2.1 2.1-1.1-1.1 2.1-2.1Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3.1a7.5 7.5 0 1 0 11.5 11.4Z" />
        </svg>
      )}
    </button>
  );
}
