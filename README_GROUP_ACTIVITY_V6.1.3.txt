ECOSTAT ENGLISH LAB — V6.1.3
================================

PURPOSE
-------
This targeted update reorganises Group Activities by course session and includes the post-deployment audit fixes.

WHAT CHANGED
------------
1. Group Activities now has a scalable hierarchy:
   Group Activities > Session 1 > LinkedIn Rescue Squad.
2. The Home page Group Activities block now opens the Group Activities section first instead of bypassing the session category.
3. Session 1 has its own heading, course-focus description and activity count.
4. The LinkedIn Rescue Squad remains inside Session 1 with the same deterministic /100 scoring and 3–4 student speaking structure.
5. Dictionary word-modal accessibility was hardened so aria-labelledby is valid before the first modal opening.
6. PWA cache version bumped to 6.1.3 so browsers refresh the updated navigation and layout.

AUDIT CHECKS
------------
- duplicate HTML IDs: none
- broken label targets: none
- broken aria-labelledby / aria-controls targets: none
- buttons missing type: none
- local links/assets in the tested complete site package: present
- inline Group Activity JavaScript syntax: valid
- service-worker JavaScript syntax: valid
- Group Activity: 10 scoring rounds
- each round uses fixed scores 1 / 4 / 7 / 10
- best possible score: 100/100
- worst possible score: 10/100
- same answers always produce the same score
- 3-student and 4-student role systems preserved
- 2-minute individual presentation timer preserved

FILES TO REPLACE / ADD AT REPOSITORY ROOT
-----------------------------------------
index.html
fixes.css
sw.js

The LinkedIn Rescue Squad HTML itself does not require a code change in this release. It is included in the ZIP as a verified reference copy so the package is self-contained.

DO NOT DELETE OR REPLACE UNNECESSARILY
--------------------------------------
data.js
app.js
styles.css
manifest.webmanifest
icons/

After uploading, GitHub Pages may take a short moment to publish. The V6.1.3 service worker is designed to replace the older Ecostat cache automatically.
