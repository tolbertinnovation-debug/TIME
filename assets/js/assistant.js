/* TIME Assistant: a small chat helper that answers common questions from the approved
   information in data/assistant.json, falls back to the site search index, and hands
   anything else to a real person on WhatsApp. Loaded by main.js the first time a
   visitor opens the chat. Messages never leave the browser unless the visitor taps a
   WhatsApp or contact link. */
(function () {
  "use strict";

  var WHATSAPP = "https://wa.me/231888901848";
  var STORE = "time-assistant";
  var MAX_SAVED = 40;
  var STOP = ("a an the and or of to for in on at is are am be do does did can could i me my we you your it its " +
    "this that what which who how when where why there please tell about want would like need know with from " +
    "will have has get give any some much many time inc course program programme class offer teach study learn" +
    " list available all show see type kind other also offered provide run currently now still right our these those here").split(" ");

  var data = null, index = null, panel, log, input, launcher, history = [];

  function fold(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function stem(w) { return w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w; }
  // Lower-case words with accents and plurals removed, padded so phrases match on word boundaries
  function words(s) { return fold(s).replace(/[^a-z0-9$]+/g, " ").trim().split(" ").filter(Boolean).map(stem); }
  function padded(s) { return " " + words(s).join(" ") + " "; }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function whatsapp(question) {
    var text = question ? "Hello TIME Inc., I have a question: " + question : "Hello TIME Inc., I have a question.";
    return WHATSAPP + "?text=" + encodeURIComponent(text);
  }
  function handoffLinks(question) {
    return [
      { label: "Ask on WhatsApp", href: whatsapp(question) },
      { label: "Send a message", href: "contact.html?topic=General%20enquiry#contact-form" }
    ];
  }

  // --- answering -------------------------------------------------------------------

  function matchIntent(question) {
    var q = padded(question), best = null, bestScore = 0;
    data.intents.forEach(function (intent) {
      var score = 0;
      intent.keywords.forEach(function (k) {
        var key = padded(k);
        if (key.trim() && q.indexOf(key) !== -1) score += key.trim().split(" ").length;
      });
      if (score > bestScore) { best = intent; bestScore = score; }
    });
    return best;
  }

  function searchSite(question) {
    var terms = words(question).filter(function (w) { return STOP.indexOf(w) === -1 && w.length > 1; });
    if (!terms.length || !index) return [];
    var hits = [];
    index.entries.forEach(function (e) {
      var title = padded(e.title), head = padded(e.headings.join(" ")), desc = padded(e.description), body = padded(e.text);
      var score = 0, found = 0;
      terms.forEach(function (t) {
        var w = " " + t + " ", s = 0;
        if (title.indexOf(w) !== -1) s += 8;
        if (head.indexOf(w) !== -1) s += 3;
        if (desc.indexOf(w) !== -1) s += 3;
        if (body.indexOf(w) !== -1) s += 1;
        if (s) found++;
        score += s;
      });
      if (score >= 6 && found >= Math.min(2, terms.length)) hits.push({ e: e, score: score + (e.type === "faq" ? 2 : 0) });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 3).map(function (h) { return h.e; });
  }

  var COURSE_INTENTS = ["programs", "professional", "diploma", "skills"];

  function answer(question) {
    var intent = matchIntent(question);
    // A question naming one course ("do you teach QuickBooks?") gets that course, not the general list
    if (!intent || COURSE_INTENTS.indexOf(intent.id) !== -1) {
      var course = searchSite(question).filter(function (e) { return e.type === "course"; })[0];
      if (course && words(question).join(" ").indexOf(words(course.title).filter(function (w) { return STOP.indexOf(w) === -1; })[0]) !== -1) {
        return {
          lines: [data.course.replace("{course}", course.title).replace("{program}", (course.headings[0] || "").replace(/ (Programs|Areas)$/, ""))],
          links: [{ label: "See the course", href: course.url }, { label: "Fees", href: "admissions.html#fees" }],
          intent: "course"
        };
      }
    }
    // "Do you offer nursing?" names something that isn't on our course list: say so rather than list everything
    if (intent && intent.id === "programs") {
      var known = words(intent.keywords.join(" "));
      var unknown = words(question).filter(function (w) { return STOP.indexOf(w) === -1 && known.indexOf(w) === -1 && w.length > 2; });
      if (unknown.length) {
        return { lines: [data.notListed], links: [{ label: "All programs", href: "programs.html" }].concat(handoffLinks(question)), intent: "not-listed" };
      }
    }
    if (intent) {
      var links = (intent.links || []).slice();
      if (intent.handoff) links = handoffLinks("").concat(links);
      return { lines: intent.answer, links: links, intent: intent.id };
    }
    var hits = searchSite(question);
    if (hits.length && hits[0].type === "faq") {
      return {
        lines: [hits[0].description],
        links: [{ label: "Read on the FAQ page", href: hits[0].url }].concat(handoffLinks(question)),
        intent: "search"
      };
    }
    if (hits.length) {
      return {
        lines: [data.related],
        links: hits.map(function (h) { return { label: h.title, href: h.url }; }).concat(handoffLinks(question)),
        intent: "search"
      };
    }
    return { lines: [data.fallback], links: handoffLinks(question), intent: "fallback" };
  }

  // --- rendering -------------------------------------------------------------------

  function render(msg) {
    var box = el("div", "chat-msg " + msg.who);
    if (msg.who === "user") box.appendChild(el("p", "", msg.text));
    else msg.lines.forEach(function (line) { box.appendChild(el("p", "", line)); });
    if (msg.links && msg.links.length) {
      var list = el("ul", "chat-links");
      msg.links.forEach(function (link) {
        if (!/^(https:\/\/|[a-z0-9-]+\.html)/.test(link.href)) return;
        var li = el("li"), a = el("a", "", link.label);
        a.href = link.href;
        if (/^https:/.test(link.href)) { a.target = "_blank"; a.rel = "noopener"; }
        li.appendChild(a);
        list.appendChild(li);
      });
      box.appendChild(list);
    }
    log.appendChild(box);
    log.scrollTop = log.scrollHeight;
  }

  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-MAX_SAVED))); } catch (e) { /* storage off */ }
  }
  function add(msg) { history.push(msg); render(msg); save(); }

  function ask(question) {
    question = question.trim().slice(0, 300);
    if (!question) return;
    add({ who: "user", text: question });
    var reply = answer(question);
    add({ who: "bot", lines: reply.lines, links: reply.links });
  }

  function build() {
    panel = el("div", "chat");
    panel.id = "time-assistant";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "chat-title");
    panel.hidden = true;

    var head = el("div", "chat-head");
    var logo = el("img");
    logo.src = "assets/img/time-logo-128.png"; logo.alt = ""; logo.width = 36; logo.height = 36;
    var titles = el("div");
    var title = el("h2", "", "TIME Assistant"); title.id = "chat-title";
    titles.appendChild(title);
    titles.appendChild(el("p", "", "Answers from our official information"));
    var close = el("button", "chat-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close chat");
    close.textContent = "×";
    close.addEventListener("click", hide);
    head.appendChild(logo); head.appendChild(titles); head.appendChild(close);

    log = el("div", "chat-log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    log.tabIndex = 0;
    log.setAttribute("aria-label", "Conversation");

    var quick = el("div", "chat-quick");
    quick.setAttribute("role", "group");
    quick.setAttribute("aria-label", "Suggested questions");
    data.quick.forEach(function (q) {
      var b = el("button", "", q.label);
      b.type = "button";
      b.addEventListener("click", function () { ask(q.ask); });
      quick.appendChild(b);
    });

    var form = el("form", "chat-form");
    var label = el("label", "sr-only", "Type your question");
    label.htmlFor = "chat-q";
    input = el("input");
    input.id = "chat-q"; input.type = "text"; input.maxLength = 300; input.autocomplete = "off";
    input.placeholder = "Type your question…";
    var send = el("button", "chat-send", "Send");
    send.type = "submit";
    form.appendChild(label); form.appendChild(input); form.appendChild(send);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      ask(input.value);
      input.value = "";
      input.focus();
    });

    var note = el("p", "chat-note", "Your messages stay in this browser unless you send them to us on WhatsApp. ");
    var privacy = el("a", "", "Privacy");
    privacy.href = "privacy.html";
    note.appendChild(privacy);

    panel.appendChild(head); panel.appendChild(log); panel.appendChild(quick); panel.appendChild(form); panel.appendChild(note);
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    document.body.appendChild(panel);

    try { history = JSON.parse(sessionStorage.getItem(STORE) || "[]") || []; } catch (e) { history = []; }
    if (!Array.isArray(history)) history = [];
    if (history.length) history.forEach(render);
    else add({ who: "bot", lines: data.greeting });
  }

  function show() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("chat-open");
    log.scrollTop = log.scrollHeight;
    input.focus();
  }
  function hide() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("chat-open");
    launcher.focus();
  }

  function load(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  window.TIMEAssistant = {
    // Opens the chat; resolves once it is on screen.
    open: function (button) {
      launcher = button;
      launcher.setAttribute("aria-controls", "time-assistant");
      if (panel) { if (panel.hidden) show(); else hide(); return Promise.resolve(); }
      // The search index only backs up questions the assistant has no answer for, so it can fail quietly.
      load("assets/search-index.json").then(function (d) { index = d; }, function () {});
      return load("data/assistant.json").then(function (d) {
        data = d;
        build();
        show();
      });
    },
    answer: function (question) { return answer(question); }
  };
})();
