ECOSTAT ENGLISH LAB — SESSION 1 GROUP ACTIVITY — V6.1.1
=========================================================

PURPOSE
-------
Targeted bug-fix release for:
  #group-activities
  session1-linkedin-rescue-squad.html

FILES TO UPLOAD / REPLACE AT THE ROOT OF THE GITHUB REPOSITORY
---------------------------------------------------------------
1. index.html
2. fixes.css
3. sw.js
4. session1-linkedin-rescue-squad.html

DO NOT DELETE OR REPLACE
------------------------
data.js
app.js
styles.css
manifest.webmanifest
icons/

FIXES IN V6.1.1
---------------
- Team-member names are preserved when switching between 3 and 4 students.
- Candidate selection now exposes its selected state to assistive technologies.
- Once an answer is chosen, all four round choices are genuinely disabled,
  preventing keyboard/double-click reactivation.
- Final-result wording now matches the actual score; a weak score is no longer
  described as automatically "recruiter-ready".
- The explanatory recruiter verdict is now displayed instead of being silently
  calculated and discarded.
- Team name, candidate and career target are shown in the final result.
- The completion screen now reflects the actual final score.
- Preparation and individual-speaker timers are based on real elapsed time,
  reducing drift caused by browser throttling or a busy computer.
- Timer status text resets correctly when a timer is started again.
- Leaving a timed screen clears its timer safely.
- Reduced-motion preferences are respected for screen changes.
- Focus / Credibility / Authenticity / Visibility meters now expose proper
  progress-bar semantics and live values.
- Preparation and speaking timers expose timer/live-region semantics.
- All buttons explicitly use type="button" for robustness.
- PWA cache bumped to 6.1.1 so browsers do not keep serving V6.1.0 assets.

SCORING CHECK
-------------
- 10 decisions.
- Each decision uses the same fixed point set: 1 / 4 / 7 / 10.
- No random points and no AI-based scoring.
- Best-answer route = exactly 100/100.
- Perfect metric totals = Focus 30 / Credibility 30 / Authenticity 20 /
  Visibility 20.
- Same answer on the same decision = same points for every team.
- Team size (3 or 4) never changes the game score.

PRESENTATION CHECK
------------------
- 3 students -> 3 separate speaking roles.
- 4 students -> 4 separate speaking roles.
- Preparation time: 6 minutes.
- Individual speaking timer: maximum 2 minutes per student.
- Final speaker includes the elevator pitch.

VALIDATION PERFORMED
--------------------
- JavaScript syntax: OK.
- Service-worker syntax: OK.
- Duplicate HTML IDs: none.
- Every literal JavaScript DOM ID reference resolves to an HTML element.
- Label targets: OK.
- Group activity route/link: OK.
- Fixed scoring table: OK.
- 100/100 optimal path: OK.
- PWA cache version: 6.1.1.

DEPLOYMENT
----------
Upload the four files above to the repository root and replace the existing
versions. GitHub Pages should then serve V6.1.1. Because the service worker is
versioned, reopening/reloading the site should retire the previous Ecostat cache.
