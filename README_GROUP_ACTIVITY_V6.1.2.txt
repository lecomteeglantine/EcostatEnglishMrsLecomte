ECOSTAT ENGLISH LAB — GROUP ACTIVITY V6.1.2

Upload/replace at repository root:
- index.html
- fixes.css
- sw.js
- session1-linkedin-rescue-squad.html

Do not delete or replace data.js, app.js, styles.css, manifest.webmanifest or icons/.

Residual bugs fixed in V6.1.2:
- preserves all four student names when switching 4 → 3 → 4 players
- direct game URL now registers the service worker and exposes PWA metadata
- timers no longer announce every second to screen readers; only useful status messages are announced
- speaker progression is locked until the 2-minute timer has actually been started
- timer expiry no longer offers an accidental second full time window; Reset is the explicit restart action
- keyboard focus moves to the next-decision control after feedback
- mobile score bar no longer consumes a large fixed portion of the viewport
- mobile result rows keep the score aligned with the decision title
- long speaker-role labels stack safely on narrow screens
- explicit focus-visible outlines added to key group-activity controls
- service-worker cache/version bumped to 6.1.2

Scoring unchanged and re-verified:
10 rounds × max 10 = 100; every round uses fixed 1/4/7/10 scores; metrics max = 30 Focus + 30 Credibility + 20 Authenticity + 20 Visibility.
