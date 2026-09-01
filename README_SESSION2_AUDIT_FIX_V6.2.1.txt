ECOSTAT ENGLISH LAB — SESSION 2 · BEAT THE ATS
AUDIT & DETERMINISM FIX — V6.2.1

DEPLOYMENT
Upload these files to the ROOT of the GitHub repository and replace the existing versions:
- index.html
- sw.js
- session1-linkedin-rescue-squad.html
- session2-beat-the-ats.html

Do NOT delete or replace data.js, app.js, styles.css, fixes.css, manifest.webmanifest or icons/.

MAIN V6.2.1 CHANGES
1. Cross-device determinism hardened
   - No randomisation and no shuffled answers.
   - Candidate order explicitly fixed: EQUADE, DSI, IRF, GRAF.
   - Option order explicitly fixed: A, B, C, D.
   - Each round always contains exactly the fixed values 1, 4, 7 and 10.
   - Approved best-answer map explicitly validated.
   - Metric tie-breaking is explicitly deterministic instead of relying on JavaScript sort stability.
   - Candidate/scoring configuration is frozen against accidental runtime mutation.
   - Final score and metric totals are canonically recalculated from the ten locked answers.
   - Final audit displays a Decision code + Ruleset ID + game version for easy device comparison.

2. PWA/cache consistency
   - Cache/version bumped to 6.2.1.
   - Group-activity links use the current version marker.
   - Cache fallback now ignores query strings, so versioned and unversioned activity URLs resolve to the same cached file offline.
   - Direct Session 1 and Session 2 pages explicitly request a service-worker update.

3. Configuration self-check
   - On load, Session 2 validates:
     * 10 score maps
     * exactly A-D options
     * 1/4/7/10 scoring on every round
     * approved best-answer map
     * 10 rounds for every Ecostat profile
     * expected metric maxima 30/30/20/20
   - If the ruleset is corrupted, the game blocks Start instead of silently producing inconsistent scores.

AUDIT RESULTS
- No Math.random / shuffle: OK
- Fixed option order A-D: OK
- Four profiles deterministic: OK
- Best path A-C-B-D-A-C-D-B-C-A: 100/100 on every profile
- Lowest possible score: 10/100
- Metric maxima: ATS 30 / Human 30 / Relevance 20 / Evidence 20
- HTML duplicate IDs: 0
- Broken ARIA/label references: 0
- Buttons without explicit type: 0
- Local Group Activity links: OK
- JS syntax: OK
- Service-worker syntax: OK
- Version consistency: 6.2.1

Decision codes make classroom checking simple. Example:
IRF:A-C-B-D-A-C-D-B-C-A · Ruleset ATS-S2-R1 · v6.2.1
Two teams using the same candidate and same decision code must receive the same final score and metric result.
