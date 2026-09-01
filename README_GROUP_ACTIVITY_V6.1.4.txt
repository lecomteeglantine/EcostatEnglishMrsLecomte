ECOSTAT ENGLISH LAB — GROUP ACTIVITIES SESSION 1 — V6.1.4

Replace at the repository root:
- index.html
- fixes.css
- sw.js
- session1-linkedin-rescue-squad.html

Do not replace data.js, app.js, styles.css, manifest.webmanifest or the icons folder.

AUDIT FIXES IN V6.1.4
- PWA manifest query on the standalone Session 1 game now matches the current release.
- Speaker timer Reset is disabled once a speaking turn has started, so the 2-minute maximum cannot be extended by restarting the clock.
- Keyboard focus is moved to the new decision/results/speaker heading after screen changes, preventing focus loss when the previous Next button disappears.
- Very narrow mobile header hardened to prevent horizontal overflow.
- Cache/service-worker version bumped to 6.1.4.
- Existing deterministic scoring preserved: 10 rounds, fixed 1/4/7/10 scoring, maximum 100/100.
