(function () {
  "use strict";
  var root = document.documentElement;
  var choice = null;
  try { choice = sessionStorage.getItem("time-theme-session"); } catch (e) { /* Storage can be disabled. */ }
  if (choice !== "light" && choice !== "dark") choice = null;
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#101a15" : "#f8f8f3";
    document.querySelectorAll(".theme-toggle").forEach(function (button) {
      var dark = theme === "dark";
      button.setAttribute("aria-pressed", String(dark));
      button.setAttribute("aria-label", "Switch to " + (dark ? "light" : "dark") + " mode");
      button.setAttribute("title", "Switch to " + (dark ? "light" : "dark") + " mode");
      button.querySelector(".theme-label").textContent = dark ? "Light" : "Dark";
    });
  }
  // Start new visits in light mode; keep manual choices while browsing this tab.
  apply(choice || "light");
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".theme-toggle").forEach(function (button) {
      button.hidden = false;
      button.addEventListener("click", function () {
        choice = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        try { sessionStorage.setItem("time-theme-session", choice); } catch (e) { /* Keep the current-page choice. */ }
        apply(choice);
      });
    });
    apply(root.getAttribute("data-theme"));
  });
})();
