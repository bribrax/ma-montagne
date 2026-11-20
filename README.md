# Ma Montagne

A miniature 3D ski resort that grows with my study hours. Every hour of work I log earns credits, and credits unlock chalets, roads, lifts, slopes and scenery, one upgrade after another.

🏔 **[Open the app](https://bribrax.github.io/ma-montagne/)** (works offline once installed)

## Features

- 3D mountain rendered with Three.js, with a day / evening / night sky cycle and ambient sound
- Upgrade tree in five categories (chalets, roads, lifts, slopes, scenery), some depending on others: a chairlift needs its slope first
- Quick buttons to log 0.5 h, 1 h, 2 h or 4 h, and a session history
- Progress saved in the browser, with export and import
- Installable PWA, no build step: plain ES modules, about 2,700 lines of JavaScript

## Run it

Open the site above, or serve the folder locally: `python serve.py`.

The rules are easy to tune in `js/config.js` (credits per hour, day length, upgrade costs).

---
Built with Claude Code. Brieuc · BSc Microengineering, EPFL
