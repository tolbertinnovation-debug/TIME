# TIME Inc. Website — Platform Review & Recommendations

Reviewed: 29 Oct 2026 · Scope: all 8 pages, `assets/css`, `assets/js/main.js`, images, SEO files.

**Overall:** The foundation is strong. It's mobile-first, needs no build step, and has good accessibility basics: skip link, keyboard tabs, a focus-trapped lightbox, `prefers-reduced-motion` and `inert` on the mobile nav. The writing tells the story well. The main gaps are in what an **education** site has to do. A prospective student can't find fees, entry requirements, start dates or what each course teaches, and can't apply online. Donors can't actually give. The site is also heavier than it needs to be for Liberian mobile data.

Every item below ends with a **prompt you can paste into Claude Code**. They're grouped by priority, so do them in order.

---

## P0 — Fix first (bugs and contradictions)

### 1. The 404 page breaks on GitHub Pages subpaths
`404.html` loads CSS, JS, the logo and all nav links with relative paths (`assets/css/style.css`). GitHub Pages serves this file for *any* missing URL, such as `/TIME/programs/` or `/TIME/a/b`. At those URLs the page shows up unstyled and its links are broken.

> **Prompt:** In `404.html`, make every asset and nav URL root-relative to the site base (`/TIME/...`), or add `<base href="/TIME/">` in the head. Then check that `/TIME/does/not/exist` renders styled with working links.

### 2. The schedule contradicts the course length
`programs.html` says courses are "10 weeks", but both schedule cards say "Duration: 3 / 6 / 8 months". The Saturday track is "8:00 AM – 3:00 PM" (7 hours) but "Per session: 3 hours". The pill "10 weeks · 2 months, 2 weeks" repeats the same length twice.
**Action:** confirm the real figures with admissions, then:

> **Prompt:** On `programs.html`, make the course durations and schedule consistent: [paste the confirmed values]. Change the "10 weeks · 2 months, 2 weeks" pills to just "10 weeks". Update the matching text on `index.html` and `founder.html`.

### 3. Names and titles are inconsistent
The co-founder appears as "Ms. Tibeh E. Gbassagee" (about, phica), "Mrs. Tibeh E. Gbassagee-Saywrayne" (index, about, phica), "his wife" (index) and "his partner" (about). **Action:** choose the preferred form.

> **Prompt:** Across all HTML pages, standardise the co-founder's name to "[preferred form]" and her relationship wording to "[wife/partner]". Keep the first mention on each page in full and shorten later ones.

### 4. A CTA doesn't match its heading
On `founder.html`, the final CTA heading is "Learn with Dr. Saywrayne and the TIME faculty. Enroll in…", but its buttons say "Support TIME Inc." and "WhatsApp".

> **Prompt:** In the `founder.html` closing CTA, make the primary button "Register for a course" → `programs.html#register` and the secondary one "Browse courses" → `programs.html#courses`.

### 5. Unclear PHICA fee information
The fees cover only "Nursery – Grade 6 (US$60 or less)", but PHICA also offers Junior High, and the fee doesn't say per term or per year. **Action:** confirm the fees, then add the Junior High fee and the billing period.

---

## P1 — Enrollment experience (the biggest gap for an education site)

Today a prospective student only sees a list of course *titles*. Before contacting anyone, they need to know: *What will I learn? Am I eligible? What does it cost? When does it start? What certificate do I get?*

### 6. Give every course its own detail view, driven by one data file
Move all courses into `assets/data/courses.json` with these fields: `id, title, category, summary, who_for, outcomes[], entry_requirements, duration, schedule_options, fee_lrd, fee_usd, installments, certificate_awarded, next_intake`. Build the tabs, the search and the detail views from that file. Then adding a course means editing one file instead of HTML in several places.

> **Prompt:** Refactor the course catalogue on `programs.html` to render from `assets/data/courses.json`. Each course in the list should open a detail panel (or its own section with an anchor such as `programs.html#course-quickbooks`). The panel shows the overview, who it's for, learning outcomes, entry requirements, duration, schedule, fees with the installment plan, the certificate awarded and the next intake date, plus "Apply" and "Ask on WhatsApp" buttons (pre-fill the WhatsApp text with the course name). Keep the existing tabs, keyboard behaviour and live search working. Include a `<noscript>` fallback that lists the course titles. Add schema.org `Course` JSON-LD for each course. Use placeholder text marked `TODO` where we don't have the content yet.

### 7. Add an online application form
Right now registration means visiting the campus in person or sending a WhatsApp message. Applicants in Bong or Grand Bassa need a way to apply remotely.

> **Prompt:** Add an "Apply online" section to `programs.html#register`. The form should collect full name, phone/WhatsApp, email (optional), county, current role (teacher, student, professional), highest qualification, chosen course (a dropdown filled from `courses.json`), preferred track (weekday or Saturday) and how they heard about us. Submit it to [Formspree / Google Forms / Tally endpoint]. Show inline validation and a clear success message that says what happens next and who will call them. Keep the WhatsApp option as an alternative.

### 8. Fees, intake calendar and FAQ
> **Prompt:** Create `admissions.html` and link it in the main nav, the footer and the mobile action bar's "Register" button. Sections: (1) How to apply, as 4 numbered steps; (2) the fee table for each program, with the 2-installment plan and accepted payment methods; (3) intake calendar with the next start dates; (4) entry requirements; (5) FAQ as `<details>` accordions covering accreditation, certificate recognition, attendance, missed classes, payment, transport and documents to bring. Add `FAQPage` JSON-LD and add the page to `sitemap.xml`. Use `TODO` placeholders for any figures I haven't supplied.

### 9. Graduate outcomes and testimonials
Education sites earn trust through student voices. The Class of 2026 photos are there, but no graduates speak.

> **Prompt:** Add a "Hear from our graduates" section to `index.html` and `programs.html`: 3 testimonial cards, each with a photo, name, course, county and a 1–2 sentence quote. Store them in `assets/data/testimonials.json`. Use clearly marked placeholder entries for now.

### 10. Certificate verification page
This builds trust, and it fits the founder's own research on credential fraud. Employers and the MoE can confirm that a TIME certificate is genuine.

> **Prompt:** Create `verify.html`, where a visitor enters a certificate number and sees the graduate's name, program, completion year and status. Load the data from `assets/data/certificates.json`, storing only certificate number, name, program and year (no other personal data). Show a clear "not found — contact us" state. Link the page from the footer and from `programs.html`.

### 11. Downloadable prospectus and accreditation proof
> **Prompt:** Add a "Download prospectus (PDF)" button to `programs.html` and `admissions.html`, pointing at `assets/docs/time-prospectus-2027.pdf`, with the file size shown. Add an "Our accreditation" block with a thumbnail of the Bureau of Teacher Education accreditation letter that opens in the existing lightbox.

---

## P2 — Performance for Liberian mobile networks

Most visitors will be on prepaid 3G/4G, where every MB costs money.

### 12. Images (≈5 MB total; some heavy files load where small ones would do)
- `tibeh-gbassagee-principal.png` is **417 KB at 1536 px**, yet `about.html` shows it as a small avatar. It needs a JPG/WebP version (~480 px, <60 KB) and a `thumb-` copy, like the other photos.
- Full-size 1600 px photos are used as CTA and page-hero backgrounds (≈200–375 KB each).
- Most `<img>` tags have no `width`/`height`, so the layout shifts as images load.

> **Prompt:** Add an image script at `scripts/optimize-images.sh` (it can use `cwebp`/`sharp`). For every photo it should produce WebP at 480/960/1600 px plus a JPG fallback. Then update every `<img>` to use `<picture>` with `srcset`/`sizes` and add explicit `width`/`height`. Convert the principal's PNG to JPG/WebP and use a thumbnail for the `about.html` avatar. Keep `fetchpriority="high"` on only the one hero image per page. Target: home page under 800 KB on a 375 px-wide phone.

### 13. Fonts
The site loads three Google Font families with 9 weights in total, which blocks rendering.

> **Prompt:** Reduce fonts to 2 families with no more than 4 weights in total. Self-host them as `woff2` in `assets/fonts/` using `font-display: swap`, preload the main body font, and remove the Google Fonts links on every page.

### 14. Caching and offline
- `style.css` has no version string but `pages.css` does (`?v=20261019c`), so returning visitors may get stale styles.
- Connections in Liberia are intermittent.

> **Prompt:** Add the same `?v=` cache-busting string to `style.css` and `main.js` on every page. Add a small service worker (`sw.js`) that precaches the HTML pages, CSS, JS and logo, and caches images as they are viewed. Previously visited pages and the contact details should then work offline. Register it from `main.js`.

---

## P3 — Donations, trust and contact

### 15. Give donors a real way to donate
"Make a donation" only opens WhatsApp, so overseas donors will drop off.

> **Prompt:** Rebuild `contact.html#support` → "Donate" as a section with: (a) suggested amounts tied to impact (e.g. "US$10 = copybooks and pencils for 5 children", "US$60 = one PHICA pupil's school year", "US$[x] = sponsor one teacher's certificate"), with TODO placeholders; (b) payment options as tabs: Orange Money / MTN MoMo (number and account name), bank transfer (account details), and an international card/PayPal button linking to [GiveLively/PayPal/Donorbox URL]; (c) "Send us your receipt on WhatsApp" for confirmation. Add a short transparency note on how funds are used.

### 16. Professional email and fewer exposed addresses
`contact.html` lists three personal Gmail/Hotmail addresses. That looks less institutional and invites spam.
**Action:** set up domain email, e.g. `admissions@` / `info@time-liberia.com`, then:

> **Prompt:** Replace all public email addresses site-wide with `info@[domain]` (general) and `admissions@[domain]` (programs pages). Remove the personal addresses from `contact.html`. Update `data-to` on the contact form and the JSON-LD.

### 17. The contact form relies on `mailto:`
On many phones, and on shared or library computers, there's no email app set up, so the message never gets sent.

> **Prompt:** Point `#contact-form` at [Formspree endpoint]. Send it with `fetch`, show success and error states in `.form-status`, add a honeypot spam field, and keep the `mailto:` link as a visible fallback. Change the button text from "Prepare email" to "Send message". Update the README.

### 18. Social proof
> **Prompt:** Add a "Partners & recognition" strip (logo row) to `index.html` showing WE-CARE Liberia, the MoE / Bureau of Teacher Education seal and any other partners, with `assets/img/partners/` placeholders. Add social media links (Facebook is the main channel in Liberia) to the footer and to `sameAs` in the JSON-LD.

---

## P4 — Maintainability and SEO

### 19. The header and footer are copied into all 8 pages
Changing a phone number currently means editing 8+ files, and the README even warns about this. Static output can stay. Add a small templating step instead.

> **Prompt:** Migrate the site to Eleventy (11ty). Put the shared `<head>`, top bar, header, footer, action bar and WhatsApp button in `_includes/`, and keep contact details in `_data/site.json` (phones, emails, address, WhatsApp, social links). The built output must stay identical in HTML structure and URLs. Add a GitHub Actions workflow that builds and deploys to Pages on push to `main`, and update the README's editing instructions. *(If you'd rather keep a no-build site, skip this one.)*

### 20. SEO details
- Every page uses the same `og:image` (`graduates-2026.jpg`). Each page should have its own.
- Only `index.html` has JSON-LD.
- `canonical`, the sitemap and the JSON-LD all point to `github.io`, while the README plans `www.time-liberia.com`. Pick one before search engines index the site.
- Section IDs like `#section-1` are generic. Use meaningful ones such as `#why-time`.

> **Prompt:** Give each page its own `og:image` and `og:url`. Add `BreadcrumbList` JSON-LD to inner pages, `Person` JSON-LD to `founder.html` and `School` JSON-LD to `phica.html`. Rename the generic `#section-N` IDs to descriptive slugs and update every link that points to them. Once we've decided on the domain [github.io / time-liberia.com], update the canonical URLs, sitemap, robots.txt and JSON-LD to match, and add a `CNAME` file if it's the custom domain.

### 21. Analytics
There's currently no way to know which courses people look at or which buttons convert.

> **Prompt:** Add privacy-friendly analytics (GoatCounter or Plausible, one script tag on every page). Track events for: WhatsApp clicks (by page), "Apply" submissions, course detail opens (by course id), donate clicks and prospectus downloads.

### 22. Accessibility pass
The basics are good. Verify the details with tools:

> **Prompt:** Run axe-core and Lighthouse (mobile) on every page using Playwright, then fix all serious and critical issues. Check in particular: colour contrast of `.eyebrow`, chips and text over the hero and CTA images; that course-search results are announced (the `.course-count` live region); that the lightbox restores focus; and that the `button` wrapping the announcement image on `programs.html` (currently `style="all:unset"`) shows a visible focus ring. Save the report to `docs/a11y-report.md`.

---

## P5 — Growing into e-learning (next phase)

Do these once P0–P3 are done:

- **Blended/online courses.** Start with Google Classroom or Moodle Cloud, which have low upfront cost. Add a "Student login" link in the top bar and a `students.html` page with the class timetable, course materials, assignment deadlines and the LMS link. Choose tools that work on low bandwidth: downloadable PDFs and audio rather than streaming video.
- **News & events page** (`news.html`) for intake openings, graduations and outreach trips. It keeps the site looking current and gives you posts to share on Facebook.
- **Faculty page** with instructor profiles, qualifications and the courses each one teaches. This is a major trust signal for an accredited institution.
- **Alumni network & teacher sponsorship tracker.** Let donors sponsor a specific teacher and receive a completion update.
- **Language & literacy.** Consider simple-English summaries and audio versions of key pages (admissions, PHICA enrollment) for parents with limited literacy.

---

### Suggested order of work
1. P0 #1–#4 (one session, quick wins)
2. P1 #6 → #8 → #7 (catalogue data → admissions page → application form)
3. P2 #12–#13 (images and fonts)
4. P3 #15–#17 (donations and contact)
5. Everything else

**Before you start, gather this from the TIME team:** fees per program, the next intake dates, entry requirements, learning outcomes per course, mobile money and bank details, graduate testimonials with consent, the accreditation letter scan, partner logos and the domain decision.
