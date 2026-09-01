ECOSTAT ENGLISH LAB — SESSION 2 AUDIT FIX V6.2.2

WHAT WAS CHECKED
- Fixed option order A–D on every device
- No randomisation / no Math.random / no shuffle
- Same profile + same 10 option letters = same score and same metric totals
- 4 pathways: EQUADE, DSI, IRF, GRAF
- 10 rounds, fixed scores 1 / 4 / 7 / 10
- Best path remains A-C-B-D-A-C-D-B-C-A = 100/100
- Worst possible total = 10/100
- Metric maxima = ATS 30 / Human 30 / Relevance 20 / Evidence 20
- HTML IDs, ARIA references, labels, local links and JS syntax checked
- PWA cache/version bumped to 6.2.2

FIX IN V6.2.2
Decision 4 (layout) had a scoring inconsistency: the one-long-paragraph option received 7/10 while the table-based option received 4/10, despite the feedback describing the paragraph as worse for human readability. The two values are now aligned with the feedback:
- A decorative multi-column layout: 1/10
- B table-based layout: 7/10
- C one long paragraph: 4/10
- D simple single-column layout: 10/10

DEPLOY
Replace at repository root:
- index.html
- sw.js
- session1-linkedin-rescue-squad.html
- session2-beat-the-ats.html

Do not replace data.js, app.js, styles.css, fixes.css, manifest.webmanifest or icons/.
