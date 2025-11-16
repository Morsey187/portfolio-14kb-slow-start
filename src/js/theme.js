const storageKey = "theme-preference";

class Theme {
  constructor() {
    this.value = Theme.getColorPreference();

    this.reflectPreference();

    const checkbox = document.querySelector("#theme-toggle");
    if (checkbox) {
      checkbox.addEventListener("change", () => this.onChange());
    }

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", ({ matches: isDark }) => {
        this.value = isDark ? "dark" : "light";
        this.setPreference();
      });
  }

  static getColorPreference() {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  static applyPreference(value) {
    document.firstElementChild.setAttribute("data-theme", value);

    const checkbox = document.querySelector("#theme-toggle");
    if (checkbox) {
      checkbox.checked = value === "light";
      checkbox.setAttribute("aria-label", value);
    }
  }

  reflectPreference() {
    Theme.applyPreference(this.value);
  }

  setPreference() {
    localStorage.setItem(storageKey, this.value);
    this.reflectPreference();
  }

  onChange() {
    const checkbox = document.querySelector("#theme-toggle");
    if (!checkbox) return;
    this.value = checkbox.checked ? "light" : "dark";
    this.setPreference();
  }

  static bootstrapEarly() {
    const value = Theme.getColorPreference();
    Theme.applyPreference(value);
  }
}

Theme.bootstrapEarly();

export { Theme };
