# TIME Inc. website: production launch checklist

Purpose: the public website for the Technical Institute for Many Empowerment (TIME) Inc. and Phìtìa Academy, plus the TIME Learning portal.

Users:
- **Prospective students** (teachers and professionals, mostly on phones with slow, costly data) who need to find a course and register.
- **Donors and partners** in Liberia and abroad.
- **Parents** looking at Phìtìa Academy.
- **Enrolled students, lecturers and administrators**, who use the learning portal.

Stack: static HTML/CSS/JS on GitHub Pages. The portal runs on Neon Auth and a Neon Function (`backend/`), which has its own tests and docs (`LEARNING_PORTAL.md`).

Status key: ✅ done · 🔨 in progress · ⏳ to do · ⛔ blocked (see the Blocked section)

## Already in place before this pass
- ✅ Pages: home, about, founder, programs, PHICA, impact, contact, FAQ, donate and 404
- ✅ Contact form that delivers directly (FormSubmit), with email and WhatsApp fallback and a honeypot
- ✅ Responsive WebP images with width and height set; self-hosted fonts
- ✅ Learning portal: accounts, roles, enrolment approval, lessons, assignments, quizzes and tests, attendance, reports, support centre (174 backend tests)
- ✅ Structured data on home and FAQ; sitemap and robots.txt; portal login pages set to noindex

## P0: required for launch
| # | Feature | Status |
|---|---|---|
| 1 | **Privacy policy page**: what the contact form, WhatsApp links and learning portal collect, where it goes, and how to ask for deletion; linked from every footer, the contact form and the portal | ✅ |
| 2 | **Automated tests for the public site** (Playwright and `node:test`): every page loads without errors, internal links and anchors resolve, images load, mobile menu, tabs, course search, lightbox, contact form (success, failure, validation), FAQ | ✅ |
| 3 | **Continuous integration**: a GitHub Actions workflow that runs the site tests and backend tests on every pull request and push to `main` | ✅ |
| 4 | **Accessibility audit and fixes**: axe-core on every page at phone and desktop sizes; fix contrast, names, landmarks and heading order; keyboard checks | ✅ |
| 5 | **SEO completeness**: canonical and social tags on `learning.html`, Course and Breadcrumb structured data, sitemap covering every public page, consistent titles | ✅ |

## P1: high value
| # | Feature | Status |
|---|---|---|
| 6 | **Offline and slow-network support**: web app manifest (Add to Home Screen) and a service worker that caches the site shell and pages for offline reading. Never caches portal API or auth traffic. | ✅ |
| 7 | **Basic security hardening**: Content-Security-Policy and referrer policy on public pages; every `target="_blank"` link has `rel="noopener"`. The portal pages are left as they are, because their live sign-in can't be tested from here. | ✅ |
| 8 | **Contact form polish**: inline field errors instead of browser pop-ups, a message length limit with counter, and topic preselected from links such as `contact.html?topic=Volunteering` | ✅ |
| 9 | **FAQ search**: filter questions as you type, with an empty state | ✅ |
| 10 | **Print styles**: Programs, FAQ and Donate print cleanly without navigation or decorative elements | ✅ |

## P2: nice to have
| # | Feature | Status |
|---|---|---|
| 11 | News and events page (needs real dates and items from TIME) | ⛔ |
| 12 | Graduate testimonials (needs real quotes and permission) | ⛔ |
| 13 | Shared header and footer kept in one place (`partials/` + `npm run layout`; tests catch drift). This found and fixed a missing "Online Learning" link on the About page. | ✅ |

## Blocked: needs information or accounts from TIME Inc.
| Item | What is needed |
|---|---|
| Program fees and next intake dates | Fee amounts per program, installment rules, registration deadline and start dates |
| Mobile Money and online donations | Orange Money and MTN MoMo numbers (account names); a Givebutter, Donorbox or PayPal giving link |
| Google Maps and review links | The verified Google Business Profile links (see `GOOGLE_BUSINESS_PROFILE.md`) |
| Custom domain (`time-liberia.com`) | Access to the domain's DNS settings |
| Visitor analytics | A GoatCounter or Cloudflare Web Analytics account (free) |
| Facebook and WhatsApp Channel links | The official page and channel URLs |
| Learning portal backend changes in production | Neon deploy credentials. The backend is deployed through Neon, which this environment can't reach. |
| Branded email for portal codes | SMTP settings (see `LEARNING_PORTAL.md`) |
