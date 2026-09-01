# Audit Ecostat English Lab — correctif V6.0.1

Audit réalisé sur la version publique et le dépôt GitHub le 1er septembre 2026.

## Correctifs prioritaires intégrés

- **Cache PWA obsolète** : la V5 utilisait une stratégie `cache-first` pour tous les fichiers non-navigation. Un ancien `app.js`, `data.js` ou `styles.css` pouvait donc continuer à être servi après un déploiement GitHub. La V6 utilise `network-first` pour les fichiers modifiables et versionne les URLs critiques avec `?v=6.0.1`.
- **État “0 dictionary entries” en cas d'échec de chargement** : l'application ne masque plus silencieusement un échec de `data.js`. Une alerte explicite et un bouton de réparation du cache sont fournis.
- **Quiz English → French** : en cas de mauvaise réponse, la V5 affichait le terme anglais comme « Correct answer » au lieu de la traduction française. Corrigé.
- **Timer Interview Lab** : après arrivée à `00:00`, cliquer sur le bouton ne réinitialisait pas réellement la durée avant un nouveau démarrage. Corrigé.
- **Timer Interview Blitz** : même défaut après `00:00`. Corrigé.
- **Sous-ensembles vides** : les modes Collocation, Frenglish, Chart, Blitz et Pronunciation disposent désormais de gardes explicites ; aucun accès à une question inexistante.
- **Stress challenge** : génération d'options rendue robuste et sans doublons inutiles.
- **Navigation entre activités** : arrêt des timers et du délai de quiz lors d'un changement de vue afin d'éviter des activités qui continuent en arrière-plan.
- **Contenu injecté dans le DOM** : les chaînes de la base sont échappées avant insertion dans `innerHTML`, ce qui évite qu'un caractère `<`, `&`, guillemet, etc. casse une carte ou un exercice.
- **Modales** : synchronisation `aria-hidden`, fermeture Échap, clic hors fenêtre et piège de focus conservés/renforcés.
- **Import de progression** : validation des identifiants, des statistiques et de la taille du fichier ; compatibilité avec l'ancien format d'export maintenue.
- **Export de progression** : format plat compatible avec la V5 et téléchargement plus fiable (lien temporairement ajouté au DOM).
- **Progression existante** : conservation intégrale des clés `eco_*` utilisées par la V5.
- **Mise en page** : maintien de la grille d'accueil 3 × 2 sur grand écran, cibles tactiles renforcées et protections contre les débordements de textes longs.

## Ce qui n'est volontairement pas remplacé

- `data.js` : la base V5 annoncée à 592 entrées reste intacte.
- `styles.css` : le thème principal existant reste intact ; `fixes.css` ajoute uniquement des ajustements ciblés.
- `manifest.webmanifest` et `icons/` : aucun correctif nécessaire pour cette passe.

## Contrôles statiques effectués sur le paquet

- `app.js` : syntaxe JavaScript validée avec `node --check`.
- `sw.js` : syntaxe JavaScript validée avec `node --check`.
- HTML : aucun `id` dupliqué.
- HTML : 56 boutons, tous avec `type="button"` pour éviter les soumissions accidentelles.
- Ordre de chargement contrôlé : `data.js?v=6.0.1` avant `app.js?v=6.0.1`.
- Versionnement contrôlé sur manifest, CSS, data et application.
- Les références DOM statiques de `app.js` ont été rapprochées des IDs présents dans `index.html`; les IDs absents du HTML initial sont uniquement ceux créés dynamiquement par les exercices.

## Déploiement

Remplacer uniquement `index.html`, `app.js`, `sw.js` et ajouter `fixes.css` à la racine du dépôt. Ne pas supprimer les autres fichiers.
