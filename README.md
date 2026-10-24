# TIME Inc. Website

Official website of the **Technical Institute for Many Empowerment (TIME) Inc.**, Liberia, and its sister school **Phìtìa Academy (PHICA)**.

A fast, mobile-first static site: plain HTML, CSS and a small JavaScript file. It needs no build step and no server.

## Pages

| File | Content |
| --- | --- |
| `index.html` | Home: hero, impact stats, what we do, programs, PHICA, stories, founder |
| `about.html` | History of TIME Inc., mission, vision, values, founders |
| `founder.html` | Biography of Dr. Philip V. Saywrayne, III |
| `programs.html` | All certificate & diploma courses, schedules, registration |
| `phica.html` | Phìtìa Academy profile, needs and appeal |
| `impact.html` | Focus areas, success stories, photo gallery |
| `programs-*.html` | One page per program (generated from `data/programs.json`) |
| `search.html` | Site search across pages, courses and FAQ answers |
| `news.html` | News & events: stories with topic filters, registration and class schedule |
| `contact.html` | Donate / volunteer / partner, contact details, message form |
| `donate.html` | What a gift provides, how to give, in-kind donations, where support goes |
| `faq.html` | Frequently asked questions (admissions, online learning, PHICA, supporting TIME) |

Assets live in `assets/css/style.css`, `assets/js/main.js`, `assets/fonts/` (self-hosted DM Sans, Manrope and Fraunces, with their licenses) and `assets/img/` (full-size photos plus `thumb-*` versions for grids).

## Publish on GitHub Pages

1. Merge this branch into `main`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
4. The site will be live at `https://<username>.github.io/<repo>/` within a minute or two. To use `www.time-liberia.com`, add it under **Custom domain** and point the domain's DNS to GitHub Pages.

## Testing

Install once with `npm ci`, then run `npm test`. This runs Playwright browser tests of every page: rendering, links, forms, accessibility (axe), SEO data, offline mode and print. `npm run serve` previews the site at http://127.0.0.1:8080. GitHub Actions runs these tests and the learning portal's backend tests on every pull request.

When you change `assets/css/*.css` or `assets/js/main.js`, update the `?v=` version on those links in every page and in the `CORE` list in `sw.js`, so visitors' browsers fetch the new file. A test checks that the two match.

## Google Business Profile

See [`GOOGLE_BUSINESS_PROFILE.md`](GOOGLE_BUSINESS_PROFILE.md) for the details to enter and the steps to get TIME Inc. onto Google Maps.

## Editing

- **Text:** open the page's `.html` file and edit the text between the tags.
- **Photos:** add a JPG to `assets/img/` (ideally no wider than 1600px) and point an `<img src="...">` at it, with `width` and `height` set to the photo's pixel size. For gallery items, also add a smaller `thumb-` copy. Pages serve smaller WebP copies from `assets/img/webp/` (`name-480.webp`, `name-960.webp`, `name-1600.webp`) through a `<picture>` tag; copy the markup of an existing photo and create the WebP files for new ones (for example with `cwebp -q 72 -resize 960 0 photo.jpg -o webp/photo-960.webp`). Without them the JPG still shows, just more slowly.
- **Donating:** to add Mobile Money numbers or an online giving link, copy one of the "way" boxes under *How to give* in `donate.html` (there is a commented example there).
- **FAQ:** each question in `faq.html` is a `<details>` block. When you add or change one, update the matching entry in the `FAQPage` data at the bottom of the page so Google shows the same answer.
- **Menu, top bar, footer and phone action bar** are shared by every page. Edit them once in `partials/` (for example a phone number in `partials/footer.html`), then run `npm run layout` to copy the change into every page. The tests fail if a page falls out of step.
- **Program pages:** edit `data/programs.json` (who it's for, facts, courses), then run `npm run programs`. Course lists must match the tabs on `programs.html`; the tests check this.
- **Search:** after changing page text, programs or FAQ answers, run `npm run search` to rebuild `assets/search-index.json`. The tests fail if it is out of date.
- **News:** to add a story to `news.html`, copy one `<article class="img-card news-item">` block to the top of the list and change its text, link, photo, date (`<time datetime="2026-11">November 2026</time>`) and `data-category` (`programs`, `graduation`, `outreach` or `phica`). Add confirmed intake or graduation dates to the *Events & schedule* list.
- **Contact details** also appear in the body of `contact.html`, `programs.html`, `faq.html`, `donate.html` and `offline.html`.
- **Contact form:** messages are delivered to `tinstitute312@gmail.com` through [FormSubmit](https://formsubmit.co), a free service that needs no account. The **first** message sent after publishing triggers an "Activate Form" email to that inbox; click the link once and every message after that arrives directly. Until then, and whenever sending fails, visitors are offered a prepared email or WhatsApp message instead. To change the receiving address, edit `data-to` on the form in `contact.html`.
