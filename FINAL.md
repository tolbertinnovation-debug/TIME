# TIME Inc. website: summary

The TIME Inc. website is a tested, accessible, secure, offline-capable site, live at https://tolbertinnovation-debug.github.io/TIME/. It publishes TIME Inc.'s approved fees and 2027 intake dates. Every item marked critical or high priority in `FEATURES.md` is done. What's left needs information or accounts that only TIME Inc. can provide.

## Pages

| Area | Pages |
|---|---|
| **Four areas (home page buttons)** | TIME Inc. (`time-inc.html`), Phìtìa Academy, Consultation (`consultation.html`), Book Production, Sales & Publications (`books.html`) |
| **About TIME** | Home, About, Our Founder, Leadership & Faculty (`team.html`), Phìtìa Academy, Our Impact, Photo Gallery (`gallery.html`), News & Events (`news.html`) |
| **Study with TIME** | Programs (overview of six programs and a course search), one page per program (`programs-*.html`), Fees & Admissions (`admissions.html`), FAQ, Online Learning (TIME Learning portal) |
| **Get involved** | Donate, Contact |
| **Utility** | Search (`search.html`), Privacy policy, Offline page, 404 page |

## What was built

| Area | What's there now |
|---|---|
| **Fees & admissions** | Mobile Money payment details (0888 901 848, Philip V. Saywrayne). The approved fee schedule in US$ and LRD (US$1 = LRD 170), registration and exam fees, the 50% discount, payment rules and the 2027 intake. Register by Mon 4 Jan 2027, classes begin Mon 8 Mar 2027, next intake Thu 14 Oct 2027. Includes a five-step "How to apply" guide. Fees and dates also appear on each program page, the FAQ, News and the home banner, and tests keep them identical everywhere. |
| **Programs** | Six program pages, each covering who it's for, at-a-glance facts with tuition, courses, schedule, enrolment steps, questions and related programs. They are generated from `data/programs.json` (`npm run programs`). |
| **TIME Assistant** | A chat button on every page answers common questions (fees, 2027 dates, how to apply, programs and courses, class times, location, PHICA, donating) from the approved information, answers anything else published on the site (founders, lecturers, outreach, PHICA, privacy, news) from the pages themselves, and hands what it can’t answer to a live WhatsApp chat to a person on WhatsApp with the question filled in. It costs nothing to run, sends nothing to outside services and works offline. Answers are edited in `data/assistant.json`. |
| **Search** | A header search button on every page. Results rank pages, individual courses and FAQ answers, ignore accents and case, and update as you type. The FAQ also has its own search. |
| **Content** | News & Events with topic filters and dated events, Leadership & Faculty listing the founders, the board (Co-chair Nya Melvin Quoibiedah) and every lecturer, a Photo Gallery with a full-screen viewer, a 35-second outreach video on the home page and Our Impact that only downloads when played, and a privacy policy written from how the site actually handles data. |
| **Learning portal** | The account workspace downloads 70% less (61 KB instead of 164 KB), with sign-in behaviour checked as identical against the live service. Study guides work offline, and the signed-in workspace is never cached. |
| **Accessibility** | Zero WCAG 2.1 A/AA violations (axe-core) on every public page and the study portal, at phone and desktop widths. |
| **Forms** | The contact form sends directly, with inline errors, length limits, a spam honeypot, an email/WhatsApp fallback and topic preselection from links. |
| **Offline and slow networks** | The site can be installed on a phone. Visited pages reopen with no connection, and an offline page lists phone numbers. Images are responsive WebP and fonts are self-hosted. |
| **SEO** | Canonical and social tags on every page, plus Organization/LocalBusiness, FAQ, Course (with tuition), ItemList and breadcrumb structured data. The sitemap is complete and utility and login pages are set to noindex. |
| **Security** | A Content-Security-Policy and referrer policy on public pages (no inline or third-party scripts), and `noopener` on every new-tab link. |
| **Print** | Programs, Admissions, FAQ, Donate and Privacy print cleanly. |
| **Maintainability** | The shared header, menu, footer and contact bars live in `partials/` (`npm run layout`), and program pages and the search index are generated (`npm run programs`, `npm run search`). Tests fail if any of these fall out of date. README covers editing, testing and asset versioning. |
| **Tests and CI** | 197 browser and static tests (`npm test`) covering rendering, links, interactions, forms, accessibility, SEO data, fees and dates consistency, layout sync, search, the chat assistant, offline behaviour and print. GitHub Actions runs them, plus the portal's 174 backend tests and build, on every pull request and push to `main`. |

Every change went through a pull request with green CI, was merged, and was checked on the live site.

## Still needed from TIME Inc.
These can't be done without your information or accounts. Details are in `FEATURES.md` under "Blocked".
1. An online giving link (Givebutter, Donorbox or PayPal) for donors abroad, and bank details if TIME wants them published. Mobile Money (0888 901 848, Philip V. Saywrayne) is now on the site.
2. The tuition fee for the Laboratory Practical Training for Senior High Science Teachers (to be confirmed by the administration)
3. Google Business Profile links once it's verified (steps in `GOOGLE_BUSINESS_PROFILE.md`)
4. DNS access for the custom domain `time-liberia.com`
5. A free analytics account (GoatCounter or Cloudflare Web Analytics)
6. Official Facebook page and WhatsApp Channel links
7. Neon deploy access and SMTP settings for learning-portal backend changes and branded emails

## Worth reviewing at TIME Inc.
- Agriculture consultation details (what is offered and for whom); the page currently invites enquiries only.
- The other nine book titles, prices, and whether TIME produces books for other authors.
- Rolling enrollment is shown alongside the January 4, 2027 deadline for the March start.
- The signature and approval lines on the fee schedule were blank in the copy provided. It was published as final.
- The LRD amounts for the US$125 and US$175 courses are calculated at US$1 = LRD 170. The schedule only states LRD amounts for the "C" Certificate and the exam fee.
- The "Who it's for" and "What you'll develop" lists on each program page were drafted from the existing course descriptions.
- The privacy policy describes current practices but isn't legal advice.
- A signed-in trial of the learning portal by a real lecturer and student, as `LEARNING_PORTAL.md` recommends.

## Nice to have later
- Exact dates for older news stories (graduation, outreach trips) and new stories as they happen
- Graduate testimonials, with real quotes and permission
