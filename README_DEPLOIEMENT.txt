CORRECTIF ECOSTAT ENGLISH LAB — V6.0.1
======================================

CE ZIP EST UN CORRECTIF CIBLE.
Il ne contient volontairement PAS data.js : les 592 entrées de vocabulaire existantes restent intactes.

À FAIRE SUR GITHUB
------------------
1. Décompresser le ZIP.
2. Dans le dépôt EcostatEnglishMrsLecomte, à la RACINE :
   - remplacer index.html
   - remplacer app.js
   - remplacer sw.js
   - ajouter fixes.css
3. NE PAS supprimer ni remplacer :
   - data.js
   - styles.css
   - manifest.webmanifest
   - le dossier icons/
4. Valider le commit GitHub.
5. Ouvrir le site normalement et actualiser une fois.

POURQUOI LE NOUVEAU index.html EST IMPORTANT
---------------------------------------------
Les fichiers app.js, data.js et styles.css sont appelés avec ?v=6.0.1.
Cela force les navigateurs déjà équipés de l'ancien Service Worker V5 à aller chercher
les bons fichiers au lieu de continuer à afficher une copie obsolète du cache.

SI UN NAVIGATEUR RESTE BLOQUÉ SUR UNE ANCIENNE VERSION
------------------------------------------------------
La V6 affiche un bouton « Repair data load » si la base de vocabulaire n'a pas chargé.
Ce bouton vide uniquement les anciens caches de cette application, désenregistre le Service Worker,
puis recharge proprement le site. La progression des étudiants dans localStorage n'est pas supprimée.

PROGRESSION ÉTUDIANTE
---------------------
Les clés existantes sont conservées : eco_fav, eco_mastered, eco_attempts, eco_correct,
eco_skill_attempts, eco_skill_correct, eco_programme et eco_a11y.
Le correctif ne repart donc pas de zéro pour les utilisateurs qui ont déjà travaillé sur le site.

FICHIERS DU CORRECTIF
---------------------
index.html   : versionnement anti-cache + alerte de récupération + attributs d'accessibilité
app.js       : correctifs fonctionnels et robustesse
sw.js        : stratégie de cache V6 qui met à jour les fichiers modifiables
fixes.css    : correctifs d'affichage/accessibilité ciblés
AUDIT_ECOSTAT_V6.md : détail de l'audit
