(function () {
  "use strict";
  document.documentElement.classList.remove("no-js");

  // Sticky header shadow
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile navigation
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // Reveal on scroll + animated counters
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function countUp(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    if (reduce) { el.textContent = target.toLocaleString(); return; }
    var start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        entry.target.querySelectorAll("[data-count]").forEach(countUp);
        if (entry.target.hasAttribute("data-count")) countUp(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal, .stats-grid").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    document.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = el.getAttribute("data-count"); });
  }

  // Program tabs
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var tabs = group.querySelectorAll("[role='tab']");
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.classList.toggle("active", on);
      });
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (next) { e.preventDefault(); select(next); next.focus(); }
      });
    });
  });

  // Gallery lightbox
  var items = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
  if (items.length) {
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Photo viewer");
    lb.innerHTML =
      '<button class="lb-btn lb-close" aria-label="Close">&times;</button>' +
      '<button class="lb-btn lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(lb);
    var img = lb.querySelector("img"), cap = lb.querySelector("figcaption"), idx = 0, lastFocus = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      img.src = it.getAttribute("data-lightbox");
      img.alt = it.getAttribute("data-alt") || "";
      cap.textContent = it.getAttribute("data-caption") || "";
    }
    function open(i) {
      lastFocus = document.activeElement;
      show(i);
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
      lb.querySelector(".lb-close").focus();
    }
    function close() {
      lb.classList.remove("open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    items.forEach(function (it, i) { it.addEventListener("click", function () { open(i); }); });
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(idx - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(idx + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  // Contact form: compose an email (the site is static, so there is no server to post to)
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var d = new FormData(form);
      var subject = "[" + d.get("topic") + "] Message from " + d.get("name");
      var body =
        d.get("message") + "\n\n" +
        "— " + d.get("name") + "\n" +
        (d.get("phone") ? "Phone: " + d.get("phone") + "\n" : "") +
        "Email: " + d.get("email");
      window.location.href = "mailto:" + form.getAttribute("data-to") +
        "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      var note = form.querySelector(".form-status");
      if (note) note.textContent = "Your email app should now open with your message ready to send. If it doesn't, write to us directly at " + form.getAttribute("data-to") + ".";
    });
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

(function () {
  "use strict";

  // Hide the header while scrolling down on phones; bring it back on scroll up
  var header = document.querySelector(".site-header");
  var lastY = window.scrollY, ticking = false;
  var phone = window.matchMedia("(max-width: 760px)");
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (header) header.classList.toggle("hide", phone.matches && y > lastY && y > 240);
      lastY = y;
      ticking = false;
    });
  }, { passive: true });

  // Position dots under swipeable card rows
  document.querySelectorAll(".grid.swipe").forEach(function (row) {
    var cards = row.children;
    var dots = document.createElement("div");
    dots.className = "swipe-dots";
    dots.setAttribute("aria-hidden", "true");
    for (var i = 0; i < cards.length; i++) dots.appendChild(document.createElement("span"));
    row.parentNode.insertBefore(dots, row.nextSibling);
    function update() {
      var w = cards[0] ? cards[0].getBoundingClientRect().width + 14 : 1;
      var idx = Math.round(row.scrollLeft / w);
      for (var j = 0; j < dots.children.length; j++) dots.children[j].classList.toggle("on", j === idx);
    }
    row.addEventListener("scroll", update, { passive: true });
    update();
  });

  // Live search across every course on the Programs page
  var q = document.getElementById("course-q");
  var tabs = document.getElementById("course-tabs");
  if (q && tabs) {
    var count = document.querySelector(".course-count");
    var empty = document.createElement("p");
    empty.className = "course-empty";
    empty.textContent = "No course matches that search. Try another word, or contact us and ask.";
    tabs.appendChild(empty);
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    q.addEventListener("input", function () {
      var term = q.value.trim();
      var re = term ? new RegExp(esc(term), "i") : null;
      var total = 0;
      tabs.classList.toggle("searching", !!term);
      tabs.querySelectorAll(".program-panel").forEach(function (panel) {
        var hits = 0;
        panel.querySelectorAll(".course-list li").forEach(function (li) {
          var match = !re || re.test(li.textContent);
          li.classList.toggle("hidden", !match);
          if (match) hits++;
        });
        panel.classList.toggle("no-match", !!term && hits === 0);
        total += hits;
      });
      tabs.classList.toggle("nothing", !!term && total === 0);
      if (count) count.textContent = term ? total + (total === 1 ? " course" : " courses") : "";
    });
  }
})();
