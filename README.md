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
| `contact.html` | Donate / volunteer / partner, contact details, message form |

Assets live in `assets/css/style.css`, `assets/js/main.js` and `assets/img/` (full-size photos plus `thumb-*` versions for grids).

## Publish on GitHub Pages

1. Merge this branch into `main`.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then save.
4. The site will be live at `https://<username>.github.io/<repo>/` within a minute or two. To use `www.time-liberia.com`, add it under **Custom domain** and point the domain's DNS to GitHub Pages.

## Editing

- **Text:** open the page's `.html` file and edit the text between the tags.
- **Photos:** add a JPG to `assets/img/` (ideally no wider than 1600px) and point an `<img src="...">` at it. For gallery items, also add a smaller `thumb-` copy.
- **Contact details** appear in the top bar and footer of every page, and on `contact.html` and `programs.html`.
- **Contact form:** the site is static, so the form opens the visitor's email app with the message already written, addressed to `tinstitute312@gmail.com`. To receive messages directly instead, point the form at a service such as Formspree.
