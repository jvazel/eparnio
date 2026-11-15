# Règles Backend — Eparnio (`backend/`)

## Stack Technique
* **Core :** Node.js, Express, TypeScript (`strict: true`), Mongoose (MongoDB).
* **Validation & Sécurité :** Zod, `jsonwebtoken` (JWT), `bcryptjs`, `helmet`, `cors`, `dotenv`.
* **Tests & Couverture :** Vitest, `@vitest/coverage-v8`, Supertest, `mongodb-memory-server`.

## Architecture en Couches Stricte
Respecter impérativement la séparation suivante dans `src/` :
1. **`routes/` :** Déclaration des endpoints Express et application des middlewares (`auth.middleware.ts`, `validate.middleware.ts`). Aucune logique métier ici.
2. **`controllers/` :** Extraction des données validées, appel aux services, renvoi des statuts HTTP appropriés (`200`, `201`, `400`, `401`, `403`, `404`).
3. **`services/` :** Logique métier pure, calculs du Budget Base Zéro, recalcul du Reste à vivre, gestion des cycles et reconductions.
4. **`models/` :** Schémas Mongoose, typage des documents et définition des index MongoDB.

## Sécurité & Validation Obligatoires
* **Validation Zod systématique :** Chaque route recevant un `body`, des `params` ou une `query` doit passer par `validate.middleware.ts` avec un schéma Zod explicite.
* **Contrôle d'accès par Budget :** Toutes les routes protégées utilisent `auth.middleware.ts` (`req.user`). Avant toute lecture ou modification sur un `Budget`, une `BudgetPeriod`, une `Envelope` ou une `Transaction`, vérifier que `req.user.id` est bien membre (`members.userId`) ou propriétaire (`ownerId`) du `Budget` concerné.

## Cohérence des Calculs Financiers (Invariants MongoDB)
* **Recalcul synchrone des agrégats :**
  * Toute création, modification ou suppression d'une `Envelope` (`income`, `fixed_charge`, `variable_envelope`, `savings`) doit recalculer `BudgetPeriod.summary` (`plannedIncome`, `plannedFixedCharges`, `plannedEnvelopes`, `plannedSavings`, `spentVariables`, `remainingToAllocate`, `remainingToLive`).
  * Toute création ou suppression d'une `Transaction` doit mettre à jour le champ `spentOrPaidAmount` de l'enveloppe associée et recalculer `remainingToLive` (`plannedIncome - plannedFixedCharges - plannedSavings - spentVariables`) sur la `BudgetPeriod`.
* **Lien Épargne :**
  * Si une transaction ou un versement cible une enveloppe liée à un `SavingsGoal` (`linkedGoalId`), mettre à jour `currentAmount` (épargne accumulée).
* **Gestion des erreurs :** Passer toutes les erreurs au middleware central `error.middleware.ts` pour retourner des réponses JSON uniformes.

## Tests Automatisés & Couverture Obligatoires
* **Tests unitaires & d'intégration systématiques :** À chaque nouveau service métier (`zeroBasedBudget`, `remainingToLive`, `periodRollover`, `invite`) ou route REST, écrire les tests Vitest + Supertest (`mongodb-memory-server` pour l'isolation complète) dans `src/__tests__/`.
* **Non-régression & Couverture :** Exécuter `npx vitest run --coverage` (ou `npm run test:coverage` à la racine) après chaque modification afin de garantir 0 régression et contrôler la couverture sur les contrôleurs, services et middlewares.
