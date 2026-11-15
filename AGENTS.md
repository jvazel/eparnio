# Instructions Globales du Projet — Eparnio

Tu travailles sur **Eparnio**, une application **Mobile-First (PWA)** de gestion budgétaire personnelle et partagée, inspirée de Finzee, reposant sur la méthode du **Budget Base Zéro** et la **saisie manuelle proactive**.

## Documents de Référence
* @[SPECIFICATIONS_FINZEE.md](./SPECIFICATIONS_FINZEE.md) — Cahier des charges fonctionnel, architecture des écrans et Design System.
* @[ARCHITECTURE.md](./ARCHITECTURE.md) — Stack technique, arborescence `frontend/` vs `backend/`, contrat d'API REST et schémas MongoDB.
* @[ROADMAP.md](./ROADMAP.md) — Feuille de route séquentielle et suivi d'avancement.

## Invariants Métier Absolus (À ne jamais casser)
1. **Équilibre Base Zéro (`remainingToAllocate` / `Restant à répartir`) :**
   * Chaque euro gagné doit recevoir une mission précise dans les 3 pôles d'allocation (`fixed_charge` incluant les mensualités de crédits, `variable_envelope`, `savings`).
   * Formule : `remainingToAllocate = plannedIncome - (plannedFixedCharges + plannedEnvelopes + plannedSavings)`.
   * L'objectif affiché à l'utilisateur est d'atteindre `0 €`.
2. **Reste à vivre / Reste à dépenser en temps réel (`remainingToLive`) :**
   * Formule : `remainingToLive = plannedIncome - plannedFixedCharges - plannedSavings - spentVariables` (reflété dans la jauge « Reste à dépenser » et la ligne `Restant` de l'onglet Budget).
3. **Cycle budgétaire personnalisable & Reconduction automatique :**
   * Le mois budgétaire ne commence pas forcément le 1er du mois calendaire : il démarre au `budgetStartDay` choisi par l'utilisateur (ex. : le `28` du mois à la réception du salaire). Naviguer vers un nouveau mois reconduit automatiquement les éléments `isRecurring: true` et la structure des enveloppes.

## Règles d'Architecture & de Développement (Projet 100 % IA)
* **Séparation stricte Frontend / Backend & Orchestration unifiée :**
  * `frontend/` est une Web App React + TypeScript + Vite + Tailwind CSS (PWA). Elle ne communique avec le serveur que via l'API REST (`/api/*`) et ne doit jamais contenir de logique MongoDB ou de secrets.
  * `backend/` est une API REST Node.js + Express + TypeScript + Mongoose connectée à MongoDB. Elle ne doit contenir aucune logique d'affichage.
  * Le `package.json` à la racine orchestre les deux applications pour permettre de lancer simultanément frontend et backend via `npm run dev` (avec `concurrently`), ainsi que les contrôles globaux (`npm test`, `npm run test:coverage`, `npm run typecheck`, `npm run build`).
* **Tests de non-régression & Couverture de code obligatoires :**
  * Chaque nouvelle fonctionnalité ou étape de la roadmap doit inclure ses **tests automatisés de non-régression** (backend et/ou frontend).
  * Avant de valider toute livraison, exécuter obligatoirement `npm run typecheck && npm run test:coverage` à la racine pour garantir l'absence de régression et vérifier la couverture de code (sans baisse injustifiée).
* **Qualité & Suivi d'avancement obligatoire :**
  * L'utilisateur pilote le projet à 100 % via l'IA : chaque étape livrée doit être complète, typée sans erreur, testée et directement exécutable.
  * À la fin de chaque tâche ou étape de la roadmap, vérifier le passage complet de `typecheck` et `test:coverage`, puis cocher `[x]` les sous-tâches correspondantes dans `ROADMAP.md`.
* **Skills dédiés :**
  * Active le skill `eparnio-feature-workflow` pour toute implémentation de fonctionnalité ou d'étape de `ROADMAP.md`.
  * Active le skill `eparnio-mobile-ui` pour toute création ou modification de composants UI et d'écrans dans `frontend/`.
