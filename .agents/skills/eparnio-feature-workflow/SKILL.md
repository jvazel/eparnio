---
name: eparnio-feature-workflow
description: >-
  Procédure standard de bout en bout (Backend MongoDB/Express + Frontend React Mobile-First + Vérification)
  pour développer, modifier ou valider une fonctionnalité ou une étape de la ROADMAP dans le projet Eparnio.
  Activer ce skill dès que l'utilisateur demande d'implémenter une fonctionnalité, un écran ou une étape de ROADMAP.md.
---

# Workflow de Développement Eparnio (End-to-End)

Suivre ces 4 étapes dans l'ordre pour chaque fonctionnalité ou étape de `ROADMAP.md`.

## Étape 1 : Lecture du Contexte
1. Lire la section concernée dans [ROADMAP.md](../../../ROADMAP.md) pour identifier exactement les sous-tâches à livrer.
2. Vérifier le modèle de données et les endpoints attendus dans [ARCHITECTURE.md](../../../ARCHITECTURE.md).
3. Vérifier les règles métier et parcours utilisateur dans [SPECIFICATIONS_FINZEE.md](../../../SPECIFICATIONS_FINZEE.md).

## Étape 2 : Implémentation Backend (`backend/`)
1. **Modèles (`src/models/`) :** Créer ou mettre à jour le schéma Mongoose et ses index.
2. **Validation (`src/validators/` ou dans les routes) :** Écrire les schémas Zod pour `body`, `params` et `query`.
3. **Services (`src/services/`) :** Implémenter la logique métier et s'assurer que les agrégats `BudgetPeriod.summary` (`remainingToAllocate` et `remainingToLive`) sont recalculés à chaque changement d'enveloppe ou de transaction.
4. **Contrôleurs & Routes (`src/controllers/`, `src/routes/`) :** Exposer les routes REST protégées par JWT et vérifier l'appartenance de l'utilisateur au `Budget`.
5. **Tests Backend (`src/__tests__/`) :** Écrire les tests unitaires (services) et d'intégration API (Supertest + `mongodb-memory-server`) couvrant les cas nominaux, erreurs et invariants financiers.

## Étape 3 : Implémentation Frontend (`frontend/`)
1. **Types (`src/types/`) :** Aligner les interfaces TypeScript avec les réponses JSON du backend.
2. **Services API (`src/services/`) :** Ajouter les appels Axios et les hooks TanStack Query (avec invalidation automatique des queries `['period']`, `['envelopes']`, `['transactions']`, `['analytics']` après mutation).
3. **Interface Mobile-First (`src/features/` et `src/components/`) :** Activer et appliquer le skill `eparnio-mobile-ui` pour construire des écrans clairs, tactiles et adaptés au pouce.
4. **Navigation (`src/App.tsx` / `BottomNav.tsx`) :** Brancher les nouvelles routes ou modales `BottomSheet`.
5. **Tests Frontend (`src/__tests__/` ou `*.test.tsx`) :** Ajouter des tests Vitest + React Testing Library couvrant le rendu, les interactions utilisateur clés et le formatage financier.

## Étape 4 : Contrôle Qualité, Non-Régression & Couverture (Obligatoire)
1. Vérifier la compilation TypeScript stricte sur les deux sous-projets depuis la racine :
   `npm run typecheck` (exécute `tsc --noEmit` côté `backend/` et `frontend/`).
2. Exécuter l'intégralité des tests de non-régression et inspecter le rapport de couverture de code (`@vitest/coverage-v8`) depuis la racine :
   `npm run test:coverage`
   *Tous les tests précédents et nouveaux doivent passer à 100 %, sans baisse injustifiée de couverture.*
3. Vérifier si besoin le build complet (`npm run build`) et le démarrage simultané (`npm run dev`), sans laisser de fichiers temporaires inutiles.
4. Mettre à jour [ROADMAP.md](../../../ROADMAP.md) en cochant `[x]` les sous-tâches achevées et vérifiées.
