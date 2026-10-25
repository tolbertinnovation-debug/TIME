/* TIME Assistant: a small chat helper for the website. Common questions are answered from
   approved answers in data/assistant.json; anything else is looked up in
   data/assistant-knowledge.json, which holds every section of every public page; what it
   still can't answer goes to a real person on WhatsApp. Loaded by main.js the first time a
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
    " list available all show see type kind other also offered provide run currently now still right our these those here" +
    " was were been being if so than then just more most very by as us").split(" ");
  var COURSE_INTENTS = ["programs", "professional", "diploma", "skills", "lecturers"];
  var COURSE_WORDS = /\b(course|teach|offer|study|class|learn|program|training|diploma|certificate|lecturer)/;

  var data = null, know = null, knowReady = null, panel, log, input, launcher, history = [];

  function fold(s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function stem(w) {
    if (w.length < 4) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + "y";                 // counties → county
    if (/(ss|sh|ch|x)es$/.test(w)) return w.slice(0, -2);            // classes → class
    return /[^s]s$/.test(w) ? w.slice(0, -1) : w;                    // fees → fee
  }
  // Lower-case words with accents and plurals removed, padded so phrases match on word boundaries
  function words(s) { return fold(s).replace(/[^a-z0-9$]+/g, " ").trim().split(" ").filter(Boolean).map(stem); }
  function padded(s) { return " " + words(s).join(" ") + " "; }
  // Words worth looking up: no filler words, and "trained"/"training" both become "train"
  function terms(s) {
    var seen = {};
    return words(s).filter(function (w) { return STOP.indexOf(w) === -1 && w.length > 1; }).map(function (w) {
      return w.length > 5 && /ing$/.test(w) ? w.slice(0, -3) : w.length > 4 && /ed$/.test(w) ? w.slice(0, -2) : w;
    }).filter(function (w) { return seen[w] ? false : (seen[w] = true); });
  }

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
      { label: "Chat live on WhatsApp", href: whatsapp(question), live: true },
      { label: "Send a message", href: "contact.html?topic=General%20enquiry#contact-form" }
    ];
  }

  // --- the website's own text --------------------------------------------------------

  // Index every passage once: its words, how often each appears, and which are in its headings.
  function prepare(k) {
    var df = {}, total = 0;
    k.items = k.passages.map(function (p) {
      var tf = {}, head = {}, list = terms(p.h + " " + p.t);
      // The page title counts once, so "Saywrayne" finds every section of his biography.
      terms(p.t).concat(terms(p.h), terms(p.p)).forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
      terms(p.h + " " + p.p).forEach(function (w) { head[w] = true; });
      list.forEach(function (w) { df[w] = (df[w] || 0) + 1; });
      var len = 0;
      for (var w in tf) len += tf[w];
      total += len;
      return { p: p, tf: tf, head: head, len: len };
    });
    k.df = df;
    k.vocab = Object.keys(df);
    k.avg = total / k.items.length;
    return k;
  }

  // Words in the text that count as the same word: exact, or nearly the same word ("serve", "served").
  function variants(t) {
    var out = [{ w: t, weight: 1 }];
    if (t.length < 4) return out;
    know.vocab.forEach(function (v) {
      var short = Math.min(v.length, t.length), diff = Math.abs(v.length - t.length);
      if (v === t || short < 4 || diff > (short >= 5 ? 3 : 1)) return;
      if (v.indexOf(t) === 0 || t.indexOf(v) === 0) out.push({ w: v, weight: 0.6 });
    });
    return out;
  }

  // Rank passages with BM25, a standard way of scoring text against a question.
  function retrieve(qterms) {
    if (!know || !qterms.length) return [];
    var n = know.items.length, expanded = qterms.map(variants), hits = [];
    know.items.forEach(function (item) {
      var score = 0, covered = {};
      expanded.forEach(function (vars, i) {
        var best = 0;
        vars.forEach(function (v) {
          var f = item.tf[v.w];
          if (!f) return;
          var idf = Math.log(1 + (n - know.df[v.w] + 0.5) / (know.df[v.w] + 0.5));
          var s = v.weight * idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * item.len / know.avg));
          if (item.head[v.w]) s *= 1.6;
          if (s > best) best = s;
        });
        if (best) { score += best; covered[qterms[i]] = true; }
      });
      var count = Object.keys(covered).length;
      var need = qterms.length <= 2 ? qterms.length : Math.ceil(qterms.length * 0.6);
      if (count >= need) hits.push({ item: item, score: score * (count / qterms.length), covered: covered });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits;
  }

  function shorten(text, max) {
    if (text.length <= max) return text;
    var cut = text.slice(0, max), end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
    return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "")) + (end > max * 0.5 ? "" : "…");
  }

  // Up to max characters of a passage, starting at the sentence where the question's words first appear.
  function excerpt(text, focus, max) {
    if (text.length <= max) return text;
    var folded = fold(text), at = -1;
    focus.forEach(function (w) {
      var m = new RegExp("\\b" + w.replace(/[^a-z0-9]/g, "")).exec(folded);
      if (m && (at === -1 || m.index < at)) at = m.index;
    });
    if (at < max * 0.6) return shorten(text, max);
    var start = Math.max(text.lastIndexOf(". ", at) + 2, 0);
    return "\u2026" + shorten(text.slice(start), max);
  }

  function fromSite(hits, question, focus) {
    var top = hits[0].item.p, links = [{ label: "Read more: " + shorten(top.h, 40), href: top.u }];
    var next = hits.slice(1).filter(function (h) { return h.item.p.u !== top.u && h.score >= hits[0].score * 0.6; })[0];
    if (next) links.push({ label: shorten(next.item.p.h, 40), href: next.item.p.u });
    return {
      head: top.h,
      lines: [excerpt(top.t, focus || [], 440)],
      links: links.concat([{ label: "Chat live on WhatsApp", href: whatsapp(question), live: true }]),
      intent: "site"
    };
  }

  // A question naming one course ("do you teach QuickBooks?") gets that course.
  function findCourse(question, qterms) {
    if (!know || !qterms.length) return null;
    var asked = !!COURSE_WORDS.exec(fold(question)), best = null, bestScore = 0;
    know.courses.forEach(function (c) {
      var name = terms(c.n).filter(function (w) { return w.length > 2; });
      var hit = name.filter(function (w) { return qterms.indexOf(w) !== -1; }).length;
      if (!name.length || (qterms.indexOf(name[0]) === -1 && hit < Math.max(2, Math.ceil(name.length / 2)))) return;
      var all = qterms.every(function (t) { return name.indexOf(t) !== -1; });
      if ((asked || all) && hit > bestScore) { best = c; bestScore = hit; }
    });
    return best;
  }

  // --- answering -------------------------------------------------------------------

  // The approved topic that best matches the question, and how strongly (words matched).
  function matchIntent(question) {
    var q = padded(question), best = null, bestScore = 0, matched = [];
    data.intents.forEach(function (intent) {
      var score = 0;
      intent.keywords.forEach(function (k) {
        var key = padded(k);
        if (key.trim() && q.indexOf(key) !== -1) score += key.trim().split(" ").length;
      });
      if (score) matched.push(intent);
      if (score > bestScore) { best = intent; bestScore = score; }
    });
    if (!best) return null;
    var others = [];
    matched.forEach(function (m) { if (m !== best) others = others.concat(terms(m.keywords.join(" "))); });
    return { intent: best, score: bestScore, others: others };
  }

  function fromIntent(intent) {
    var links = (intent.links || []).slice();
    if (intent.handoff) links = handoffLinks("").concat(links);
    return { lines: intent.answer, links: links, intent: intent.id };
  }

  function answer(question) {
    var qterms = terms(question), match = matchIntent(question), intent = match && match.intent;
    if (!intent || COURSE_INTENTS.indexOf(intent.id) !== -1) {
      var course = findCourse(question, qterms);
      if (course) {
        var line = data.course.replace("{course}", course.n).replace("{program}", course.g.replace(/ (Programs|Areas)$/, ""));
        return {
          lines: course.l ? [line, "Lecturer: " + course.l + "."] : [line],
          links: [{ label: "See the course", href: course.u }, { label: "Fees", href: "admissions.html#fees" }],
          intent: "course"
        };
      }
    }
    // Words the matched topic doesn't explain ("when was TIME *founded*?") mean the question may be
    // about something more specific; look for it in the topic's own answer, then on the website.
    var known = intent ? terms(intent.keywords.join(" ")) : [];
    var unknown = qterms.filter(function (w) { return known.indexOf(w) === -1 && w.length > 2; });
    if (intent && !unknown.length) return fromIntent(intent);
    if (intent) {
      // "How much is the diploma?" → just the diploma line of the fees answer
      var lines = intent.answer.filter(function (l, i) {
        var lt = terms(l);
        return i > 0 && unknown.every(function (w) { return lt.indexOf(w) !== -1; });
      });
      if (lines.length && lines.length < intent.answer.length - 1) {
        return { lines: [intent.answer[0]].concat(lines), links: intent.links || [], intent: intent.id };
      }
    }
    // The other words belong to another approved topic ("what is the *fee* for the C certificate?"):
    // the best topic's answer covers it.
    if (intent && unknown.every(function (w) { return match.others.indexOf(w) !== -1; })) return fromIntent(intent);
    // Otherwise use a passage from the website that covers those words. A topic matched on a single
    // word ("books") gives way to any passage covering the rest ("Dr. Saywrayne").
    var hits = retrieve(qterms).filter(function (h) {
      if (!intent) return true;
      return match.score <= 1 ? unknown.some(function (w) { return h.covered[w]; }) : unknown.every(function (w) { return h.covered[w]; });
    });
    if (hits.length) return fromSite(hits, question, unknown.length ? unknown : qterms);
    if (intent && intent.id === "programs") {
      return { lines: [data.notListed], links: [{ label: "All programs", href: "programs.html" }].concat(handoffLinks(question)), intent: "not-listed" };
    }
    if (intent) return fromIntent(intent);
    return { lines: [data.fallback], links: handoffLinks(question), intent: "fallback" };
  }

  // --- rendering -------------------------------------------------------------------

  var SVG = "http://www.w3.org/2000/svg";
  function waIcon() {
    var svg = document.createElementNS(SVG, "svg"), path = document.createElementNS(SVG, "path");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5.1-1 .1-3.2-.7-2.7-1.1-4.4-3.8-4.6-4-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.2 1.4z");
    svg.appendChild(path);
    return svg;
  }

  function render(msg) {
    var box = el("div", "chat-msg " + msg.who);
    if (msg.who === "user") box.appendChild(el("p", "", msg.text));
    else {
      if (msg.head) { var head = el("p", "chat-msg-head"); head.appendChild(el("strong", "", msg.head)); box.appendChild(head); }
      msg.lines.forEach(function (line) { box.appendChild(el("p", "", line)); });
    }
    if (msg.links && msg.links.length) {
      var list = el("ul", "chat-links");
      msg.links.forEach(function (link) {
        if (!/^(https:\/\/|[a-z0-9-]+\.html)/.test(link.href)) return;
        var li = el("li"), a = el("a", link.live ? "chat-live" : "", link.label);
        a.href = link.href;
        if (link.live) a.insertBefore(waIcon(), a.firstChild);
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
    // The website text may still be downloading; answer once it is ready (or has failed).
    return knowReady.then(function () {
      var reply = answer(question);
      add({ who: "bot", head: reply.head, lines: reply.lines, links: reply.links });
    });
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
      // The website text backs up the approved answers; without it the assistant still works.
      knowReady = load("data/assistant-knowledge.json").then(function (d) { know = prepare(d); }, function () {});
      return load("data/assistant.json").then(function (d) {
        data = d;
        build();
        show();
      });
    },
    answer: function (question) { return answer(question); },
    // For tests and tools: use already-loaded data instead of downloading it.
    _use: function (answers, knowledge) { data = answers; know = knowledge ? prepare(knowledge) : null; knowReady = Promise.resolve(); }
  };
})();
