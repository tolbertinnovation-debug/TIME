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
    var nav = document.getElementById("site-nav");
    var compact = window.matchMedia("(max-width: 1180px)");
    function syncMenu() {
      var open = document.body.classList.contains("nav-open");
      nav.inert = compact.matches && !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    compact.addEventListener("change", function () {
      document.body.classList.remove("nav-open");
      syncMenu();
    });
    syncMenu();
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      syncMenu();
    });
    document.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        syncMenu();
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        syncMenu();
        toggle.focus();
      }
    });
  }

  document.querySelectorAll("[data-topic]").forEach(function (link) {
    link.addEventListener("click", function () {
      var topic = document.getElementById("f-topic");
      if (topic) topic.value = link.getAttribute("data-topic");
      var name = document.getElementById("f-name");
      if (name) name.focus({ preventScroll: true });
    });
  });

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
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
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
      '<figure><picture><source type="image/webp" sizes="100vw"><img alt=""></picture><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(lb);
    var img = lb.querySelector("img"), webp = lb.querySelector("source"), cap = lb.querySelector("figcaption"), idx = 0, lastFocus = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      webp.srcset = it.getAttribute("data-lightbox-webp") || "";
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
      if (e.key === "Tab") {
        var buttons = lb.querySelectorAll("button");
        if (e.shiftKey && document.activeElement === buttons[0]) {
          e.preventDefault(); buttons[buttons.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          e.preventDefault(); buttons[0].focus();
        }
      }
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  // Contact form: deliver through FormSubmit (the site is static, so there is no server of our own).
  // If that fails, offer the visitor a prepared email or WhatsApp message instead.
  var form = document.querySelector("form#contact-form");
  if (form) {
    var to = form.getAttribute("data-to");
    var note = form.querySelector(".form-status");
    var submit = form.querySelector("button[type='submit']");
    var submitLabel = submit.innerHTML;
    var fields = Array.prototype.slice.call(form.querySelectorAll("input[required], textarea[required], input[type=email]"));
    var labels = { "f-name": "your name", "f-email": "your email address", "f-msg": "a message" };

    // Inline validation messages (instead of the browser's pop-ups)
    function problem(f) {
      if (f.validity.valueMissing) return "Please enter " + (labels[f.id] || "this field") + ".";
      if (f.validity.typeMismatch) return "Please enter a valid email address, like name@example.com.";
      if (f.validity.tooLong) return "Please shorten this to " + f.maxLength + " characters.";
      return "";
    }
    function showProblem(f, msg) {
      var id = f.id + "-error";
      var err = document.getElementById(id);
      var described = (f.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x && x !== id; });
      if (msg) {
        if (!err) {
          err = document.createElement("p");
          err.className = "field-error";
          err.id = id;
          f.insertAdjacentElement("afterend", err);
        }
        err.textContent = msg;
        f.setAttribute("aria-invalid", "true");
        described.unshift(id);
      } else {
        if (err) err.remove();
        f.removeAttribute("aria-invalid");
      }
      if (described.length) f.setAttribute("aria-describedby", described.join(" "));
      else f.removeAttribute("aria-describedby");
    }
    function validate() {
      var first = null;
      fields.forEach(function (f) {
        var msg = problem(f);
        showProblem(f, msg);
        if (msg && !first) first = f;
      });
      if (first) first.focus();
      return !first;
    }
    fields.forEach(function (f) {
      f.addEventListener("input", function () { if (f.getAttribute("aria-invalid")) showProblem(f, problem(f)); });
    });

    // Character counter for the message
    var msgBox = document.getElementById("f-msg");
    var msgCount = document.getElementById("f-msg-count");
    if (msgBox && msgCount) {
      msgBox.addEventListener("input", function () {
        var n = msgBox.value.length;
        msgCount.textContent = n ? n.toLocaleString() + " / " + msgBox.maxLength.toLocaleString() + " characters" : "Up to " + msgBox.maxLength.toLocaleString() + " characters";
      });
    }

    // Preselect the topic from links such as contact.html?topic=Volunteering
    var wanted = new URLSearchParams(window.location.search).get("topic");
    var topicSelect = document.getElementById("f-topic");
    if (wanted && topicSelect) {
      Array.prototype.forEach.call(topicSelect.options, function (o) {
        if (o.text.toLowerCase() === wanted.toLowerCase()) topicSelect.value = o.value;
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var d = new FormData(form);
      if (d.get("_honey")) return;
      var subject = "[" + d.get("topic") + "] Message from " + d.get("name");
      var body =
        d.get("message") + "\n\n" +
        "— " + d.get("name") + "\n" +
        (d.get("phone") ? "Phone: " + d.get("phone") + "\n" : "") +
        "Email: " + d.get("email");

      function failed() {
        note.innerHTML = "";
        note.appendChild(document.createTextNode("We couldn't send your message just now. Please "));
        var mail = document.createElement("a");
        mail.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
        mail.textContent = "send it by email";
        note.appendChild(mail);
        note.appendChild(document.createTextNode(" or "));
        var wa = document.createElement("a");
        wa.href = "https://wa.me/231888901848?text=" + encodeURIComponent(subject + "\n\n" + body);
        wa.target = "_blank";
        wa.rel = "noopener";
        wa.textContent = "on WhatsApp";
        note.appendChild(wa);
        note.appendChild(document.createTextNode("."));
      }

      submit.disabled = true;
      submit.textContent = "Sending…";
      note.textContent = "";
      fetch("https://formsubmit.co/ajax/" + to, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name: d.get("name"),
          email: d.get("email"),
          phone: d.get("phone"),
          topic: d.get("topic"),
          message: d.get("message"),
          _subject: subject,
          _replyto: d.get("email"),
          _template: "table"
        })
      })
        .then(function (r) { return r.json().then(function (j) { return r.ok && String(j.success) === "true"; }); })
        .then(function (ok) {
          if (!ok) return failed();
          form.reset();
          if (msgCount) msgCount.textContent = "Up to " + msgBox.maxLength.toLocaleString() + " characters";
          note.textContent = "Thank you, your message has been sent. We'll reply as soon as we can.";
        })
        .catch(failed)
        .then(function () {
          submit.disabled = false;
          submit.innerHTML = submitLabel;
        });
    });
  }

  // Offline support: keep visited pages available on slow or patchy connections
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
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
      if (header) header.classList.toggle("hide", phone.matches && !document.body.classList.contains("nav-open") && !header.contains(document.activeElement) && y > lastY && y > 240);
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
    // Make the row keyboard-scrollable only while it actually scrolls (phones)
    function focusable() {
      if (row.scrollWidth > row.clientWidth + 1) row.setAttribute("tabindex", "0");
      else row.removeAttribute("tabindex");
    }
    row.setAttribute("aria-label", "Swipe for more");
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", focusable);
    update();
    focusable();
  });

  // FAQ search: filter questions and answers as you type
  var faqQ = document.getElementById("faq-q");
  if (faqQ) {
    var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-group details"));
    var faqCount = document.getElementById("faq-count");
    var faqEmpty = document.querySelector(".faq-empty");
    faqQ.addEventListener("input", function () {
      var words = faqQ.value.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      faqItems.forEach(function (d) {
        var text = d.textContent.toLowerCase();
        var match = words.every(function (w) { return text.indexOf(w) !== -1; });
        d.hidden = !match;
        if (match) shown++;
        // Open the answers when the search narrows things down to a few
        d.open = words.length > 0 && match && shown <= 3 ? true : (words.length ? false : d.open);
      });
      document.querySelectorAll(".faq-group").forEach(function (g) {
        g.hidden = !g.querySelector("details:not([hidden])");
      });
      faqEmpty.hidden = !words.length || shown > 0;
      faqCount.textContent = words.length ? shown + (shown === 1 ? " question matches" : " questions match") : "";
    });
  }

  // Print every FAQ answer, then put the page back as it was
  var printOpened = [];
  window.addEventListener("beforeprint", function () {
    printOpened = Array.prototype.filter.call(document.querySelectorAll(".faq details:not([open])"), function (d) { d.open = true; return true; });
  });
  window.addEventListener("afterprint", function () {
    printOpened.forEach(function (d) { d.open = false; });
    printOpened = [];
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
    q.addEventListener("input", function () {
      var term = q.value.trim();
      var total = 0;
      tabs.classList.toggle("searching", !!term);
      tabs.querySelectorAll(".program-panel").forEach(function (panel) {
        var hits = 0;
        panel.querySelectorAll(".course-list li").forEach(function (li) {
          var match = !term || li.textContent.toLowerCase().includes(term.toLowerCase());
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
