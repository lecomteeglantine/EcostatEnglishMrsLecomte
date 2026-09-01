ECOSTAT ENGLISH LAB — SESSION 2 GROUP ACTIVITY — V6.2.0
=========================================================

NEW GROUP-ACTIVITY STRUCTURE
----------------------------
Group Activities
  → Session 1
     → LinkedIn Rescue Squad
  → Session 2
     → Beat the ATS

SESSION 2: BEAT THE ATS
-----------------------
Collaborative game for 3–4 students, one device per team.
Theme: Writing a winning CV / British CV vs American résumé / ATS / tailoring / quantified achievements.

TECHNICAL RULES LOCKED IN THE GAME
----------------------------------
- 10 scored decisions.
- Every round has four options worth exactly 1, 4, 7 or 10 points.
- Maximum score = 100/100.
- Minimum score = 10/100.
- Same option = same points every time.
- No random score bonus.
- No AI scoring.
- Four fixed indicators: ATS fit 30, Human impact 30, Relevance 20, Evidence 20.
- Candidate/vacancy choice is not scored.
- All candidate names, employers, vacancies and performance figures are fictional teaching scenarios.

FINAL PRESENTATION
------------------
- 6-minute team preparation.
- The site automatically assigns a different role to each student.
- All 10 game decisions are distributed exactly once across the speaking roles.
- Every student speaks.
- Maximum speaking time = 2:00 per student.
- The individual timer must be started before the Next Speaker button is enabled.
- Once a timer is started, Reset is disabled so the 2-minute maximum cannot be extended.
- Students use the team’s actual locked decisions; they do not redesign the CV after seeing the score.
- Every speaker must justify at least one choice and mention a weaker rejected alternative.
- The final speaker gives the 60-second CV walk-through from Session 2: background/specialisation, one key project, two quantified achievements, one skill to develop, then a one-sentence double-reader conclusion.

GITHUB DEPLOYMENT
-----------------
At the ROOT of the repository:

REPLACE:
- index.html
- fixes.css
- sw.js
- session1-linkedin-rescue-squad.html

ADD:
- session2-beat-the-ats.html

DO NOT DELETE OR REPLACE:
- data.js
- app.js
- styles.css
- manifest.webmanifest
- icons/

WHY SESSION 1 IS INCLUDED
-------------------------
Only its manifest cache-busting reference is aligned with V6.2.0. Its game content/scoring is otherwise unchanged.

PWA / CACHE
-----------
Service-worker cache version: V6.2.0.
The new Session 2 page is included in the offline core and in the network-first mutable-file list.

VALIDATION COMPLETED
--------------------
- JavaScript syntax: OK
- Service-worker syntax: OK
- Duplicate HTML IDs: 0
- Broken aria-labelledby / aria-controls / label-for references: 0
- Session 2 rounds: 10
- Four options per round: confirmed
- Score values per round: 1 / 4 / 7 / 10
- Maximum path: 100/100
- Minimum path: 10/100
- Metric maxima: 30 / 30 / 20 / 20
- 3-student role coverage: decisions 1–10 exactly once
- 4-student role coverage: decisions 1–10 exactly once
- Local file references in complete-site test package: all resolved
- V6.2.0 cache/version references aligned
