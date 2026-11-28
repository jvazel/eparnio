# Roadmap de Développement — Eparnio

> Suivi séquentiel du projet **Eparnio** (développement piloté par l'IA).
> Chaque étape doit être validée techniquement (`npm run typecheck` + `npm run test:coverage` pour garantir aucune régression et vérifier la couverture de code) avant de passer à la suivante.

---

## Étape 1 : Initialisation du Socle Technique (Infrastructure, Backend, Frontend & Tests)
- [x] Créer `docker-compose.yml` pour lancer **MongoDB** en local (`mongodb://localhost:27017/eparnio`), `.gitignore`, `README.md` (guide d'installation et commandes `docker-compose up -d`, `npm run dev`, `npm test`, `npm run test:coverage`) et le `package.json` racine avec `concurrently` exposant **`npm run dev`** (lancement simultané frontend + backend), `npm test`, `npm run test:coverage`, `npm run typecheck` et `npm run build`.
- [x] Initialiser `backend/` : `package.json`, `tsconfig.json`, `vitest.config.ts` (avec `@vitest/coverage-v8`), `.env.example`, connexion Mongoose (`src/config/db.ts`), serveur Express (`src/app.ts`, `src/server.ts`), middlewares de base (`error.middleware.ts`, `validate.middleware.ts`) et route de santé `GET /api/health`.
- [x] Initialiser `frontend/` : Vite + React + TypeScript + Tailwind CSS, configuration Vitest + React Testing Library + `jsdom` + `@vitest/coverage-v8`, proxy `/api` vers `http://localhost:4000`, `vite-plugin-pwa` et manifeste PWA **Eparnio**.
- [x] Créer les briques UI de base (`Card`, `Button`, `RingGauge`, `ProgressBar`, `BottomSheet`, `Badge`, `PillarInfoPopover` pour le clic sur `ⓘ`) et le layout `MobileShell` + `TopHeader` (avatar violet + « Bonjour Prénom » + bouton portefeuille) + `PeriodSelector` (`< Mois Année >`) + `BottomNav` (5 onglets : *Revenus*, *Dépenses*, *Enveloppes*, *Epargne*, *Budget*) + FAB bleu `(+)` en bas à droite.
- [x] **Tests & Couverture :** Écrire les premiers tests (Supertest `GET /api/health` + validation/erreurs côté backend ; tests de rendu des briques UI `RingGauge`, `MobileShell`, `BottomNav` côté frontend) et vérifier `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 2 : Authentification JWT, Multi-Budgets & Onboarding « Budget Base Zéro »
- [x] **Backend :** Modèles `User.model.ts` et `Budget.model.ts` (support `personal` et `shared`, `contributionMode`, `members[]` avec couleur), routes `/api/auth/register`, `/api/auth/login`, `GET / PATCH /api/auth/me` (sauvegarde prénom, avatar emoji, `budgetStartDay`, thème) et `PATCH /api/auth/password` (mise à jour sécurisée du mot de passe avec `bcryptjs`) avec JWT, middleware `auth.middleware.ts`.
- [x] **Backend :** Lors de l'inscription, création automatique d'un premier budget personnel (`Budget Perso`) et endpoints `GET / POST /api/budgets`, `PATCH /api/budgets/:id` (renommer, modifier `budgetStartDay`) et `DELETE /api/budgets/:id` (supprimer un espace secondaire).
- [x] **Frontend :** Écrans **Création de compte (Inscription)** et **Connexion** Mobile-First (`useAuthStore`, intercepteur Axios JWT, routes protégées, option *« Mot de passe oublié / Mettre à jour »* sur l'écran de connexion) et `ProfileSheet` (ouvert au clic sur l'avatar violet du `TopHeader` : édition du profil, mise à jour du mot de passe, jour de paie `budgetStartDay`, thème et déconnexion).
- [x] **Frontend :** Parcours d'Onboarding pédagogique en 3 étapes expliquant le Budget Base Zéro et enregistrant le jour de paie (`budgetStartDay`) via `PATCH /api/auth/me`.
- [x] **Frontend :** Composants `BudgetSwitcherOverlay` (voile sombre avec `✕`, cartes `Espace Budget` empilées/swipables au dégradé violet-rose-cyan `Espace actuel` / `Accéder`, boutons ronds `Partager` et `•••`) et `BudgetSettingsSheet` (ouvert au clic sur `•••` : renommer l'espace, régler son `budgetStartDay`, créer ou supprimer un budget).
- [x] **Tests & Couverture (Non-régression) :** Tests API (Supertest + `mongodb-memory-server`) pour `/api/auth/*` (y compris création de compte `/register`, `PATCH /me` et `PATCH /password`) et `/api/budgets` (CRUD & contrôle d'accès JWT) + tests frontend (Création de compte / Inscription, Connexion, mise à jour du mot de passe depuis `ProfileSheet` et l'écran de connexion, Onboarding, `BudgetSwitcherOverlay`), validés par `npm run typecheck && npm run test:coverage`.

---

## Étape 3 : Onglets « Revenus » & « Dépenses fixes » + Moteur Base Zéro
- [x] **Backend :** Modèles `BudgetPeriod.model.ts` et `Envelope.model.ts` (piliers : `income`, `fixed_charge`, `variable_envelope`, `savings`, avec `memberId` optionnel sur les apports d'un budget commun et champ `order`). Les mensualités de crédits/dettes sont gérées directement comme `fixed_charge`.
- [x] **Backend :** Services `zeroBasedBudget.service.ts` et `remainingToLive.service.ts` calculant automatiquement `remainingToAllocate` (`plannedIncome - plannedFixedCharges - plannedEnvelopes - plannedSavings`, objectif `0 €`) et `remainingToLive` (`plannedIncome - plannedFixedCharges - plannedSavings - spentVariables`).
- [x] **Backend :** Endpoints `/api/budgets/:budgetId/periods/current` et `/by-month` (création/récupération selon `budgetStartDay` avec reconduction automatique des `isRecurring` et de la structure des enveloppes) + CRUD `/api/periods/:periodId/envelopes` (incluant le pointage `isPaid` et le réordonnancement `order`).
- [x] **Frontend — Onglet `Revenus` :** Carte synthèse `DonutSummaryCard` avec switch `€ | %` et légende colorée + liste `Historique des revenus` (`CheckableListCard` avec icône cerclée, pastille `✓` verte/grise, indicateur `🔄`, tap pour éditer/supprimer et mode gestion rapide `⚙️` avec suppression `🗑️` et réorganisation).
- [x] **Frontend — Onglet `Dépenses` (Dépenses fixes) :** Carte synthèse avec `Total`, lien `Tout voir ▶` et jauge circulaire `RingGauge` (« Reste à dépenser » = `remainingToLive`) + liste `Historique des dépenses fixes` pointable en 1 tap (`✓`), éditable/supprimable au tap et gérable en mode `⚙️` (suppression `🗑️` et réorganisation).
- [x] **Frontend — Formulaire de création/édition unifié (`CreationFormModal` / `BottomSheet`) :** Trio d'icônes en tête, grand montant centré avec `Restant à répartir` en direct, cartes blanches (`Nom`, `Date`, `Ajouter chaque mois / récurrente` 100 % gratuit sans restriction Premium, sélecteur `Apparence Icône` emoji, palette des 11 pastilles couleur avec contour noir actif) et bouton bleu `Ajouter` / `Enregistrer` (+ `Supprimer` en édition).
- [x] **Tests & Couverture (Non-régression) :** Tests unitaires et API sur `zeroBasedBudget.service`, `remainingToLive.service`, reconduction `/by-month`, réordonnancement et pointage `isPaid` + tests UI (`Revenus`, `Dépenses`, mode `⚙️`, `CreationFormModal` et calcul live de `Restant à répartir`), validés par `npm run typecheck && npm run test:coverage`.

---

## Étape 4 : Onglet « Enveloppes » (Dépenses variables) & Saisie au Pouce dans les Enveloppes
- [x] **Backend :** Modèle `Transaction.model.ts` (avec `authorId` et `paidByUserId`) et routes `/api/periods/:periodId/transactions` (`GET`, `POST`, `PATCH`, `DELETE`) permettant de créer, modifier ou supprimer une dépense en mettant à jour `spentOrPaidAmount` de l'enveloppe et `remainingToLive` de la période.
- [x] **Frontend — Onglet `Enveloppes` :** Carte synthèse « Reste dans les enveloppes » (`somme des plafonds alloués − somme des dépenses des enveloppes`) avec `RingGauge` bleue + section « Les enveloppes » en **grille 2 colonnes de cartes pastel** (`PastelEnvelopeCard` avec mini anneau de progression autour de l'emoji, `Montant :` et `Restant :`) + création d'enveloppe via le `FAB (+)` bleu.
- [x] **Frontend — Saisie & rééquilibrage au tap sur une enveloppe :** `EnvelopeDetailSheet` (rappel `Montant` / `Restant`, modification du plafond/rééquilibrage ou suppression de l'enveloppe, historique des dépenses avec édition/suppression) et `AddExpenseSheet` reprenant le style épuré (grand montant centré + `Restant dans l'enveloppe` en direct, cartes `Nom`, `Date`, sélecteur « Payé par... » en budget commun, bouton bleu `Ajouter` / `Enregistrer`) avec **pavé numérique tactile intégré (`NumericKeypad`)**.
- [x] **Tests & Couverture (Non-régression) :** Tests API sur `POST/PATCH/DELETE /api/periods/:periodId/transactions` (cohérence `spentOrPaidAmount` et `remainingToLive`) + tests UI (`PastelEnvelopeCard`, `EnvelopeDetailSheet`, `AddExpenseSheet`, `NumericKeypad`), validés par `npm run typecheck && npm run test:coverage`.

---

## Étape 5 : Onglet « Epargne » (Objectifs & Projets)
- [x] **Backend :** Modèle `SavingsGoal.model.ts` avec routes CRUD `/api/budgets/:budgetId/goals`.
- [x] **Backend :** Liaison avec les allocations mensuelles (`linkedGoalId`) et transactions d'épargne pour incrémenter/décrémenter l'épargne cumulée (`currentAmount`), refléter `Epargne du mois` et recalculer `remainingToAllocate` / `remainingToLive`.
- [x] **Frontend — Onglet `Epargne` :** Carte synthèse Donut multicolore (`Total` épargné du mois + légende par objectif) + liste « Historique des épargnes » (`SavingsGoalCard` avec `Objectif`, `Total epargné`, menu `⋮` pour éditer/supprimer l'objectif, barre de progression fine, `Epargne du mois` avec accordéon `⌄` dépliant les versements du mois et bouton rond `+` pastel pour créditer).
- [x] **Tests & Couverture (Non-régression) :** Tests API sur `/api/budgets/:budgetId/goals` et synchronisation `currentAmount` / `remainingToLive` + tests UI (`DonutSummaryCard`, `SavingsGoalCard`, accordéon `⌄`, versement via `+`), validés par `npm run typecheck && npm run test:coverage`.

---

## Étape 6 : Onglet « Budget » (Synthèse Entrées/Sorties, Budget Quotidien, Répartition & Bilan Membre)
- [x] **Backend :** Endpoint `/api/periods/:periodId/analytics` calculant les totaux (`Revenus`, `Dépenses fixes`, `Dépenses variables`, `Epargne`, `Restant` = `remainingToLive`), les jours restants dans le cycle budgétaire et le montant à dépenser par jour, la répartition en `%` (`Fixe`, `Variable`, `Épargne`), l'équilibre Base Zéro (`Reste à attribuer = 0 €`) et le **bilan par membre** (pour les budgets `shared`).
- [x] **Frontend — Onglet `Budget` (sans FAB `+`) :**
  * Carte `CashFlowSummaryCard` (« Entrées et sorties d'argent » avec icônes carrées colorées et ligne `Restant` en gras),
  * Carte `DailyBudgetCard` (« Gestion du budget quotidien » : jours restants en rouge & montant/jour en vert),
  * Carte `AllocationDonutCard` (« Part des dépenses par rapport aux revenus » : Donut Violet/Bleu/Vert + légende `%`),
  * Bandeau Base Zéro (`Reste à attribuer`) et `MemberBreakdownCard` sur les budgets partagés.
- [x] **Tests & Couverture (Non-régression) :** Tests API sur `/api/periods/:periodId/analytics` (calculs quotidiens, `%` Fixe/Variable/Épargne, bilan par membre) + tests UI (`CashFlowSummaryCard`, `DailyBudgetCard`, `AllocationDonutCard`, `MemberBreakdownCard`), validés par `npm run typecheck && npm run test:coverage`.

---

## Étape 7 : Partage Complet (QR Code, Lien, Calculateur 50/50 & Prorata) & Reconduction Mensuelle
- [x] **Backend :** Service `invite.service.ts` et endpoints `POST /api/budgets/:id/invite` (génération/régénération), `POST /api/budgets/join/:inviteCode`, `PATCH /api/budgets/:id/contribution-split` (calculateur 50/50 & prorata) et `DELETE /api/budgets/:id/members/:userId`.
- [x] **Backend :** Service `periodRollover.service.ts` assurant la reconduction automatique à la navigation `< Mois Année >` et l'endpoint `POST /api/budgets/:budgetId/periods/:periodId/rollover`.
- [x] **Frontend :** Écrans/modales `shared-budget/` : `ShareBudgetModal` (déclenchée depuis le bouton Partager de la carte `Espace Budget`, avec les 4 actions `Envoyer par SMS`, `Scanner le QR Code`, `Copier l'URL d'invitation`, `Annuler`), `QrCodeModal`, `MembersList` (rôles, révocation, retrait via le menu `•••`), écran pour rejoindre un budget via code/lien et `ContributionCalculatorSheet` (calculateur 50/50 ou prorata des salaires).
- [x] **Tests & Couverture (Non-régression) :** Tests API sur `invite.service`, `contribution-split` (50/50 & prorata) et `periodRollover.service` + tests UI (`ShareBudgetModal`, `QrCodeModal`, `MembersList`, `ContributionCalculatorSheet`), puis validation finale complète `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 8 : Sécurisation & Durcissement (Données Financières & Protection des Comptes)
- [x] **Infrastructure & Configuration :** Binding MongoDB restreint à `127.0.0.1:27017:27017` dans `docker-compose.yml` ; validation `parseEnvConfig` exigeant un `JWT_SECRET` dédié d'au moins 32 caractères en `production` ; en-têtes Helmet (`strict-origin-when-cross-origin`) et désactivation de `x-powered-by`.
- [x] **Clé de récupération gratuite, E-mail SMTP Gmail, Révocation JWT & Robustesse :**
  * Suppression du reset par simple e-mail : `PATCH /api/auth/password` exige désormais la clé de récupération personnelle (`EPAR-XXXX-XXXX`, stockée hachée avec `bcryptjs` via `recoveryKeyHash` et résumée dans `recoveryKeyHint`), un code à **6 chiffres** envoyé par e-mail (valable 15 min, limité à 5 essais), ou le mot de passe actuel (`currentPassword`).
  * Nouvel endpoint `POST /api/auth/recovery-key` pour régénérer la clé de secours à tout moment et révoquer la précédente, et téléchargement local en 1 clic (`eparnio-cle-recuperation.txt`) dès l'Onboarding et le Profil.
  * Nouvel endpoint `POST /api/auth/password/forgot` et service natif `email.service.ts` (SMTP Gmail gratuit via `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `PASSWORD_RESET_CODE_TTL_MINUTES` dans `.env` / `.env.example`).
  * Complexité renforcée (`8` caractères min., 1 majuscule, 1 minuscule, 1 chiffre) côté API (`strongPasswordSchema`) et frontend (`validateStrongPassword`).
  * Expiration JWT réduite à `24h` et révocation immédiate des sessions précédentes via `tokenVersion` incrémenté lors du changement ou de la réinitialisation du mot de passe.
- [x] **Anti-Brute-Force, Expiration des Invitations & Suppression en Cascade :**
  * Middleware `rateLimit.middleware.ts` (`429 Too Many Requests` + `Retry-After`) : `authRateLimiter` (20 req / 15 min sur `/api/auth/register`, `/login`, `/password`, `/password/forgot`) et `inviteJoinRateLimiter` (15 req / 15 min sur `/api/budgets/join/:inviteCode`).
  * Codes et QR Codes d'invitation valables **24 heures** (`inviteExpiresAt`, HTTP `410 Gone` si expiré, régénération en 1 clic).
  * Suppression en cascade atomique dans `DELETE /api/budgets/:id` (`TransactionModel`, `EnvelopeModel`, `SavingsGoalModel`, `BudgetPeriodModel`).
- [x] **Frontend & UI Sécurisée :** Affichage unique, copie et téléchargement `.txt` de la clé lors de l'Onboarding (`lastRecoveryKey` en mémoire éphémère hors `localStorage`), bouton `Recevoir un code par e-mail (gratuit)` et champ multi-mode (clé, code 6 chiffres ou mot de passe actuel) sur `AuthScreen`, régénération + téléchargement `.txt` dans `ProfileSheet`, badge `Lien et QR Code valables 24 heures` et régénération dans `ShareBudgetModal`.
- [x] **Tests & Couverture (Non-régression) :** Tests Backend (révocation `tokenVersion`, clé de récupération / régénération / `401`, flux SMTP `POST /password/forgot` + `401`/`429`/`410`/`200` + serveur TCP mock `sendSmtpMail`, `parseEnvConfig` prod, rate limiters `429`, code expiré `410`, suppression en cascade) + tests Frontend (`OnboardingWizard`, `AuthScreen`, `ProfileSheet`, `ShareBudgetModal`, `validateStrongPassword`, `downloadRecoveryKeyFile`, `requestPasswordResetCode`, `regenerateRecoveryKey`), validés par `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 9 : Page Dédiée Détail d’une Enveloppe (Remplacement de la popin)

- [x] **Navigation contrôlée par état & En-tête dédié (`EnvelopeDetailPage`) :** Remplacement de la popin `EnvelopeDetailSheet` par une vue plein écran contrôlée par état au clic sur une tuile d’enveloppe (sans `BottomNav`), avec bouton retour `<` en haut à gauche pour revenir à l’onglet Enveloppes, icône + nom coloré centré (`🛒 Courses`) et bouton engrenage `⚙️` en haut à droite.
- [x] **Carte Synthèse & Jauge Circulaire :** Carte centrale avec `RingGauge` affichant au centre la **somme des montants dépensés** dans l’enveloppe et une progression proportionnelle au plafond alloué (couleur de l’enveloppe, ou rouge en dépassement), ainsi que le bloc `Détail` à 2 colonnes (`Objectif` / `Restant`).
- [x] **Historique des dépenses & FAB `+` :** Liste des dépenses de l’enveloppe où **un tap sur une ligne révèle les icônes de modification et de suppression**, avec pastille membre en budget commun + bouton flottant bleu `+` en bas à droite ouvrant `AddExpenseSheet` (pavé numérique au pouce).
- [x] **Réglages de l’enveloppe (`⚙️`) :** Ouverture via le bouton engrenage d’un tiroir/menu (compatible thèmes clair et sombre) proposant **Modifier l’enveloppe**, **Rééquilibrer avec une autre enveloppe** et **Supprimer l’enveloppe**.
- [x] **Thèmes Clair & Sombre, Documentation & Tests :** Support complet des modes clair et sombre, mise à jour de tous les fichiers `.md` (`README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, etc.) et mise à jour des tests associés (`envelopes-transactions.test.tsx`).

---

## Étape 10 : Détails des enveloppes dans l’onglet « Budget »

- [x] **Données & Calculs :** Réutilisation des enveloppes variables de la période active pour calculer en direct `Budget réparti`, `Budget consommé`, `Reste à dépenser`, et la part en `%` de chaque enveloppe sur le total consommé.
- [x] **Frontend — Carte `EnvelopeBreakdownCard` (« Détails des enveloppes ») :**
  * Affichage des 2 indicateurs en tête de carte : **Budget réparti** et **Budget consommé**, suivis de la mention centrée **« Il reste X € à dépenser »**.
  * Graphique **Donut** coloré (part de budget consommé par enveloppe, avec la couleur de chaque enveloppe), légende en pourcentage (`Nom : XX,X %`) et `Total : 100%`, ainsi qu'un **état vide** (`Aucune dépense variable ce mois-ci`) lorsqu'aucune dépense n'a été saisie.
  * Intégration dans `MonthlyInsights.tsx` juste en dessous de `AllocationDonutCard`, avec support complet des **modes clair et sombre**.
- [x] **Tests & Documentation :** Ajout des tests unitaires dans `analytics.test.tsx`, validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md`.

---

## Étape 11 : Installation PWA sur Mobile (« Installer l'application »)

- [x] **Détection & Hook `usePwaInstall` :**
  * Interception de l'événement `beforeinstallprompt` (Android / Chrome / Edge) pour déclencher l'installation native en 1 tap.
  * Détection d'iOS Safari (`!standalone`) pour afficher les instructions guidées (*« Partager → Sur l'écran d'accueil »*).
  * Masquage automatique dès que l'application est déjà installée (`display-mode: standalone`) ou si l'utilisateur ferme le bandeau (préférence mémorisée).
- [x] **Frontend — Bandeau / Bouton d'installation :**
  * Composant `PwaInstallBanner` compatible avec les **modes clair et sombre**, intégré dans `App.tsx`.
- [x] **Tests & Documentation :** Tests unitaires dans `pwaInstall.test.tsx`, validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md`.

---

## Étape 12 : Connexion Biométrique Mobile (WebAuthn / Passkeys — Face ID & Empreinte)

- [x] **Backend (`User.model.ts`, `webauthn.controller.ts` & `/api/auth/webauthn/*`) :**
  * Stockage des credentials WebAuthn (`credentialId`, `publicKey`, `counter`, `transports`) sur `User`.
  * Endpoints d'enregistrement (`register/options`, `register/verify`, `DELETE /credentials` protégés par JWT) et de connexion (`login/options`, `login/verify` avec challenge temporaire et génération du JWT) via `@simplewebauthn/server`.
- [x] **Frontend (`ProfileSheet` & `AuthScreen`) :**
  * Activation / suppression de la biométrie depuis `ProfileSheet` (« Activer Face ID / Empreinte » / « Désactiver la biométrie »).
  * Bouton « Se connecter avec Face ID / Empreinte » sur `AuthScreen` (affiché si l'appareil supporte WebAuthn) via `@simplewebauthn/browser`.
- [x] **Tests & Documentation :** Tests API (`backend/src/__tests__/webauthn.test.ts`) + tests UI (`frontend/src/__tests__/webauthn.test.tsx`), validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md`.

---

## Étape 13 : Anticipation des dépenses annuelles (*Sinking Funds*)

- [x] **Backend (`SavingsGoal.model.ts` & `goal.controller.ts`) :**
  * Champ optionnel `deadline` déjà supporté sur `SavingsGoal` et les routes `POST/PATCH /api/budgets/:budgetId/goals`.
- [x] **Frontend (`sinkingFund.ts`, `GoalDetailSheet` & `SavingsGoalsList`) :**
  * Champ optionnel **« Échéance »** dans `GoalFormSheet` avec aperçu en direct de la mensualité à provisionner (`Mensualité conseillée : X € / mois`).
  * Affichage du badge `Conseillé : X €/mois` sur `SavingsGoalCard` (`Objectif atteint` en vert si `currentAmount >= targetAmount`, ou `Échéance dépassée — Reste X €` en orange si l'échéance est passée), compatible **modes clair et sombre**.
- [x] **Tests & Documentation :** Tests unitaires dans `savings.test.tsx`, validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md`.

---

## Étape 14 : Rappels & Notifications PWA

- [x] **Notifications PWA locales configurables (`useReminders.ts` & `ProfileSheet`) :**
  * Option dans `ProfileSheet` pour activer/désactiver les rappels locaux de saisie (fréquence : quotidien ou hebdomadaire) via l'API `Notification` et persistance `localStorage`.
- [x] **Tests & Documentation :** Tests unitaires dans `reminders.test.tsx`, validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md` et `ARCHITECTURE.md`.

---

## Étape 15 : Mode Hors-Ligne avec file de synchronisation (PWA)

- [x] **File d'attente hors-ligne (`offlineQueue.ts`, `useOfflineSync.ts` & `OfflineBanner.tsx`) :**
  * Détection de l'état réseau (`navigator.onLine` + événements `online`/`offline`) avec bandeau discret « Mode hors-ligne — X action(s) en attente ».
  * Mise en file locale (`localStorage`) des actions effectuées sans réseau et synchronisation automatique dès le retour de la connexion.
- [x] **Tests & Documentation :** Tests unitaires dans `offlineSync.test.tsx`, validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md` et `ARCHITECTURE.md`.

---

## Étape 16 : Tendances multi-mois (onglet « Budget »)

- [x] **Backend (`GET /api/budgets/:budgetId/trends?months=6`) :**
  * Endpoint paramétrable par le frontend (`months` validé par Zod, `1` à `36`, `6` par défaut) retournant l'historique mensuel (`Revenus`, `Dépenses fixes`, `Dépenses variables`, `Épargne`).
- [x] **Frontend (`TrendsCard.tsx` dans `MonthlyInsights.tsx`) :**
  * Graphique en barres léger avec filtre (`Tout` / `Variables` / `Épargne`), compatible **modes clair et sombre**.
- [x] **Tests & Documentation :** Tests UI dans `analytics.test.tsx`, validation `npm run typecheck && npm run test:coverage && npm run build` et mise à jour de `ROADMAP.md` et `ARCHITECTURE.md`.

---

## Étape 17 : Audit & Résolution des vulnérabilités npm (Backend & Frontend)

- [x] **Baseline & Audit ciblé production (`npm audit --omit=dev`) :**
  * **Frontend (`--omit=dev`) :** `0` vulnérabilité en production.
  * **Backend (`--omit=dev`) :** `1` seule vulnérabilité (`zod <4.6.6`, nécessitant une migration majeure vers `zod@4.6.7`, conservée en v3 pour stabilité ; les 10 autres concernent uniquement les `devDependencies` `vitest`/`vite`/`esbuild` qui ne tournent pas en production).
- [x] **Validation de non-régression & Documentation :** `npm run typecheck`, `npm run test:coverage --prefix frontend` (12 fichiers, 67 tests) et `npm run build` validés, [ROADMAP.md](./ROADMAP.md) mis à jour.

---

## Étape 18 : Migration Zod v3 → v4 (`4.6.7`) & Zéro faille de production

- [x] **Migration vers `zod@4.6.7` (`backend/`) :**
  * Mise à jour de `zod` vers `^4.6.7` dans `backend/package.json`.
  * Vérification `npm audit --omit=dev --prefix backend` et `frontend` à **`0` vulnérabilité**.
- [x] **Validation complète de non-régression & Documentation :** `npm run typecheck`, tous les tests backend (8 fichiers, 35 tests passés) et frontend (12 fichiers, 67 tests passés) validés, [ROADMAP.md](./ROADMAP.md) mis à jour.

---

## Étape 19 : Rollover des Enveloppes Variables (Report Positif & Négatif entre Mois)

- [x] **Modèle de données (`Envelope.model.ts`) :**
  * Ajouter `rolloverEnabled: boolean` (défaut `false`, activable par enveloppe pour les *Sinking Funds* / enveloppes d'anticipation), `rolloverMode: 'positive_only' | 'both'` (défaut `'positive_only'`), `rolloverAmount: number` (défaut `0`, positif ou négatif) et `previousEnvelopeId?: ObjectId` (chaînage fiable entre mois même en cas de renommage).
  * Conserver `allocatedAmount` strictement pour la dotation du mois en cours (ne jamais y fusionner le report).
- [x] **Moteur de calcul & Règles Base Zéro (`zeroBasedBudget.service.ts`, `remainingToLive.service.ts`, `periodRollover.service.ts`) :**
  * Calculer le disponible d'une enveloppe : `allocatedAmount + rolloverAmount`, et le restant : `(allocatedAmount + rolloverAmount) - spentOrPaidAmount`.
  * Exclure `rolloverAmount` du calcul `remainingToAllocate` (Reste à répartir) pour éviter tout double comptage avec les revenus du mois précédent, tout en l'incluant dans le « Reste dans les enveloppes ».
  * Lors de la reconduction (`periodRollover.service.ts`), calculer `rolloverAmount` du mois $M+1$ selon `rolloverMode` (`positive_only` : `Math.max(0, restant_M)` ; `both` : `restant_M`).
  * **Propagation dynamique :** si le mois $M+1$ existe déjà et qu'une dépense ou dotation est modifiée en mois $M$, recalculer et propager automatiquement `rolloverAmount` vers $M+1$ (et les mois suivants chaînés via `previousEnvelopeId`) sans jamais altérer l'historique du mois $M-1$.
- [x] **Frontend & UX Mobile-First (`CreationFormModal`, `PastelEnvelopeCard`, `EnvelopeDetailPage`) :**
  * Ajouter le toggle `Reporter le solde au mois suivant` (+ choix *Positif uniquement* / *Positif et négatif*) dans la création/édition d'enveloppe.
  * Afficher un badge discret sur `PastelEnvelopeCard` lorsque `rolloverAmount !== 0` (`+40 € reportés` en vert doux ou `-15 € reportés` en rouge doux).
  * Afficher la décomposition claire dans `EnvelopeDetailPage` (`Budget du mois` + `Report mois préc.` − `Dépensé` = `Restant`).
- [x] **Tests & Documentation :**
  * Tests unitaires et API sur le calcul de `rolloverAmount` (`positive_only` vs `both`), la non-régression du `remainingToAllocate` (Base Zéro), le renommage avec `previousEnvelopeId` et la propagation dynamique $M \rightarrow M+1$.
  * Tests UI (`PastelEnvelopeCard`, `EnvelopeDetailPage`, `CreationFormModal`) et validation `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 20 : Filtres & Tri rapide sur les Dépenses Fixes et Variables

- [x] **Composant réutilisable (`ListFilterBar.tsx`) :** Barre de recherche instantanée avec bouton `✕`, pills de tri, pills de filtre optionnelles et sous-total dynamique avec bouton `Réinitialiser`.
- [x] **Dépenses fixes (`FixedChargesList.tsx`) :** Recherche par nom, tri (`Ordre`, `Montant ↓`, `Montant ↑`) en complément du filtre `Toutes / À venir / Payées`, et sous-total filtré.
- [x] **Dépenses variables (`EnvelopeDetailPage.tsx`) :** Recherche par libellé, tri (`Plus récentes`, `Plus anciennes`, `Montant ↓`, `Montant ↑`), filtre par membre (`Payé par…`) en budget partagé, et sous-total filtré.
- [x] **Validation :** `npm run typecheck`, `npm test --prefix frontend` (12 fichiers, 67 tests) et `npm run build` validés.

---

## Étape 21 : Projection de Fin de Mois & Rythme de Dépense (Burn Rate)

- [x] **Calcul du rythme de dépense (`analytics.controller.ts` / helper dédié côté frontend) :**
  * Calculer `elapsedDays = Math.max(1, jours écoulés depuis startDate jusqu'à aujourd'hui)` et `burnRate = spentVariables / elapsedDays`.
  * Calculer `daysUntilNegative = remainingToLive / burnRate`, la date estimée de passage en négatif (`today + Math.floor(daysUntilNegative)`), et le solde projeté en fin de cycle (`remainingToLive - burnRate * remainingDays`).
- [x] **Frontend (`PaceProjectionCard.tsx` dans l'onglet `Budget`, sous `DailyBudgetCard`) :**
  * 🟢 **Rythme maîtrisé** (projection $\ge 0$) : *« À ce rythme (`X €/jour`), tu termineras le cycle avec `+Y €` d'avance. »*
  * 🟠 **Alerte de dépassement** (projection $< 0$ et `remainingToLive >= 0`) : *« À l'allure actuelle (`X €/jour`), tu passeras en négatif à partir du **JJ mois** (dans **N jours**). »*
  * 🔴 **Déjà en négatif** (`remainingToLive < 0`) : *« Ton reste à vivre est déjà dépassé de `-Y €` sur ce cycle. »*
  * ⚪ **Début de cycle / aucune dépense** (`spentVariables === 0`) : message neutre (*« Pas encore assez de dépenses pour estimer ton rythme »*).
  * Compatible **modes clair et sombre**.
- [x] **Tests & Documentation :**
  * Tests unitaires sur le calcul de projection (rythme maîtrisé, passage en négatif avec date exacte, déjà en négatif, 0 € dépensé) et tests UI de `PaceProjectionCard` dans `paceProjection.test.tsx`.
  * Mise à jour de `ROADMAP.md` et `ARCHITECTURE.md`, puis validation `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 22 : Indicateurs Avancés de Pilotage (Onglet « Budget »)

- [x] **Avancement du mois vs consommation des enveloppes (`MonthVsEnvelopesCard.tsx`) :**
  * Comparer `% du mois écoulé` (`elapsedDays / totalDays`) vs `% des enveloppes variables consommées` (`spentVariables / plannedEnvelopes`) avec double barre de progression visuelle.
- [x] **Taux d'épargne du mois & Matelas de sécurité (`SavingsHealthCard.tsx`) :**
  * Calculer le **taux d'épargne** (`plannedSavings / plannedIncome * 100`) avec repère visuel (`< 10 %`, `10–20 %`, `> 20 %`).
  * Calculer le **matelas de sécurité** en mois de charges fixes en combinant les comptes patrimoniaux de catégorie **liquidités (`cash`)** et les objectifs d'épargne non liés à un compte liquide (`computeEmergencyFundAmount` sans double comptage, ex. *« 3,2 mois de charges fixes (incl. liquidités) »*).
- [x] **Top enveloppes en tension (`EnvelopesAtRiskCard.tsx`) :**
  * Identifier et afficher les 2 à 3 enveloppes dont le taux de consommation dépasse le plus l'avancement du mois.
- [x] **Tests & Documentation :**
  * Tests unitaires sur les formules et tests UI des 3 cartes (modes clair et sombre) dans `advancedIndicators.test.tsx`.
  * Mise à jour de `ROADMAP.md`, `ARCHITECTURE.md` et `README.md`, puis validation `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 23 : Améliorations Budget Commun (Équilibrage, Apports 1-Tap, Charges Fixes & Activité)

- [x] **« Qui doit à qui » & Régularisation (`MemberBreakdownCard.tsx`, `analytics.controller.ts`) :**
  * Calculer et afficher la phrase de régularisation entre membres (*« X doit Y € à Z pour équilibrer le mois »*) avec bouton **« Marquer comme réglé »**.
- [x] **Génération en 1 tap des apports depuis le calculateur (`ContributionCalculatorSheet.tsx`) :**
  * Permettre d'appliquer directement la répartition 50/50 ou Prorata en créant/mettant à jour les lignes d'apports (`income`) de chaque membre sur la période active.
- [x] **« Payé par… » sur les dépenses fixes (`CreationFormModal.tsx`, `analytics.controller.ts`) :**
  * Associer un membre payeur sur les `fixed_charge` en budget commun et l'intégrer dans `memberBreakdown`.
- [x] **Fil d'activité récente du foyer (`SharedActivityCard.tsx`) :**
  * Afficher les dernières actions du foyer (*ajout de dépense, versement, pointage*) dans l'onglet `Budget`.
- [x] **Tests & Documentation :**
  * Tests UI sur l'équilibrage (`computeSettlementSuggestion`, `MemberBreakdownCard`) et `SharedActivityCard` dans `sharedSettlementAndActivity.test.tsx`.
  * Mise à jour de `ROADMAP.md` et `ARCHITECTURE.md`, puis validation `npm test --prefix frontend && npm run build`.

---

## Étape 24 : Correctif Rollover en saisie live, Remboursements & Notes dans les Enveloppes *(Quick win)*

- [x] **Correctif `AddExpenseSheet.tsx` :** Inclure `envelope.rolloverAmount ?? 0` dans le calcul live `projectedRemainingInEnvelope` afin d'aligner l'aperçu en saisie avec `EnvelopeDetailPage.tsx`.
- [x] **Backend (`Transaction.model.ts`, `transaction.controller.ts`, `remainingToLive.service.ts`, `analytics.controller.ts`) :**
  * Exploiter `type: 'income'` sur une enveloppe variable comme **Remboursement / Avoir** venant créditer le disponible de l'enveloppe (`spentOrPaidAmount` recalculé proprement, y compris en crédit net `< 0`) et refléter cet impact dans `memberBreakdown` (budget partagé) sans gonfler les revenus planifiés du mois.
  * Exposer et valider le champ optionnel `notes` (300 car. max) en création et modification de transaction (avec possibilité d'effacement).
- [x] **Frontend (`AddExpenseSheet.tsx`, `TransactionHistory.tsx`, `EnvelopeDetailPage.tsx`) :**
  * Ajouter un sélecteur segmenté **Dépense / Remboursement** en tête d'`AddExpenseSheet` (avec calcul live du restant adapté) et un champ optionnel **Note**.
  * Afficher distinctement les remboursements (`+ X €` en vert émeraude, badge *Remboursement*) et les notes dans `TransactionHistory`, en **modes clair et sombre**, avec recherche par note et sous-total net dans `EnvelopeDetailPage.tsx`.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests API ajoutés (`transaction.test.ts`, `analytics.test.ts`) et tests UI ajoutés (`envelopes-transactions.test.tsx`).
  * **Non-régression & Documentation :** Suites complètes validées (`npm run typecheck`, `npm run test:coverage` : 9 fichiers / 40 tests backend, 15 fichiers / 79 tests frontend, `npm run build`), `ROADMAP.md` et `ARCHITECTURE.md` mis à jour.

---

## Étape 25 : Retraits & Utilisation des Cagnottes d'Épargne *(Quick win)*

- [x] **Backend (`SavingsGoal.model.ts`, `goal.controller.ts`, `goal.routes.ts`, `remainingToLive.service.ts`) :**
  * Ajouter le suivi des retraits sur `SavingsGoal` (sous-documents `withdrawals[]` : `_id`, `amount`, `label`, `date`, `memberId?`, `notes?`).
  * Créer les endpoints `POST /api/budgets/:budgetId/goals/:id/withdrawals`, `PATCH /api/budgets/:budgetId/goals/:id/withdrawals/:withdrawalId` et `DELETE /api/budgets/:budgetId/goals/:id/withdrawals/:withdrawalId`.
  * Mettre à jour `recalculateSavingsGoalCurrentAmount` (`initialAmount + totalContributions - totalWithdrawals`, borné à `>= 0`) sans altérer `plannedSavings`, `remainingToAllocate` ni `remainingToLive` de la période active.
- [x] **Frontend (`GoalDetailSheet.tsx`, `SavingsGoalsList.tsx`, `goal.service.ts`) :**
  * Ajouter une action **« Utiliser / Retirer »** (`−`) sur `SavingsGoalCard` (à côté du `+` de versement) ouvrant `GoalWithdrawalSheet` (pavé numérique tactile, aperçu live du nouveau solde de la cagnotte, libellé, date et membre en budget commun).
  * Afficher les retraits (`− X €` en ambre/rouge) dans l'accordéon `⌄` de la carte aux côtés des versements, avec édition et suppression, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests API ajoutés (`goal.test.ts` : CRUD retraits, recalcul `currentAmount`, non-impact `plannedSavings`/`remainingToLive`, 400/403/404) et tests UI ajoutés (`savings.test.tsx`, `services.test.ts` : `GoalWithdrawalSheet`, accordéon `− X €` + badge `Retrait`, modes clair et sombre, intégration `App`).
  * **Non-régression & Documentation :** Suites complètes validées (`npm run typecheck`, `npm run test:coverage` : 9 fichiers / 42 tests backend, 15 fichiers / 82 tests frontend, `npm run build`), `ROADMAP.md` et `ARCHITECTURE.md` mis à jour.

---

## Étape 26 : Restructuration de l'Onglet « Budget » en Sous-Onglets & Garde-fou Base Zéro *(Quick win)*

- [x] **Frontend — Sous-onglets de `MonthlyInsights.tsx` :**
  * Regrouper les cartes de l'onglet `Budget` derrière une barre de sous-onglets pilules pour conserver une lecture aérée sur mobile :
    * **Essentiel** (`CashFlowSummaryCard`, `DailyBudgetCard`, `ZeroBasedBanner`, `AllocationDonutCard`),
    * **Pilotage** (`PaceProjectionCard`, `MonthVsEnvelopesCard`, `EnvelopesAtRiskCard`, `SavingsHealthCard`, `EnvelopeBreakdownCard`),
    * **Tendances** (`TrendsCard`),
    * **Foyer** *(affiché uniquement en budget partagé : `MemberBreakdownCard`, `SharedActivityCard` et accès au calculateur 50/50 & Prorata)*.
  * Mémoriser le sous-onglet actif durant la session (`sessionStorage` via `BUDGET_SUBTAB_STORAGE_KEY`) avec navigation clavier WAI-ARIA, repli automatique de `foyer` vers `essentiel` en budget personnel, état vide sur `Tendances` et support complet des **modes clair et sombre**.
- [x] **Frontend — Garde-fou & Auto-équilibrage Base Zéro (`ZeroBasedBanner.tsx`) :**
  * Lorsque `remainingToAllocate > 0`, proposer un raccourci **« Auto-équilibrer à 0 € »** permettant d'affecter le reliquat en 1 tap vers une enveloppe variable ou un objectif d'épargne (ou d'ouvrir les onglets cibles si aucune cible n'existe).
  * Lorsque `remainingToAllocate < 0`, afficher une alerte explicite de sur-allocation avec puce `Sur-allocation`, consigne dédiée, boutons d'ajustement rapide (`onNavigateToTab`) et classes complètes en modes clair et sombre.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests UI & intégration dans `frontend/src/__tests__/analytics.test.tsx` (navigation par sous-onglets, clavier, persistance `sessionStorage`, auto-équilibrage `0 €` vers enveloppe/objectif, alerte de sur-allocation et modes clair/sombre ; non-régression confirmée sur `paceProjection.test.tsx`, `advancedIndicators.test.tsx` et `sharedSettlementAndActivity.test.tsx`).
  * **Non-régression & Documentation :** `npm run typecheck` OK, `npm run test:coverage --prefix backend` (`9/9` fichiers, `42/42` tests, `88.67%` Stmts/Lines), `npm run test:coverage --prefix frontend` (`15/15` fichiers, `86/86` tests, `89.66%` Stmts/Lines, dont `94.49%` sur `MonthlyInsights.tsx` et `99.62%` sur `ZeroBasedBanner.tsx`), `npm run build` OK ; `ROADMAP.md` et `ARCHITECTURE.md` mis à jour.

---

## Étape 27 : Récurrences Avancées (Fréquence, Date de Fin / Mensualités) & Échéancier *(Différenciation)*

- [x] **Backend (`Envelope.model.ts`, `envelope.controller.ts`, `periodRollover.service.ts`) :**
  * Ajouter les champs optionnels `recurrenceFrequency: 'monthly' | 'quarterly' | 'semiannual' | 'yearly'` (défaut `'monthly'`), `recurrenceEndDate?: Date` et `recurrenceRemainingCount?: number` (adapté aux crédits et paiements en 3x/4x).
  * Adapter `isRolloverCandidate` et `cloneRolloverEnvelopes` dans `periodRollover.service.ts` pour respecter l'intervalle de fréquence (y compris en navigation mois par mois), décrémenter `recurrenceRemainingCount` (`computeNextRecurrenceRemainingCount`) lors de la reconduction et stopper automatiquement la duplication à échéance.
- [x] **Frontend (`CreationFormModal.tsx`, `FixedChargesList.tsx`, `CheckableListCard.tsx`, `recurrence.ts`) :**
  * Étendre la carte « Ajouter chaque mois » avec le choix de la **fréquence** (`Mensuel`, `Trimestriel`, `Semestriel`, `Annuel`) et d'une **limite optionnelle** (*Nombre de mensualités restantes* ou *Date de fin*), et afficher un badge discret sur chaque carte fixe (ex. `Trimestriel`, `3 mensualités restantes`, `Jusqu’au …`).
  * Ajouter un mode d'affichage **Échéancier chronologique** dans `FixedChargesList.tsx` regroupant les prélèvements à venir par date du cycle (avec sous-totaux par date, option *Inclure payées* et pointage `✓` direct), en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests unitaires et API dans `backend/src/__tests__/period-envelope.test.ts` (`computeMonthsDifference`, `computeNextRecurrenceRemainingCount`, `isRolloverCandidate`, reconduction mensuelle/trimestrielle/semestrielle/annuelle, paiements 3x, `recurrenceEndDate`, `PATCH` `isRecurring: false`) et tests UI dans `frontend/src/__tests__/income-fixed.test.tsx` (`CreationFormModal`, badges `CheckableListCard`, vue `Échéancier` de `FixedChargesList`, modes clair et sombre).
  * **Non-régression & Documentation :** `npm run typecheck` OK, `npm run test:coverage --prefix backend` (`9/9` fichiers, `44/44` tests, `88.84%` Stmts/Lines, dont `95.67%` sur `periodRollover.service.ts` et `100%` sur `Envelope.model.ts`), `npm run test:coverage --prefix frontend` (`15/15` fichiers, `88/88` tests, `90.06%` Stmts/Lines, dont `94.70%` sur `FixedChargesList.tsx` et `96.96%` sur `recurrence.ts`), `npm run build` OK ; `ROADMAP.md` et `ARCHITECTURE.md` mis à jour.

---

## Étape 28 : Rituel Guidé de Clôture de Fin de Mois *(Différenciation)*

- [x] **Backend (`BudgetPeriod.model.ts`, `period.controller.ts`, `periodRollover.service.ts`) :**
  * Ajouter le champ optionnel `closedAt?: Date` sur `BudgetPeriod` et créer l'endpoint `POST /api/budgets/:budgetId/periods/:periodId/close`.
  * Permettre en une opération cohérente (`closePeriodAndRollover`) d'appliquer la décision choisie pour chaque enveloppe excédentaire (`rollover_next_month`, `transfer_to_goal` avec `goalId`, ou `reset_zero`), de reconduire/ajuster les postes récurrents du mois suivant et de marquer la période clôturée (`409` en cas de double clôture).
- [x] **Frontend (`MonthClosingWizard.tsx`, `MonthlyInsights.tsx` / `PeriodSelector.tsx`) :**
  * Afficher une entrée **« Clôturer le mois »** (et un état `Mois clôturé` + badge `Clôturé` dans `PeriodSelector`) ouvrant un assistant Mobile-First en 3 étapes :
    1. **Bilan du cycle** (enveloppes tenues, économies nettes, taux d'épargne),
    2. **Affectation des surplus** (choix en 1 tap par enveloppe positive : *Reporter*, *Épargner* vers un objectif ou *Remettre à 0*),
    3. **Aperçu du mois suivant** (ajustement rapide des montants reconduits et inclusion/exclusion avant ouverture du cycle suivant).
  * Support complet des **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests API dans `backend/src/__tests__/monthClosing.test.ts` (`rollover_next_month`, `transfer_to_goal`, `reset_zero`, cohérence `SavingsGoal.currentAmount`, `rolloverAmount` sur $M+1$, ajustements/exclusions $M+1$, erreurs `409` / `400` / `404` / `403`) et tests UI dans `frontend/src/__tests__/monthClosing.test.tsx` (parcours 3 étapes `MonthClosingWizard`, badge `PeriodSelector`, carte `MonthlyInsights`, modes clair et sombre).
  * **Non-régression & Documentation :** `npm run typecheck` OK, `npm run test:coverage --prefix backend` (`10/10` fichiers, `46/46` tests, `88.98%` Stmts/Lines, dont `100%` sur `BudgetPeriod.model.ts` et `93.16%` sur `periodRollover.service.ts`), `npm run test:coverage --prefix frontend` (`16/16` fichiers, `91/91` tests, `89.61%` Stmts/Lines, dont `87.84%` sur `MonthClosingWizard.tsx` et `95%` sur `MonthlyInsights.tsx`), `npm run build` OK ; `ROADMAP.md` et `ARCHITECTURE.md` mis à jour.

---

## Étape 29 : Export des Données (CSV / PDF) & Sauvegarde JSON *(Différenciation)*

- [x] **Backend (`export.controller.ts`, `routes/index.ts`) :**
  * Créer `GET /api/budgets/:budgetId/export/csv` (filtrable par `periodId` ou `year`, UTF-8 avec BOM `\uFEFF` compatible Excel et protection anti-injection de formules CSV sur les cellules commençant par `=`, `+`, `-`, `@`, `\t`, `\r` + en-tête `X-Content-Type-Options: nosniff`).
  * Créer `GET /api/budgets/:budgetId/export/json` renvoyant une sauvegarde structurée complète de l'espace budgétaire (`schemaVersion`, métadonnées, périodes, enveloppes, transactions, objectifs et retraits), protégée par JWT et `assertBudgetAccess`.
- [x] **Frontend (`BudgetSettingsSheet.tsx`, `MonthlyInsights.tsx`, `ExportActionsCard.tsx`, `exportReport.ts`) :**
  * Ajouter les actions **« Exporter en CSV (Excel) »**, **« Télécharger le bilan PDF »** (générateur PDF 1.4 multi-pages 100 % côté client sans service tiers ni sink DOM dangereux) et **« Sauvegarde complète (.json) »**, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests unitaires et API dans `backend/src/__tests__/export.test.ts` (`escapeCsvCell`, `sanitizeDownloadSlug`, UTF-8 BOM, filtrage `periodId`/`year`, anti-injection CSV, complétude JSON, contrôles `401`/`403`/`404`) et tests unitaires/UI dans `frontend/src/__tests__/exportReport.test.tsx` (`generatePeriodPdfBytes` multi-pages, déclencheurs CSV/PDF/JSON dans `MonthlyInsights` et `BudgetSettingsSheet`, modes clair et sombre).
  * **Non-régression & Documentation :** `npm run typecheck` OK, `npm run test:coverage --prefix backend` (`11/11` fichiers, `49/49` tests, `89.35%` Stmts/Lines, dont `94.53%` sur `export.controller.ts`), `npm run test:coverage --prefix frontend` (`17/17` fichiers, `93/93` tests, `89.81%` Stmts/Lines, dont `98.12%` sur `exportReport.ts` et `97.63%` sur `ExportActionsCard.tsx`), `npm run build` OK ; `ROADMAP.md` et `ARCHITECTURE.md` mis à jour.

---

## Étape 30 : Import Manuel de Relevé CSV (Boîte de Tri) & Réconciliation de Solde *(Différenciation)*

- [x] **Backend (`transaction.controller.ts`, `csvImport.service.ts`, `transaction.routes.ts`) :**
  * Créer `POST /api/periods/:periodId/transactions/import` pour importer un lot de transactions validées avec détection de doublons (date + montant + libellé normalisé) et recalcul global des enveloppes et de `remainingToLive`.
  * Exposer un calcul de **réconciliation de solde** comparant un solde bancaire saisi au solde théorique de la période afin d'identifier l'écart et créer si besoin une ligne d'ajustement propre.
- [x] **Frontend (`CsvImportSheet.tsx`, `BalanceReconcileSheet.tsx`, `csvParser.ts`) :**
  * Implémenter un parseur CSV/OFX **100 % côté client** (zéro connexion bancaire, support des formats bancaires français `;`/`,` et virgule décimale).
  * Construire la **Boîte de tri rapide** : affichage des opérations non encore enregistrées, suggestion automatique d'enveloppe selon les libellés passés, affectation ou exclusion en 1 tap puis validation du lot.
  * Ajouter le tiroir **« Réconcilier mon solde bancaire »** dans l'onglet `Budget` (saisie du solde réel de la banque, affichage immédiat de l'écart et correction rapide), en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Ajouter les tests unitaires sur `csvParser` et la déduplication, les tests API sur `POST /transactions/import` et la réconciliation de solde (recalcul `spentOrPaidAmount` et `remainingToLive`), et les tests UI (`CsvImportSheet`, boîte de tri, `BalanceReconcileSheet`, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter l'ensemble des suites existantes backend + frontend avec couverture (`npm run typecheck && npm run test:coverage && npm run build`), vérifier zéro régression et mettre à jour `ROADMAP.md` et `ARCHITECTURE.md`.

---

## Étape 31 : Saisie Ultra-Rapide (« Quick-Add »), Calculatrice Intégrée & Onglet par Défaut *(Rétention quotidienne)*

- [x] **Mini-calculatrice dans le pavé numérique (`NumericKeypad.tsx`, `AmountHeroField`) :**
  * Ajouter une rangée compacte d'opérateurs (`+`, `−`, `×`, `÷`, `=`) au-dessus de la grille `0-9` avec un évaluateur arithmétique local sécurisé (sans `eval`, arrondi à 2 décimales et gestion propre des divisions par zéro / nombres négatifs).
  * Afficher l'expression en cours en discret au-dessus ou sous le montant Hero dans tous les tiroirs utilisant `NumericKeypad`, en **modes clair et sombre**.
- [x] **Point d'entrée FAB `+` & Tiroir `QuickAddExpenseSheet.tsx` (`QuickAddButton.tsx`, `App.tsx`) :**
  * Sur l'onglet `Enveloppes`, si au moins 1 enveloppe variable existe, le tap sur le FAB bleu `+` déploie un mini-menu sobre à 2 actions juste au-dessus du bouton : **Ajouter une dépense** (action principale) et **Nouvelle enveloppe** (si 0 enveloppe, ouverture directe de la création d'enveloppe).
  * Créer `QuickAddExpenseSheet` (ou étendre `AddExpenseSheet`) avec un **sélecteur d'enveloppe en chips pastel horizontales** affichant le restant live de l'enveloppe choisie (incluant `rolloverAmount`), pavé calculatrice, libellé, date et payeur en budget commun.
- [x] **Préférence d'onglet d'ouverture (`User.model.ts`, `auth.controller.ts`, `ProfileSheet.tsx`, `App.tsx`) :**
  * Ajouter `defaultTab?: 'revenus' | 'depenses' | 'enveloppes' | 'epargne' | 'budget'` dans `user.preferences` (défaut `'depenses'`) modifiable dans `ProfileSheet` pour permettre d'ouvrir directement Eparnio sur `Enveloppes` au quotidien.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Ajouter les tests unitaires de l'évaluateur arithmétique sécurisé (`NumericKeypad` : `+`, `−`, `×`, `÷`, division par zéro, arrondis), les tests API `PATCH /api/auth/me` (`defaultTab`) et les tests UI (`QuickAddExpenseSheet`, mini-menu FAB 2 actions, `ProfileSheet`, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter l'ensemble des suites existantes backend + frontend avec couverture (`npm run typecheck && npm run test:coverage && npm run build`), vérifier zéro régression et mettre à jour `ROADMAP.md` et `ARCHITECTURE.md`.

---

## Étape 32 : Auto-Complétion Intelligente & Favoris de Dépenses 1-Tap *(Rétention quotidienne)*

- [x] **Backend — Suggestions d'historique & Modèles Favoris (`Budget.model.ts`, `budget.controller.ts`, `transaction.controller.ts`, `routes/`) :**
  * Créer `GET /api/budgets/:budgetId/transactions/suggestions` renvoyant les libellés les plus fréquents/récents du budget associés à leur dernier nom d'enveloppe utilisé (et dernier montant indicatif).
  * Ajouter un sous-tableau `quickTemplates[]` sur `Budget.model.ts` (`_id`, `label`, `envelopeName` normalisé pour survivre automatiquement à la reconduction mensuelle, `defaultAmount?`, `order`) avec endpoints CRUD `POST / DELETE /api/budgets/:budgetId/quick-templates` (synchronisés sur tous les appareils et partagés en budget commun).
- [x] **Frontend (`QuickAddExpenseSheet.tsx`, `AddExpenseSheet.tsx`, `budget.service.ts`) :**
  * Afficher des chips d'auto-complétion en temps réel lors de la saisie du libellé ; un tap sur une suggestion remplit le libellé et **pré-sélectionne automatiquement l'enveloppe correspondante** (si présente sur la période active).
  * Afficher une rangée horizontale de **chips Favoris** en tête du tiroir : 1 tap pré-remplit instantanément l'enveloppe, le libellé et le montant par défaut s'il existe (sans enregistrement silencieux, afin de permettre un ajustement immédiat avant validation).
  * Ajouter un bouton discret `☆ Enregistrer en favori` dans le tiroir de saisie ainsi que la suppression d'un favori, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Ajouter les tests API (`GET /transactions/suggestions`, CRUD `quickTemplates`, résolution multi-mois par `envelopeName` après rollover) et les tests UI (chips d'auto-complétion libellé → enveloppe, pré-remplissage favori 1-tap, ajout/suppression de favori, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter l'ensemble des suites existantes backend + frontend avec couverture (`npm run typecheck && npm run test:coverage && npm run build`), vérifier zéro régression et mettre à jour `ROADMAP.md` et `ARCHITECTURE.md`.

---

## Étape 33 : Fractionnement de Ticket (*Split Transaction* Multi-Enveloppes) *(Rétention quotidienne)*

- [x] **Backend (`Transaction.model.ts`, `transaction.controller.ts`, `transaction.routes.ts`) :**
  * Ajouter le champ optionnel `splitGroupId?: string` (indexé) sur `Transaction.model.ts` et l'exposer dans `toTransactionResponse`.
  * Créer `POST /api/periods/:periodId/transactions/split` créant en une passe les N transactions liées (au moins 2 enveloppes distinctes de la période, même `splitGroupId`, même `date` et `paidByUserId`) et recalculant toutes les enveloppes impactées, la propagation `rolloverAmount` et le résumé de période.
  * Étendre `DELETE /api/periods/:periodId/transactions/:id` avec un paramètre optionnel `?scope=group` permettant de supprimer tout le ticket (`splitGroupId`) d'un coup ; lors d'une suppression partielle (`scope=single`), si une seule transaction subsiste dans le `splitGroupId`, nettoyer automatiquement son `splitGroupId`.
- [x] **Frontend (`QuickAddExpenseSheet.tsx`, `AddExpenseSheet.tsx`, `TransactionHistory.tsx`) :**
  * Ajouter une bascule discrète **« ✂️ Répartir sur plusieurs enveloppes »** dans le tiroir de saisie : le montant Hero représente le **total du ticket**, suivi des lignes `[Enveloppe] [Montant]` avec calcul live du **reste à répartir (`0,00 €`)** et bouton 1-tap pour compléter la dernière part.
  * Afficher un badge discret **`✂️ Ticket partagé (N parts)`** dans `TransactionHistory` et un bandeau d'info en édition d'une part (l'édition modifie uniquement la part sélectionnée).
  * À la suppression d'une part liée à un `splitGroupId`, proposer explicitement **« Supprimer cette part uniquement »** ou **« Supprimer tout le ticket (N parts) »**, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Ajouter les tests API (`POST /transactions/split`, recalcul multi-enveloppes + propagation `rolloverAmount`, `DELETE ?scope=group` vs `single` avec nettoyage automatique du `splitGroupId` orphelin) et les tests UI (`AddExpenseSheet`/`QuickAddExpenseSheet` mode fractionné, reste à répartir `0,00 €`, badge `✂️ Ticket partagé` dans `TransactionHistory`, choix de suppression part/ticket, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter l'ensemble des suites existantes backend + frontend avec couverture (`npm run typecheck && npm run test:coverage && npm run build`), vérifier zéro régression et mettre à jour `ROADMAP.md` et `ARCHITECTURE.md`.


---

## Étape 34 : Détection des Dépenses Atypiques & Alertes Préventives *(Pilotage intelligent)*

- [x] **Backend (`anomalyDetection.service.ts`, `transaction.controller.ts`, `analytics.controller.ts`) :**
  * Créer un service `anomalyDetection.service.ts` analysant l'historique des 3 à 6 derniers mois du budget selon 4 signaux déterministes : pic statistique par rapport à la médiane/moyenne de l'enveloppe (minimum 5 transactions d'historique), impact brutal (`> 50 %` du restant de l'enveloppe ou passage en négatif), nouveau libellé à montant élevé, et dérive de fréquence/vélocité.
  * Exposer `GET /api/periods/:periodId/transactions/anomalies` (et/ou intégrer le résumé dans `GET /api/periods/:periodId/analytics`) avec score de sévérité (`info` | `warning`) et message explicatif, ainsi qu'une option pour ignorer/acquitter une alerte sur une transaction (`isAnomalyDismissed?: boolean`).
- [x] **Frontend (`QuickAddExpenseSheet.tsx`, `AddExpenseSheet.tsx`, `AnomalousExpensesCard.tsx`, `MonthlyInsights.tsx`) :**
  * Afficher un bandeau d'avertissement non bloquant en temps réel lors de la saisie si le montant dépasse le seuil habituel de l'enveloppe.
  * Ajouter une carte **« Dépenses atypiques du mois »** dans l'onglet `Budget` listant les opérations détectées avec leur explication et un bouton **« C'est normal »** pour masquer l'alerte, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Ajouter les tests unitaires sur `anomalyDetection.service.ts` (médiane, seuil, impact plafond, nouveau libellé), les tests API (`GET /transactions/anomalies`, acquittement d'alerte) et les tests UI (bandeau préventif en saisie, `AnomalousExpensesCard`, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter l'ensemble des suites existantes backend + frontend avec couverture (`npm run typecheck && npm run test:coverage && npm run build`), vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 35 : Recherche Globale Multi-Mois *(Quotidien & Historique)*

- [x] **Backend (`search.service.ts`, `search.controller.ts`, `budget.routes.ts`) :**
  * Créer l'endpoint `GET /api/budgets/:budgetId/search?q=...&type=...&limit=...` protégé par JWT et vérification d'appartenance au budget.
  * Interroger en parallèle `TransactionModel` (`label`, `notes`, `amount`) et `EnvelopeModel` (`name`, `allocatedAmount` pour `income` et `fixed_charge`), enrichis avec les informations de période (`month`, `year`) et d'enveloppe parente, triés par date décroissante.
  * Ajouter les index MongoDB composés `{ budgetId: 1, date: -1 }` si nécessaires pour garantir des temps de réponse rapides sur l'historique multi-mois.
- [x] **Frontend (`GlobalSearchModal.tsx`, `TopHeader.tsx`) :**
  * Ajouter un bouton loupe (`🔍`) dans `TopHeader` ouvrant la modale/vue plein écran `GlobalSearchModal` avec champ auto-focus, debounce (250–300 ms) et gestion des 5 dernières recherches en `localStorage` par budget.
  * Proposer des filtres rapides (`Tout`, `Dépenses variables`, `Dépenses fixes`, `Revenus`, `Notes`) et grouper les résultats par mois/année avec pastille membre en budget commun.
  * Au tap sur un résultat, basculer automatiquement le `PeriodSelector` sur le mois correspondant et ouvrir l'enveloppe (`EnvelopeDetailPage`) ou l'onglet concerné, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests API sur `GET /api/budgets/:budgetId/search` (recherche par mot-clé, note, montant, filtre par type, contrôle d'accès JWT) + tests UI (`GlobalSearchModal`, filtres rapides, navigation vers la période/enveloppe).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 36 : Tags Transversaux & Suivi Visuel par Étiquette *(Croisement Multi-Enveloppes)*

- [x] **Backend (`Transaction.model.ts`, `transaction.controller.ts`, `search.service.ts`, `analytics.controller.ts`) :**
  * Ajouter un champ optionnel `tags: string[]` sur `TransactionModel` (normalisé en minuscules, sans espaces, maximum 5 tags par transaction) avec un index MongoDB `{ budgetId: 1, tags: 1 }`.
  * Mettre à jour `POST`/`PATCH /api/periods/:periodId/transactions` pour enregistrer et valider les `tags`, et étendre `GET /api/budgets/:id/search` pour filtrer par tag (`tag=...` ou recherche `#tag`).
  * Créer l'endpoint `GET /api/budgets/:id/tags/summary` (et `GET /api/budgets/:id/tags/:tag/analytics`) retournant le classement des tags (total dépensé, nombre d'opérations), la répartition par enveloppe et l'évolution mois par mois pour un tag donné.
- [x] **Frontend (`AddExpenseSheet.tsx`, `QuickAddExpenseSheet.tsx`, `TagAnalyticsCard.tsx`, `TagDetailModal.tsx`, `GlobalSearchModal.tsx`) :**
  * Ajouter un sélecteur/champ **« Tags (optionnel) »** lors de la saisie d'une dépense avec auto-complétion en 1 tap des tags existants du budget.
  * Afficher les tags en pilules discrètes (`#vacances-été`) sur les lignes de transaction et permettre de filtrer par tag dans `GlobalSearchModal`.
  * Ajouter une carte **« Suivi par tags »** dans l'onglet `Budget` (barres horizontales des tags actifs) ouvrant une vue détail `TagDetailModal` avec **Donut de répartition par enveloppe**, **évolution mensuelle en barres** et liste des opérations associées, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests :** Tests API sur la création/mise à jour de `tags`, le filtre par tag dans `/search` et les agrégations `/tags/summary` + tests UI (saisie de tags, `TagAnalyticsCard`, `TagDetailModal` en modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 37 : Vue Calendrier & Trésorerie Prévisionnelle *(Visibilité Temporelle & Échéances Futures)*

- [x] **Backend (`calendar.service.ts`, `analytics.controller.ts`, `periodRollover.service.ts`) :**
  * Créer un service `calendar.service.ts` et l'endpoint `GET /api/periods/:periodId/calendar` (protégé par JWT et vérification d'appartenance au budget) agrégeant sur la fenêtre `[BudgetPeriod.startDate, BudgetPeriod.endDate]` (avec normalisation stricte des clés `YYYY-MM-DD` pour éviter tout décalage UTC/local) :
    1. Les **opérations passées / réalisées** : `TransactionModel` (`date`, `amount`, `label`, `envelopeId`, `paidByUserId`) et `EnvelopeModel` (`income`, `fixed_charge`, `savings`) pointées `isPaid: true`.
    2. Les **échéances à venir et en retard sur le cycle** : `EnvelopeModel` (`income`, `fixed_charge`, `savings`) avec `isPaid: false` positionnées sur leur `date` prévue (avec gestion des fins de mois courtes : 29/30/31, repli propre sur `startDate` si `date` est absente, et distinction des échéances en retard `date < aujourd'hui`).
    3. La **courbe journalière de trésorerie projetée** : solde cumulé jour par jour (réel jusqu'à la date du jour, puis prévisionnel en intégrant les revenus, charges fixes, versements d'épargne restants et échéances en retard imputées dès aujourd'hui jusqu'à `endDate`, avec option de lissage du reste des enveloppes variables).
    4. Un résumé des **échéances périodiques futures hors cycle** (`recurrenceFrequency`: `quarterly`, `semiannual`, `yearly`) sur les 3 prochains mois pour anticiper les gros débits.
  * Vérifier et garantir que `periodRollover.service.ts` conserve bien le jour d'échéance (`date`) lors de la reconduction automatique d'un mois à l'autre.
- [x] **Frontend (`BudgetCalendarView.tsx`, `CalendarGrid.tsx`, `CashFlowProjectionChart.tsx`, `CalendarDaySheet.tsx`, `App.tsx`) :**
  * Ajouter un switcher segmenté **`Synthèse | Calendrier`** en haut de l'onglet **`Budget`** (conservant la `BottomNav` à 5 onglets et réutilisant le `PeriodSelector` `< Mois Année >` pour naviguer dans le passé comme dans le futur).
  * Ajouter des **filtres rapides en pilules** (`Tout`, `Revenus`, `Fixes`, `Variables`, et par membre en budget commun).
  * **`CalendarGrid.tsx` :** Grille calendrier calée sur le cycle budgétaire (`budgetStartDay`), affichant des pastilles colorées par pilier (🟢 Revenu, 🟣 Dépense fixe, 🔵 Dépense variable) — **pleines** pour le réalisé (`isPaid: true` ou `TransactionItem`), **en contour pointillé** pour l'à-venir (`isPaid: false`), **en contour orange/rouge** pour les échéances en retard — avec indicateur compact du solde net du jour et mise en évidence du jour actuel.
  * **`CalendarDaySheet.tsx` :** Au tap sur un jour, ouverture d'un `BottomSheet` affichant la date au format `JJ/MM/YYYY` et listant les opérations du jour (passées, en retard et à venir) avec possibilité de pointer `✓` une charge fixe ou un revenu directement en 1 tap (avec invalidation des caches TanStack Query `calendar` + `period`), pastille membre en budget commun, et bouton rapide **« + Ajouter une dépense ce jour »**.
  * **`CashFlowProjectionChart.tsx` :** Graphique **Recharts** affichant la courbe de solde projeté sur le cycle (dates affichées au format `JJ/MM/YYYY`, ligne pleine jusqu'à aujourd'hui, ligne pointillée jusqu'à `endDate`, seuil `0 €` matérialisé pour repérer immédiatement tout risque de creux de trésorerie, et toggle optionnel **« Inclure le budget quotidien moyen »**).
  * Afficher un bandeau compact **« Prochaines échéances périodiques »** (trimestrielles / annuelles) et supporter intégralement les **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `calendar.service.ts` (agrégation réalisé vs à venir, calcul de la courbe de trésorerie cumulée, gestion des jours 29/30/31, projection des échéances `quarterly`/`yearly`) et tests API Supertest sur `GET /api/periods/:periodId/calendar` (contrôle d'accès JWT, cohérence des montants).
  * **Nouveaux tests Frontend :** Tests de rendu et d'interaction sur `BudgetCalendarView` (bascule `Synthèse | Calendrier` dans `Budget`), `CalendarGrid` (distinction visuelle passé/à venir), `CalendarDaySheet` (sélection d'un jour et pointage `✓` en 1 tap), `CashFlowProjectionChart` et vérification des modes clair et sombre.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 38 : Rappels & Notifications Push Intelligentes PWA *(Rétention & Anticipation)*

- [x] **Infrastructure & Configuration (VAPID & Service Worker) :**
  * Ajouter `web-push` (et `@types/web-push`) ainsi que `node-cron` (ou planificateur léger) dans `backend/package.json`.
  * Ajouter les variables d'environnement `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` dans `backend/.env.example` et `parseEnvConfig`.
  * Mettre à jour la configuration `vite-plugin-pwa` / Service Worker personnalisé (`sw.ts`) côté `frontend/` pour écouter les événements `push` et `notificationclick` (ouverture directe de l'application sur l'onglet concerné).
- [x] **Backend (`PushSubscription.model.ts`, `pushNotification.service.ts`, `notification.controller.ts`) :**
  * Créer le modèle `PushSubscriptionModel` (`userId`, `endpoint`, `keys: { p256dh, auth }`, `userAgent`, `createdAt`) et étendre `User.model.ts` avec `notificationPreferences` :
    * `dailyReminderEnabled` (`boolean`) + `dailyReminderHour` (ex. `20:00`),
    * `upcomingDueAlertEnabled` (`boolean`, alerte **J-2** avant une `fixed_charge` avec `isPaid: false`),
    * `envelopeThresholdAlertEnabled` (`boolean`, alerte à `>= 80 %` ou dépassement de plafond d'une enveloppe variable).
  * Exposer les routes protégées par JWT : `GET /api/notifications/vapid-public-key`, `POST /api/notifications/subscribe`, `DELETE /api/notifications/unsubscribe`, `PATCH /api/notifications/preferences` et `POST /api/notifications/test` (envoi d'une notification de test).
  * Créer `pushNotification.service.ts` et le job planifié qui vérifie quotidiennement les rappels de saisie, les échéances fixes à J-2 et les seuils d'enveloppes, en nettoyant automatiquement les abonnements expirés (`410 Gone` / `404`).
- [x] **Frontend (`notification.service.ts`, `ProfileSheet.tsx`) :**
  * Créer `notification.service.ts` gérant la demande de permission navigateur (`Notification.requestPermission()`), l'abonnement `pushManager.subscribe` avec la clé publique VAPID et la synchronisation des préférences.
  * Ajouter dans `ProfileSheet.tsx` une section **« Notifications & Rappels »** avec :
    * État de la permission navigateur (accordée, refusée, non supportée),
    * 3 interrupteurs indépendants (Rappel quotidien de saisie + sélecteur d'heure, Alerte échéances J-2, Alerte seuil d'enveloppe),
    * Bouton **« Envoyer une notification test »**, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `pushNotification.service.ts` (filtrage des échéances J-2, détection seuil 80%/100%, nettoyage des abonnements `410 Gone` avec mock `web-push`) + tests API Supertest sur `/api/notifications/*` (subscribe, unsubscribe, preferences, contrôle d'accès JWT).
  * **Nouveaux tests Frontend :** Tests de rendu et d'interaction sur la section Notifications de `ProfileSheet` (bascule des 3 interrupteurs, gestion du refus de permission, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.

---

## Étape 39 : Simulateur « Et si… ? » *(Impact d'un Achat, Abonnement ou Projet)*

- [x] **Frontend — Moteur de Simulation Éphémère (`whatIfSimulator.ts`, `WhatIfSimulatorSheet.tsx`) :**
  * Créer un module pur `whatIfSimulator.ts` (sans écriture en base) calculant en temps réel l'impact d'une opération hypothétique sur les données de la période active :
    1. **Type de simulation :** `Achat ponctuel` (dépense variable), `Nouvelle charge récurrente` (dépense fixe mensuelle), ou `Paiement en plusieurs fois` (montant divisé sur `N` mensualités, ex. 3x, 4x, 12x).
    2. **Indicateurs Avant / Après :** impact immédiat sur le **Reste à vivre** (`remainingToLive`), le **Budget quotidien** (`Y €/jour`), le **Reste à attribuer** (Base Zéro) et, si la vue Calendrier (Étape 37) est active, la **courbe de trésorerie projetée** sur les prochains mois.
    3. **Indicateur de faisabilité :** badge visuel clair (🟢 *Compatible avec votre budget*, 🟠 *Budget serré*, 🔴 *Risque de dépassement / découvert*).
  * Créer `WhatIfSimulatorSheet.tsx` (accessible depuis un bouton **`Simuler un achat / projet`** dans l'onglet **`Budget`** et depuis la vue **Calendrier**) équipé du `NumericKeypad`, du sélecteur de type, de la date/durée et d'un bouton d'action **`Enregistrer réellement`** :
    * Si l'utilisateur clique sur **`Enregistrer réellement`**, la simulation est convertie en vraie transaction (`POST /api/periods/:periodId/transactions`) ou en vraie charge fixe (`POST /api/periods/:periodId/envelopes`) avec invalidation des caches TanStack Query.
  * Supporter intégralement les **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Frontend :** Tests unitaires sur `whatIfSimulator.ts` (achat ponctuel, charge mensuelle, paiement en Nx, calcul Avant/Après du Reste à vivre et du budget quotidien, seuils de faisabilité) + tests UI sur `WhatIfSimulatorSheet` (saisie au `NumericKeypad`, bascule de mode, conversion via « Enregistrer réellement », modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 40 : Bilan Annuel « Eparnio Wrapped » *(Rétrospective & Sélecteur d'Année)*

- [x] **Backend (`annualWrapped.service.ts`, `analytics.controller.ts`, `budget.routes.ts`) :**
  * Créer un service `annualWrapped.service.ts` et l'endpoint `GET /api/budgets/:budgetId/wrapped?year=YYYY` (protégé par JWT et vérification d'appartenance au budget ; `year` par défaut = année en cours).
  * Retourner la liste des années disponibles (`availableYears: number[]` déduites des `BudgetPeriod` du budget) pour alimenter le sélecteur d'année côté frontend.
  * Agréger sur l'année demandée :
    1. **Vue macro :** `totalIncome`, `totalFixedCharges`, `totalVariableSpent`, `totalSaved` et **taux d'épargne annuel (%)**.
    2. **Faits marquants :** mois le plus économe (meilleur `remainingToLive`), **Top 3 des enveloppes** les plus dépensées, enveloppe la mieux maîtrisée (respect du plafond) et **score Base Zéro** (nombre de mois à l'équilibre `remainingToAllocate === 0`).
    3. **Tags & Partage :** Top tags de l'année (si utilisés) et bilan annuel comparatif par membre (si budget `shared`).
- [x] **Frontend (`WrappedModal.tsx`, `WrappedCarousel.tsx`, `App.tsx`) :**
  * Ajouter un point d'entrée **`✨ Bilan annuel`** dans l'onglet **`Budget`** (et/ou `ProfileSheet`) ouvrant `WrappedModal.tsx` en plein écran.
  * **Sélecteur d'année :** permettre à l'utilisateur de **choisir son année** librement parmi `availableYears` (pilules ou flèches `< 2025 | 2026 >` en haut de la modale), avec rechargement dynamique des données et état vide pédagogique si l'année sélectionnée ne contient aucune période.
  * **Carrousel « Stories » (5 slides) :** navigation par tap gauche/droite ou swipe horizontal avec barre de progression en haut et dégradés signature Eparnio :
    1. *L'année en un coup d'œil* (Revenus vs Dépenses vs Épargne),
    2. *Votre épargne* (total épargné + objectif le plus avancé),
    3. *Vos enveloppes phares* (Top 3 + graphique Recharts),
    4. *Vos records* (meilleur mois + score Base Zéro),
    5. *Carte récapitulative finale* (compatible **modes clair et sombre**).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `annualWrapped.service.ts` (calculs annuels, `availableYears`, meilleur mois, top 3 enveloppes, score Base Zéro, bilan membre en budget partagé) + tests API Supertest sur `GET /api/budgets/:budgetId/wrapped?year=...` (contrôle d'accès JWT, changement d'année, année vide).
  * **Nouveaux tests Frontend :** Tests de rendu et d'interaction sur `WrappedModal` / `WrappedCarousel` (changement d'année, navigation entre les 5 slides, état vide, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 41 : Détecteur d'Écarts & Hausses d'Abonnements *(Inflation Cachée)*

- [x] **Backend (`fixedChargeVariance.service.ts`, `envelope.controller.ts`, `analytics.controller.ts`) :**
  * Créer un service `fixedChargeVariance.service.ts` comparant chaque `EnvelopeModel` (`fixed_charge` et `income`) de la période active avec son prédécesseur via `previousEnvelopeId` (ou rapprochement par `name` normalisé sur la période `N-1`).
  * Calculer `previousAmount`, `deltaAmount` (`allocatedAmount - previousAmount`) et `deltaPercent` dès que `Math.abs(deltaAmount) >= 0.01`, en distinguant les hausses (`> 0`) des baisses (`< 0`).
  * Exposer ces métriques dans la réponse de `GET /api/periods/:periodId/envelopes` (champ optionnel `variance?: { previousAmount: number; deltaAmount: number; deltaPercent: number }`) et dans `GET /api/periods/:periodId/analytics` (résumé global `fixedChargesVarianceSummary`).
- [x] **Frontend (`FixedChargesList.tsx`, `CreationFormModal.tsx`, `MonthlyInsights.tsx`) :**
  * **`FixedChargesList.tsx` :** Afficher une pilule discrète sur les lignes concernées : **`↗ +X €`** (ambre/rouge doux) en cas de hausse, **`↘ -X €`** (émeraude doux) en cas de baisse.
  * **`MonthlyInsights.tsx` (onglet `Budget`) :** Afficher une carte compacte **« Évolution des charges fixes »** (uniquement si au moins un écart existe sur le mois) résumant le delta net du mois et la liste des abonnements/charges ayant varié.
  * **`CreationFormModal.tsx` :** En mode édition d'une charge fixe ou d'un revenu, afficher un rappel discret *« Mois précédent : X € »* sous le montant.
  * Supporter intégralement les **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `fixedChargeVariance.service.ts` (hausse, baisse, absence de `previousEnvelopeId`, seuil `0.01 €`) et tests API Supertest sur `GET /envelopes` et `GET /analytics`.
  * **Nouveaux tests Frontend :** Tests de rendu sur `FixedChargesList` (pilules `↗` / `↘`), `MonthlyInsights` (carte d'évolution) et `CreationFormModal` (rappel mois précédent), en modes clair et sombre.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 42 : Assistant d'Équilibrage Base Zéro en 1 Tap *(Rééquilibrage Guidé)*

- [x] **Backend (`zeroBasedAutoBalance.service.ts`, `period.controller.ts`, `period.routes.ts`) :**
  * Créer un service `zeroBasedAutoBalance.service.ts` calculant une proposition d'équilibrage pour atteindre `remainingToAllocate === 0` :
    * **Si surplus (`remainingToAllocate > 0`) :** proposer d'affecter le surplus vers l'objectif d'épargne actif prioritaire (ou l'enveloppe `savings` / `variable_envelope` sélectionnée).
    * **Si déficit (`remainingToAllocate < 0`) :** ne jamais modifier les `fixed_charge` ni descendre sous `spentOrPaidAmount` ; calculer la marge disponible (`allocatedAmount - spentOrPaidAmount`) de chaque `variable_envelope` et proposer de réduire en priorité celle(s) ayant la plus grande marge (ou l'épargne planifiée en dernier recours).
  * Exposer `GET /api/periods/:periodId/auto-balance/suggestion` (retourne la suggestion calculée + les cibles alternatives possibles) et `POST /api/periods/:periodId/auto-balance/apply` (applique atomiquement l'ajustement choisi et recalcule `remainingToAllocate` et `remainingToLive`).
- [x] **Frontend (`ZeroBasedBanner.tsx`, `AutoBalanceSheet.tsx`, `App.tsx`) :**
  * **`ZeroBasedBanner.tsx` :** Dès que `remainingToAllocate !== 0`, afficher un bouton **`Équilibrer en 1 tap`**.
  * **`AutoBalanceSheet.tsx` :** Ouvrir un `BottomSheet` affichant l'écart actuel, la suggestion recommandée (ex. *« Ajouter +120,00 € à Épargne de précaution »* ou *« Réduire Courses de 85,00 € »*), un sélecteur rapide pour choisir une autre enveloppe cible si souhaité, et un bouton **`Confirmer l'équilibrage`** ramenant le budget à `0,00 €`, en **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `zeroBasedAutoBalance.service.ts` (surplus vers épargne, déficit sur enveloppe avec marge, protection `spentOrPaidAmount`, exclusion des `fixed_charge`) + tests API Supertest sur `GET /auto-balance/suggestion` et `POST /auto-balance/apply`.
  * **Nouveaux tests Frontend :** Tests de rendu et d'interaction sur `ZeroBasedBanner` (affichage conditionnel du bouton) et `AutoBalanceSheet` (changement de cible, confirmation en 1 tap, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 43 : Patrimoine Net & Suivi Actifs/Passifs *(Comptes Physiques & Projets Liés)*

- [x] **Backend (`AssetAccount.model.ts`, `SavingsGoal.model.ts`, `netWorth.service.ts`, `netWorth.controller.ts`, `budget.routes.ts`) :**
  * Créer le modèle `AssetAccountModel` (`budgetId`, `name`, `category`: `'cash' | 'investment' | 'real_estate' | 'crypto' | 'liability'`, `icon`, `color`, `currentBalance`, `history: [{ date: Date, balance: number }]`).
  * Ajouter un champ optionnel `assetAccountId?: Types.ObjectId` sur `SavingsGoalModel` (relation `N → 1` : plusieurs projets virtuels comme *Vacances Italie* ou *Matelas de sécurité* peuvent pointer vers un même compte physique comme *Livret A*).
  * Synchroniser automatiquement `AssetAccount.currentBalance` (et son `history`) lors des versements et retraits sur un `SavingsGoal` lié, tout en conservant la possibilité d'ajuster manuellement le solde (ex. intérêts annuels).
  * Créer `netWorth.service.ts` et exposer les routes protégées par JWT et vérification d'appartenance au budget :
    * `GET /api/budgets/:budgetId/net-worth` (retourne `totalAssets`, `totalLiabilities`, `netWorth`, répartition par catégorie, courbe historique et liste des comptes avec projets liés),
    * `POST /api/budgets/:budgetId/assets`, `PATCH /api/budgets/:budgetId/assets/:assetId` (mise à jour rapide du solde), `DELETE /api/budgets/:budgetId/assets/:assetId`.
- [x] **Frontend (`netWorth.service.ts`, `BudgetPatrimoineView.tsx`, `AssetAccountSheet.tsx`, `GoalFormModal.tsx`, `App.tsx`) :**
  * Étendre le switcher segmenté de l'onglet **`Budget`** en **`Synthèse | Calendrier | Patrimoine`**.
  * **`BudgetPatrimoineView.tsx` :** Carte Hero **« Patrimoine Net »** (`Actifs − Passifs = X €`) avec **Donut de répartition** par classe d'actifs, **courbe d'évolution Recharts** et liste des comptes (avec badge des projets d'épargne rattachés et bouton rapide **« Mettre à jour »** via `NumericKeypad`).
  * **`GoalFormModal.tsx` :** Ajouter un sélecteur optionnel **« Compte de placement (optionnel) »** (*ex. Livret A*) pour lier un projet d'épargne à un compte patrimonial.
  * Supporter intégralement les **modes clair et sombre**.
- [ ] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `netWorth.service.ts` (calcul `Actifs − Passifs`, relation `N → 1` avec `SavingsGoal`, mise à jour d'historique) + tests API Supertest sur `/api/budgets/:budgetId/net-worth` et `/assets`.
  * **Nouveaux tests Frontend :** Tests de rendu et d'interaction sur `BudgetPatrimoineView` (affichage patrimoine net, mise à jour de solde, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 44 : Opérations Patrimoniales, Historique & Transferts *(Comptes, Épargne & Budget)*

- [x] **Backend (`AssetAccount.model.ts`, `netWorth.service.ts`, `netWorth.controller.ts`, `budget.routes.ts`) :**
  * Ajouter `operations[]` sur `AssetAccountModel` (`date`, `type`: `'add' | 'withdraw' | 'set' | 'transfer_in' | 'transfer_out'`, `amount`, `label`, `balanceAfter`, `counterpartyType`: `'external' | 'asset' | 'savings_goal' | 'budget_period'`, `counterpartyId`, `counterpartyName`).
  * Créer `recordAssetOperation` et exposer `POST /api/budgets/:budgetId/assets/:assetId/operations` gérant :
    * `external` : ajout/retrait/ajustement simple avec libellé,
    * `asset` : transfert compte ↔ compte (débit source, crédit destination, patrimoine net inchangé),
    * `savings_goal` : transfert épargne ↔ patrimoine (retrait/versement sur `SavingsGoal` + recalcul),
    * `budget_period` : transfert Restant à répartir ↔ patrimoine (création enveloppe `savings` ou `income` + recalcul `recalculatePeriodSummary`).
- [x] **Frontend (`netWorth.service.ts`, `BudgetPatrimoineView.tsx`, `App.tsx`) :**
  * Dans le tiroir d'un compte patrimonial, ajouter le champ **Libellé**, le sélecteur **Source / Destination** (*Externe*, *Autre compte*, *Objectif d'épargne*, *Budget du mois*) et la liste **Historique des opérations** (`DD/MM/YYYY`, libellé, montant, contrepartie, solde après).
  * Invalider les caches TanStack Query (`['net-worth']`, `['goals']`, `['period']`, `['envelopes']`, `['analytics']`) après opération.
- [ ] **Tests & Documentation :**
  * Tests Backend sur `POST /assets/:assetId/operations` (`asset ↔ asset`, `savings_goal ↔ asset`, `budget_period ↔ asset`).
  * Vérification `npm run typecheck` et mise à jour de `ROADMAP.md`.


---

## Étape 45 : Harmonisation UX des Sélecteurs & Listes Déroulantes *(Design Mobile-First)*

- [x] **Audit préalable (Obligatoire avant toute modification) :**
  * Recenser et lister tous les éléments `<select>` natifs ou listes déroulantes non travaillées dans `frontend/src/` (ex. sélecteur *Placé sur le compte* dans `GoalDetailSheet.tsx`, sélecteurs dans `BudgetPatrimoineView.tsx`, `WhatIfSimulatorSheet.tsx`, etc.).
- [x] **Refonte UI (`SelectPickerSheet` / Pilules tactiles) :**
  * Remplacer chaque `<select>` natif recensé par un composant tactile cohérent avec le Design System Eparnio (pilules cliquables `rounded-full` pour les listes courtes, ou `BottomSheet` de sélection avec icône, libellé et solde/détail pour les listes longues), en **modes clair et sombre**.
- [x] **Tests & Vérifications :**
  * Vérifier `npm run typecheck`, la non-régression des tests UI existants et mettre à jour `ROADMAP.md`.


---

## Étape 46 : Mode « Essentiel » vs Mode « Avancé » dans l'onglet Budget *(Maîtrise de la Charge Cognitive)*

- [x] **Backend (`User.model.ts`, `auth.controller.ts`, `auth.service.ts`) :**
  * Ajouter une préférence utilisateur `preferences.budgetViewMode` (`'essential' | 'advanced'`, valeur par défaut `'essential'`) sur `UserModel` afin que tout nouvel utilisateur démarre avec une vue épurée et que son choix soit persisté multi-appareils.
  * Exposer la mise à jour de `budgetViewMode` via `PATCH /api/auth/me` (ou route de préférences existante) et retourner la préférence dans `GET /api/auth/me`.
- [x] **Frontend (`App.tsx`, `BudgetSettingsSheet.tsx` / `ProfileSheet.tsx`, `frontend/src/features/analytics/`) :**
  * **Sélecteur de mode (`Essentiel | Avancé`) :** Ajouter un switch pilule discret en haut de la vue `Synthèse` de l'onglet **Budget** (et/ou dans les préférences utilisateur) permettant de basculer instantanément entre :
    * **Mode Essentiel (par défaut) :** N'afficher que les **3 cartes clés** de référence (*Entrées et sorties d'argent* `CashFlowSummaryCard`, *Gestion du budget quotidien* `DailyBudgetCard`, *Part des dépenses par rapport aux revenus* `AllocationDonut`) + le bandeau d'équilibre Base Zéro (`ZeroBasedBanner`).
    * **Mode Avancé :** Afficher en plus les cartes d'analyse approfondie (*Dépenses atypiques* `AnomalousExpensesCard`, *Enveloppes à risque* `EnvelopesAtRiskCard`, *Projection de rythme* `PaceProjectionCard`, *Tendances* `TrendsCard`, *Écarts d'abonnements* `FixedChargesVarianceCard`, *Tags* `TagAnalyticsCard`, *Simulateur What-If*, *Export*, etc.) dans une section dédiée ou un tiroir dépliable **« Analyses avancées »** avec compteur de cartes/alertes actives.
  * **Persistance hybride :** Synchroniser immédiatement en local (`localStorage` / Zustand) pour un basculement sans latence, puis persister côté serveur via l'API.
  * Supporter intégralement les **modes clair et sombre**.
- [ ] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests sur `UserModel` (valeur par défaut `'essential'`) et `PATCH /api/auth/me` (validation `'essential' | 'advanced'`).
  * **Nouveaux tests Frontend :** Tests de rendu sur l'onglet Budget vérifiant qu'en mode `essential` seules les 3 cartes clés + bandeau Base Zéro sont visibles, et qu'en mode `advanced` (ou après clic sur *Analyses avancées*) les cartes analytiques s'affichent, en modes clair et sombre.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 47 : Onboarding Interactif Guidé sur le 1er Mois *(Atteindre `0 €` en 3 minutes & Célébration)*

- [x] **Backend (`User.model.ts`, `auth.controller.ts`) :**
  * Ajouter `onboardingCompletedAt?: Date` (et/ou `onboardingStep?: number`) sur `UserModel` pour suivre l'achèvement réel du premier budget Base Zéro sans bloquer les utilisateurs existants.
  * Exposer `POST /api/auth/onboarding/complete` (ou mise à jour via `PATCH /api/auth/me`).
- [x] **Frontend (`OnboardingWizard.tsx`, `App.tsx`, `ZeroBasedBanner.tsx`) :**
  * **Parcours guidé en 4 micro-étapes (< 3 minutes) :**
    1. **Cycle budgétaire :** Choix rapide du jour de début de mois (`budgetStartDay`, ex. 1er, 25, 28) avec explication en 1 phrase.
    2. **Revenus du mois :** Saisie d'un ou plusieurs revenus (avec suggestions rapides *Salaire*, *Aides*) via `NumericKeypad`.
    3. **Charges fixes & Enveloppes :** Sélection/ajout rapide parmi des modèles pré-remplis (*Loyer*, *Courses*, *Sorties*, *Épargne*) avec curseurs ou saisie directe des montants.
    4. **Atteinte du `0,00 €` :** Jauge en temps réel **`Restant à répartir : X €`** guidant l'utilisateur jusqu'à `0,00 €` (avec bouton raccourci *« Mettre le reste en Épargne »* si un reliquat subsiste).
  * **Feedback célébratoire :** Dès que `remainingToAllocate === 0` à l'issue de l'onboarding (ou lors de la toute première validation à `0 €`), déclencher une **micro-animation / pluie de confettis** légère (CSS/Canvas sans dépendance lourde) et un écran de félicitations (*« Bravo ! Ton premier Budget Base Zéro est prêt »*) redirigeant vers l'onglet **Budget** en mode `Essentiel`.
  * **Option « Passer » :** Conserver un bouton discret *« Configurer plus tard »* pour ne jamais bloquer l'utilisateur.
  * Supporter intégralement les **modes clair et sombre**.
- [ ] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Frontend :** Tests d'intégration sur `OnboardingWizard.tsx` (enchaînement des 4 étapes, calcul en direct du `Restant à répartir`, raccourci *Mettre le reste en Épargne* pour atteindre `0 €`, déclenchement de l'état célébratoire, bouton *Passer*, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 48 : Série de Saisie (Streak) & Bilans Hebdomadaires Bienveillants *(Gamification & Rétention Douce)*

- [x] **Backend (`streak.service.ts`, `analytics.controller.ts`, `budget.routes.ts`) :**
  * Créer `streak.service.ts` calculant sans culpabilisation :
    * **Série hebdomadaire / mensuelle :** nombre de semaines consécutives avec au moins une saisie active ou un budget maintenu dans le vert (*« 3e semaine dans le vert »*), et nombre de mois consécutifs où le budget global est respecté (*« Budget respecté 2 mois de suite »*).
    * **Bilan hebdomadaire synthétique :** dépenses de la semaine en cours vs moyenne hebdomadaire du cycle, enveloppe la mieux maîtrisée et reste à dépenser par jour actualisé.
  * Exposer `GET /api/budgets/:budgetId/streak` (protégé par JWT et appartenance au budget).
- [x] **Frontend (`StreakBadgeCard.tsx`, `WeeklyRecapSheet.tsx`, `App.tsx`) :**
  * **`StreakBadgeCard.tsx` :** Petit badge/carte motivante et bienveillante (sans rouge punitif ni perte brutale de score ; en cas de dépassement, afficher un message constructif *« Nouveau départ cette semaine »*).
  * **`WeeklyRecapSheet.tsx` :** Tiroir de bilan hebdomadaire accessible au tap sur le badge de série, affichant le résumé de la semaine écoulée et les encouragements.
  * Supporter intégralement les **modes clair et sombre**.
- [ ] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests unitaires sur `streak.service.ts` (calcul des semaines consécutives, mois respectés, cas limites sans transactions) + test API Supertest sur `GET /api/budgets/:budgetId/streak`.
  * **Nouveaux tests Frontend :** Tests de rendu et d'interaction sur `StreakBadgeCard` et `WeeklyRecapSheet` (modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 49 : Export & Portabilité Rassurante *(Souveraineté des Données CSV / JSON en 1 Clic)*

- [x] **Backend (`export.controller.ts`, `export.service.ts`, `budget.routes.ts`) :**
  * Étendre l'export existant pour proposer un **export complet et portable** de l'espace budgétaire (ou de tout le compte utilisateur) :
    * **Export CSV** propre (encodage UTF-8 avec BOM pour Excel/Numbers, séparateur `;` ou `,`, colonnes normalisées : date, type, libellé, enveloppe/catégorie, montant, payé par, tags).
    * **Export JSON complet** (`GET /api/budgets/:budgetId/export?format=json`) incluant métadonnées du budget, périodes, enveloppes, transactions, objectifs d'épargne et comptes patrimoniaux, afin de garantir une **réversibilité totale**.
- [x] **Frontend (`ExportActionsCard.tsx`, `ProfileSheet.tsx` / `BudgetSettingsSheet.tsx`) :**
  * Mettre en avant la **souveraineté des données** dans `ExportActionsCard.tsx` et dans les paramètres du profil/budget avec un message rassurant (*« Vos données vous appartiennent — Exportez-les à tout moment sans frais »*).
  * Proposer deux boutons d'action directs en **1 clic** : **`Exporter en CSV (Excel)`** et **`Exporter en JSON (Sauvegarde complète)`**, avec feedback visuel de téléchargement réussi.
  * Supporter intégralement les **modes clair et sombre**.
- [ ] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend :** Tests API Supertest sur `GET /api/budgets/:budgetId/export?format=csv` et `?format=json` (vérification des en-têtes `Content-Disposition`, `Content-Type`, structure JSON et échappement CSV).
  * **Nouveaux tests Frontend :** Tests de rendu et de déclenchement du téléchargement sur `ExportActionsCard` (modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 50 : Saisie Vocale & Langage Naturel dans le Quick-Add (100 % Local) *(Zéro Friction & Rétention Quotidienne)*

- [x] **Moteur de Parsing 100 % Local (`frontend/src/utils/parseNaturalExpense.ts`) :**
  * Créer une fonction pure et déterministe `parseNaturalExpense(input, context)` (zéro appel réseau, zéro coût serveur, fonctionnement 100 % hors-ligne) prenant en entrée la phrase libre et le contexte actif (`envelopes`, `suggestions`, `members`, `isSharedBudget`, `referenceDate`) et retournant `{ amount?, label?, envelopeId?, envelopeMatchedBy?, date?, paidByUserId?, tags?, rawInput }`.
  * **Extraction du montant (`amount`) :** supporter tous les formats écrits et dictés en français (`42,50 €`, `42.50`, `42 euros 50`, `42€50`, `15 euros`, `15 euro`, `15 balles`, `9,90`, montants entiers et décimaux), avec normalisation virgule/point et suppression propre du segment extrait.
  * **Extraction de la date (`date`) :** reconnaître les expressions relatives (`aujourd'hui`, `hier`, `avant-hier`) et les jours de la semaine récents (ex. `lundi`, `samedi`) pour calculer la date cible au format `YYYY-MM-DD`.
  * **Détection intelligente de l'enveloppe (`envelopeId`) à 2 niveaux :**
    * *Niveau 1 — Correspondance directe :* comparaison insensible à la casse et aux accents (`NFD`) entre les mots de la phrase et les noms des `envelopes` actives (y compris correspondances partielles / singulier-pluriel, ex. *« course »* → *« Courses »*, *« resto »* → *« Restaurants »*).
    * *Niveau 2 — Fallback sur l'historique (`suggestions`) :* si aucune enveloppe n'est nommée explicitement (ex. *« 42,50 euros Carrefour »*), rechercher le marchand/libellé dans `suggestions` (auto-complétion existante) pour pré-sélectionner automatiquement l'enveloppe habituellement associée.
  * **Extraction des tags (`tags`) :** détecter les hashtags (`#vacances`, `#pro`) et les retirer du libellé final.
  * **Détection du payeur en budget commun (`paidByUserId`) :** si `isSharedBudget` est actif, reconnaître les tournures `payé par <Prénom>` / `par <Prénom>` et faire correspondre au membre concerné dans `members`.
  * **Nettoyage du libellé (`label`) :** retirer les segments déjà consommés (montant, date, nom d'enveloppe, tags, payeur) ainsi que les mots de liaison orphelins en début/fin de chaîne (`à`, `au`, `aux`, `chez`, `pour`, `dans`, `de`, `du`, `en`, `le`, `la`, `les`, `un`, `une`), puis appliquer une capitalisation propre (ex. *« 42 euros 50 chez Carrefour courses hier »* → `Carrefour`).
- [x] **Hook de Dictée Vocale (`frontend/src/hooks/useSpeechRecognition.ts`) :**
  * Encapsuler l'API native `window.SpeechRecognition || window.webkitSpeechRecognition` configurée en français (`lang = 'fr-FR'`, `interimResults = true`, `continuous = false`).
  * Exposer un état clair : `{ isSupported, isListening, transcript, interimTranscript, error, startListening, stopListening, resetTranscript }`.
  * Gérer proprement tous les cas d'erreur et de cycle de vie :
    * **Dégradation élégante :** `isSupported === false` sur les navigateurs non compatibles (ex. Firefox) → le bouton micro est masqué tout en laissant le champ texte libre 100 % fonctionnel.
    * **Gestion des erreurs :** `not-allowed` / `service-not-allowed` (message pédagogique invitant à autoriser le micro ou à utiliser la saisie texte), `no-speech` (aucune voix détectée), `network` (indication claire si la dictée OS nécessite du réseau, rappelant que la saisie texte fonctionne hors-ligne).
    * **Nettoyage automatique :** arrêt propre (`abort()` / `stop()`) lors de la fermeture du `BottomSheet` ou du démontage du composant.
- [x] **Intégration UI Mobile-First dans `QuickAddExpenseSheet.tsx` :**
  * Ajouter en haut du tiroir une barre compacte **« Saisie express (voix ou texte) »** contenant :
    * un champ texte libre (placeholder *« Ex. 42,50 € Carrefour courses hier »*) déclenchant le parsing à la validation (`Entrée` ou bouton `Appliquer`) ou à la fin de la dictée,
    * un bouton tactile **Micro (`🎤`)** (≥ `44px × 44px`, `aria-label="Dicter une dépense"`) avec retour haptique (`triggerHaptic`), animation pulsante rouge en cours d'écoute et affichage en direct de la transcription intermédiaire (`interimTranscript`).
  * **Pré-remplissage transparent (jamais de soumission automatique) :** appliquer les valeurs extraites dans les champs existants (`amountInput`, `label`, `selectedEnvelopeId`, `date`, `paidByUserId`, `tags`) et afficher sous la barre des **puces récapitulatives discrètes** (*« Détecté : 42,50 € · 🛒 Courses · Hier »*) avec possibilité d'ajuster chaque champ ou d'effacer en 1 tap avant d'appuyer sur **Ajouter**.
  * Supporter intégralement les **modes clair et sombre** et l'accessibilité (`aria-live="polite"` pour le statut d'écoute et les champs détectés).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests unitaires (`parseNaturalExpense.test.ts`) :** couverture exhaustive des formats de montants (`42,50 €`, `42.50`, `42 euros 50`, `42€50`, `15 balles`), dates relatives (`hier`, `avant-hier`), matching d'enveloppes (direct + sans accent + fallback via `suggestions`), extraction de `#tags`, `payé par <Prénom>` en budget commun, nettoyage des mots de liaison et phrases incomplètes/vides.
  * **Nouveaux tests UI (`quickAddVoice.test.tsx`) :** mock de `SpeechRecognition` (écoute, transcription intermédiaire et finale, erreur `not-allowed`, navigateur non supporté masquant le micro), saisie texte libre pré-remplissant le formulaire `QuickAddExpenseSheet` (modes clair et sombre) et vérification qu'aucune soumission automatique n'a lieu sans validation utilisateur.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 51 : Restauration & Import de Sauvegarde JSON *(Souveraineté & Réversibilité Totale des Données)*

- [x] **Évolution rétrocompatible du format d'export JSON (`export.controller.ts`) :**
  * Inclure également les comptes patrimoniaux (`AssetAccountModel` : comptes, `history[]`, `operations[]`) dans `exportBudgetJson` (champ `assets[]`, avec `schemaVersion: 2` tout en restant 100 % rétrocompatible avec les sauvegardes `schemaVersion: 1` où `assets` est absent).
- [x] **Backend — Validation Zod, Remapping d'Identifiants & Service de Restauration (`jsonImport.service.ts`, `export.controller.ts`, `routes/`) :**
  * Créer un schéma Zod strict (`budgetBackupImportSchema`) validant :
    * `schemaVersion` (`1` ou `2`, rejet clair HTTP `400` si version non supportée),
    * la structure complète de `budget`, `periods[]`, `envelopes[]`, `transactions[]`, `goals[]` (avec `withdrawals[]`) et `assets[]` optionnel (avec `history[]` et `operations[]`),
    * les garde-fous de taille et d'intégrité (limite de payload JSON dédiée ex. `10 Mo`, nombre maximum de documents par collection, validation des montants finis, dates ISO valides, énumérations `pillar`, `type`, `category`, `recurrenceFrequency`, `rolloverMode`, protection contre les clés MongoDB interdites `$` / `.`).
  * Créer le service `jsonImport.service.ts` supportant **2 modes de restauration** :
    1. **`create_new` *(Recommandé / Par défaut)* :** crée un nouvel espace budgétaire (`BudgetModel`) appartenant à l'utilisateur connecté (`ownerId = req.user.id`, nom personnalisable ou `<Nom d'origine> (Restauré)`), sans jamais toucher aux budgets existants.
    2. **`replace_existing` *(Avancé, réservé au `owner` du budget cible)* :** remplace intégralement le contenu d'un budget existant (suppression atomique des `TransactionModel`, `EnvelopeModel`, `SavingsGoalModel`, `AssetAccountModel` et `BudgetPeriodModel` cibles puis réinsertion des données restaurées, avec confirmation explicite requise).
  * **Remapping déterministe de tous les `ObjectId` (zéro collision entre comptes ou environnements) :**
    * Générer des tables de correspondance (`Map<oldId, newObjectId>`) pour `budgetId`, `periodId`, `assetAccountId`, `goalId`, `envelopeId` (y compris les liens croisés : `Envelope.previousEnvelopeId` pour la chaîne de rollover, `Envelope.linkedGoalId`, `SavingsGoal.assetAccountId`, `Transaction.envelopeId`, `Transaction.budgetPeriodId`, `Transaction.splitGroupId`, et `AssetAccount.operations[].counterpartyId`).
    * **Résolution sécurisée des membres (`ownerId`, `memberId`, `authorId`, `paidByUserId`) :** rattacher par défaut à l'utilisateur effectuant la restauration (ou faire correspondre aux membres existants du budget cible en mode `replace_existing` si leur identifiant/e-mail coïncide), sans jamais exposer ni injecter d'utilisateurs tiers arbitraires.
  * **Recalcul d'intégrité post-import :**
    * Exécuter `recalculatePeriodSummary` sur chaque période restaurée et `recalculateSavingsGoalCurrentAmount` sur chaque objectif d'épargne afin de garantir une cohérence mathématique parfaite (`remainingToAllocate`, `remainingToLive`, `spentOrPaidAmount`, `currentAmount`).
  * **Gestion atomique / Rollback en cas d'erreur :**
    * Utiliser une transaction MongoDB si le déploiement est en Replica Set, ou un mécanisme de nettoyage compensatoire fiable (suppression du budget nouvellement créé en cas d'échec intermédiaire en mode `create_new`) afin de ne jamais laisser un budget partiellement importé.
  * **Endpoints API protégés par JWT & Rate-Limiting :**
    * `POST /api/budgets/import/json/preview` : valide le fichier côté serveur sans rien écrire en base et retourne un résumé détaillé (`budgetName`, `schemaVersion`, `exportedAt`, compteurs `periodsCount`, `envelopesCount`, `transactionsCount`, `goalsCount`, `assetsCount`, plage de dates couverte et éventuels avertissements de compatibilité).
    * `POST /api/budgets/import/json` (mode `create_new`, ou `POST /api/budgets/:budgetId/import/json` en mode `replace_existing` protégé par `assertBudgetAccess` avec rôle `owner`) avec middleware anti-abus dédié (`importRateLimiter`).
- [x] **Frontend — Tiroir de Restauration JSON (`JsonImportSheet.tsx`, `ExportActionsCard.tsx`, `BudgetSettingsSheet.tsx`, `export.service.ts`) :**
  * Ajouter une action **`Importer / Restaurer une sauvegarde (.json)`** dans `ExportActionsCard.tsx` et dans `BudgetSettingsSheet.tsx` (et/ou `BudgetSwitcherOverlay` pour restaurer directement en nouvel espace).
  * Construire **`JsonImportSheet.tsx`** (parcours guidé Mobile-First en 3 étapes, compatible **modes clair et sombre**) :
    1. **Sélection du fichier `.json` :** zone de sélection tactile (`<input type="file" accept="application/json,.json" />`), lecture et pré-validation locale (JSON valide, taille max, présence de `schemaVersion`) avec message d'erreur clair si le fichier est corrompu ou au mauvais format.
    2. **Aperçu & Choix du mode :** appel à `/preview` affichant la carte récapitulative du backup (nom, date d'export, nombre de mois, d'enveloppes, de transactions, d'objectifs et de comptes patrimoniaux), champ de renommage optionnel, et sélecteur tactile entre :
       * **Créer un nouvel espace budgétaire** *(badge Recommandé — sans risque)*,
       * **Remplacer l'espace actuel** *(avertissement rouge explicite + case/saisie de confirmation obligatoire)*.
    3. **Confirmation & Redirection :** indicateur de progression pendant la restauration, écran de succès récapitulant les éléments restaurés, invalidation des caches TanStack Query (`['budgets']`, `['period']`, `['envelopes']`, `['goals']`, `['net-worth']`, `['analytics']`) et bascule automatique sur le budget restauré.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/jsonImport.test.ts`) :**
    * Test **aller-retour complet (*round-trip*)** : `exportBudgetJson` → `POST /api/budgets/import/json` (`create_new`) puis vérification de l'intégrité de toutes les collections (périodes, enveloppes, chaîne `previousEnvelopeId` de rollover, `linkedGoalId`, transactions simples et fractionnées `splitGroupId`, remboursements, tags, objectifs + retraits, comptes patrimoniaux `assets` + `operations`, recalculs `remainingToLive` et `remainingToAllocate`).
    * Tests de rétrocompatibilité `schemaVersion: 1` (sans `assets`) et rejet `400` sur version inconnue, JSON invalide, montants/dates invalides ou injection `$`.
    * Tests du mode `replace_existing` (contrôle d'accès `owner` uniquement → `403` pour `editor`/`viewer`, remplacement propre sans doublons).
    * Tests de `/preview` (zéro écriture en base) et du contrôle JWT (`401`).
  * **Nouveaux tests Frontend (`frontend/src/__tests__/jsonImport.test.tsx`) :**
    * Sélection d'un fichier `.json` valide et invalide, affichage de l'aperçu, bascule `create_new` vs `replace_existing` (blocage tant que la confirmation n'est pas validée), déclenchement de la restauration, invalidation des caches et vérification des **modes clair et sombre**.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 52 : Scénarios & Modèles de Budget (« Mois Normal », « Mois Serré », « Vacances ») *(Adaptabilité & Revenus Variables)*

- [x] **Modèle de Données (`backend/src/models/BudgetTemplate.model.ts`) :**
  * Créer la collection dédiée `BudgetTemplateModel` rattachée à `budgetId` (index `{ budgetId: 1, name: 1 }`) contenant :
    * `budgetId` (`ObjectId`, ref `Budget`, requis),
    * `name` (`string`, trim, max 60 car., requis, ex. *« Mois Normal »*, *« Mois Serré »*, *« Vacances »*),
    * `icon` (`string`, emoji par défaut `'🎭'`),
    * `color` (`string`, couleur d'accentuation parmi la palette Eparnio),
    * `description` (`string`, optionnel, max 160 car.),
    * `items[]` : tableau structuré des dotations fixes incluses dans le scénario :
      * `pillar`: `'variable_envelope' | 'savings'` (exclusion stricte de `income` et `fixed_charge`),
      * `name`: `string` (nom de référence de l'enveloppe, utilisé avec normalisation sans casse/accents pour le rapprochement multi-mois),
      * `icon`: `string`,
      * `color`: `string`,
      * `allocatedAmount`: `number` (`>= 0`, montant fixe en euros),
      * `linkedGoalId?`: `ObjectId` (pour les items `savings` rattachés à un `SavingsGoal` existant),
      * `rolloverEnabled?`: `boolean` et `rolloverMode?`: `'positive_only' | 'both'` (pour les items `variable_envelope`),
      * `order`: `number`.
    * `createdBy` (`ObjectId`, ref `User`), `createdAt`, `updatedAt`.
  * Exposer le helper `toBudgetTemplateResponse` retournant les champs normalisés et le total prévisionnel calculé (`totalVariableAmount`, `totalSavingsAmount`, `totalAllocatedAmount`).
- [x] **Backend — Service Métier, Dry-Run & Application Atomique (`backend/src/services/budgetTemplate.service.ts`) :**
  * **Création depuis un mois existant (*Snapshot en 1 tap*) :** fonction `buildTemplateItemsFromPeriod(budgetId, periodId)` capturant automatiquement toutes les enveloppes `variable_envelope` et `savings` de la période cible (noms, icônes, couleurs, `allocatedAmount`, `linkedGoalId`, options de rollover, `order`).
  * **Algorithme de rapprochement & d'application (`previewOrApplyTemplate(budgetId, periodId, templateId, { dryRun })`) :**
    * **Rapprochement déterministe :** faire correspondre chaque item du scénario aux enveloppes de la période cible par `linkedGoalId` (en priorité pour `savings`), puis par `(pillar, nom normalisé NFD sans accents/casse)`.
    * **Enveloppes présentes dans le scénario et dans le mois :** mettre à jour uniquement `allocatedAmount` (et optionnellement `icon`/`color`/`rolloverEnabled`/`rolloverMode` si demandé) sans **jamais** modifier `spentOrPaidAmount` ni `rolloverAmount`. Si `newAllocatedAmount < spentOrPaidAmount`, signaler un avertissement explicite (`exceedsSpent: true`) dans le diff.
    * **Enveloppes présentes dans le scénario mais absentes du mois :** créer automatiquement l'enveloppe (`variable_envelope` ou `savings`, avec vérification que `linkedGoalId` existe encore dans le budget) sur la période cible.
    * **Enveloppes présentes dans le mois (`variable_envelope` ou `savings`) mais absentes du scénario :** **ne jamais les supprimer** (préservation totale des transactions, de l'historique et du `rolloverAmount`) ; passer leur `allocatedAmount` à **`0 €`** (avec flag `resetToZero: true` dans le diff et avertissement si `spentOrPaidAmount > 0`).
    * **Invariants protégés :** ne jamais toucher aux piliers `income` et `fixed_charge`, ni aux transactions existantes, ni aux `rolloverAmount` de la période active.
    * **Mode `dryRun: true` (Aperçu Avant / Après) :** exécuter toute la simulation en mémoire sans aucune écriture en base et retourner :
      * `changes[]` (statut `'updated' | 'created' | 'reset_to_zero' | 'unchanged'`, `previousAmount`, `newAmount`, `deltaAmount`, `spentOrPaidAmount`, `exceedsSpent`),
      * `summaryBefore` et `summaryAfter` (`plannedEnvelopes`, `plannedSavings`, `remainingToAllocate`, `remainingToLive`),
      * `warnings[]` (enveloppes dont le nouveau plafond passe sous le déjà dépensé ou objectifs supprimés).
    * **Mode `dryRun: false` (Application réelle) :** appliquer les mises à jour/créations, recalculer `recalculatePeriodSummary(periodId)` (équilibre Base Zéro & Reste à vivre) et déclencher la propagation dynamique de `rolloverAmount` vers les périodes suivantes chaînées ($M+1, M+2\dots$) si elles existent déjà.
- [x] **Backend — Contrôleur, Validation Zod & Routes API (`budgetTemplate.controller.ts`, `budget.routes.ts`, `period.routes.ts`) :**
  * Valider tous les payloads avec Zod (`createBudgetTemplateSchema`, `updateBudgetTemplateSchema`, `applyBudgetTemplateSchema`) : montants finis `>= 0`, pilier limité à `variable_envelope | savings`, limite raisonnable d'items par scénario (ex. max 100).
  * Exposer les endpoints protégés par JWT et `assertBudgetAccess` (lecture pour `owner`/`editor`/`viewer`, écriture/application pour `owner`/`editor`) :
    * `GET /api/budgets/:budgetId/templates` : lister les scénarios du budget.
    * `POST /api/budgets/:budgetId/templates` : créer un scénario (manuellement via `items[]` ou en 1 tap depuis `sourcePeriodId`).
    * `PATCH /api/budgets/:budgetId/templates/:templateId` : renommer, modifier l'icône/couleur/description ou ajuster les dotations `items[]`.
    * `DELETE /api/budgets/:budgetId/templates/:templateId` : supprimer un scénario (sans impacter les périodes passées).
    * `POST /api/periods/:periodId/apply-template` : corps `{ templateId, dryRun?: boolean }` (prévisualisation Avant/Après ou application immédiate).
  * Intégrer également l'export/import des `templates[]` dans `exportBudgetJson` / `jsonImport.service.ts` (compatibilité totale avec la souveraineté des données de l'Étape 51).
- [x] **Frontend — Service API & Tiroirs Mobile-First (`budgetTemplate.service.ts`, `BudgetTemplatesSheet.tsx`, `BudgetTemplateFormSheet.tsx`, `ApplyTemplatePreviewSheet.tsx`) :**
  * **`BudgetTemplatesSheet.tsx` (Liste & Gestion) :**
    * Afficher les cartes des scénarios enregistrés (emoji, nom, total Enveloppes + Épargne, nombre de postes) avec actions rapides **Appliquer**, **Modifier** et **Supprimer**, ainsi qu'un état vide pédagogique (*« Créez des scénarios Mois Normal, Mois Serré ou Vacances pour adapter votre budget en 1 tap »*).
    * Bouton principal **`📸 Enregistrer ce mois comme scénario`** (pré-remplit instantanément le formulaire avec les enveloppes variables et l'épargne du mois actif) et bouton secondaire **`+ Créer de zéro`**.
  * **`BudgetTemplateFormSheet.tsx` (Création / Édition) :**
    * Saisie du nom, emoji, couleur, description optionnelle, et liste éditable des postes (`Enveloppes variables` et `Épargne mensuelle`) avec saisie tactile des montants fixes (€) via `NumericKeypad` et total live en pied de formulaire.
  * **`ApplyTemplatePreviewSheet.tsx` (Aperçu Avant / Après obligatoire) :**
    * Appel automatique à `POST /api/periods/:periodId/apply-template` avec `dryRun: true`.
    * Carte synthèse **Avant → Après** sur le **Reste à répartir (Base Zéro)** et le **Reste à vivre**.
    * Liste claire du diff par poste : hausses/baisses (`400 € → 300 €`), créations (`+ Nouvelle enveloppe`), mises à zéro (`→ 0 € · conservée`) et badges d'alerte orange si une enveloppe a déjà dépensé plus que le nouveau plafond.
    * Bouton bleu pleine largeur **`Appliquer ce scénario`** avec invalidation des caches TanStack Query (`['period']`, `['envelopes']`, `['analytics']`, `['goals']`, `['calendar']`).
  * **Points d'entrée intégrés dans l'application :**
    * Pilule **`🎭 Scénarios`** dans l'onglet **Enveloppes** (en tête de la section *Les enveloppes*),
    * Sélecteur optionnel **« Appliquer un scénario au mois suivant »** à l'**Étape 3 de `MonthClosingWizard.tsx`** (Rituel de clôture de fin de mois),
    * Entrée **« Scénarios de budget »** dans `BudgetSettingsSheet.tsx`.
  * Supporter intégralement les **modes clair et sombre** et les cibles tactiles Mobile-First (`≥ 44px`).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/budgetTemplate.test.ts`) :**
    * CRUD complet `/api/budgets/:budgetId/templates` (création manuelle, création par snapshot `sourcePeriodId`, édition, suppression, contrôle d'accès JWT & rôles `viewer` → `403`).
    * Tests unitaires et API de `apply-template` : mode `dryRun: true` (zéro écriture en base), mise à jour `variable_envelope` + `savings`, création des enveloppes manquantes, mise à `0 €` des enveloppes absentes du scénario **sans suppression ni perte de transactions**, alerte `exceedsSpent`, non-altération de `income`/`fixed_charge`/`rolloverAmount`, recalcul `remainingToAllocate` & `remainingToLive`, et propagation rollover $M \rightarrow M+1$.
  * **Nouveaux tests Frontend (`frontend/src/__tests__/budgetTemplates.test.tsx`) :**
    * Rendu de `BudgetTemplatesSheet` (état vide + liste), création en 1 tap depuis le mois actuel, affichage du diff Avant/Après dans `ApplyTemplatePreviewSheet` (y compris badge `→ 0 €` et alerte `exceedsSpent`), confirmation d'application, intégration dans `MonthClosingWizard`, et vérification des **modes clair et sombre**.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 53 : Synchronisation Temps Réel (SSE) & Notifications d'Activité en Budget Commun *(100 % Gratuit & Zéro Service Tiers)*

- [x] **Backend — Gestionnaire Temps Réel SSE (`backend/src/services/realtime.service.ts`) :**
  * Créer un service en mémoire léger (zéro dépendance payante) gérant les abonnés par espace budgétaire (`Map<budgetId, Set<RealtimeClient>>`) avec limite de sécurité par utilisateur (ex. max 5 connexions simultanées) et nettoyage automatique sur `req.on('close')`.
  * **Compatibilité Reverse Proxy / Render / Cloudflare :**
    * Configurer les en-têtes SSE stricts : `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`, appel immédiat à `res.flushHeaders()` et exclusion explicite de toute compression HTTP sur le flux.
    * Envoyer un **heartbeat** (`: ping\n\n`) toutes les **25 secondes** pour éviter les coupures d'inactivité des proxies (Render / Nginx / Cloudflare).
  * Exposer `emitBudgetEvent(budgetId, payload)` diffusant un événement structuré (`type`, `budgetId`, `periodId?`, `actorUserId`, `actorName`, `summary`, `invalidateKeys[]`, `timestamp`) et `disconnectUserFromBudget(budgetId, userId)` appelé immédiatement lors du retrait d'un membre (`DELETE /api/budgets/:id/members/:userId`).
- [x] **Backend — Route SSE Sécurisée & Émission sur les Mutations (`realtime.controller.ts`, `budget.routes.ts`, contrôleurs métier) :**
  * Exposer `GET /api/budgets/:budgetId/events` protégé par JWT (`Authorization: Bearer`, jamais de token dans l'URL) et `assertBudgetAccess`, actif sur **tous les budgets** (`personal` pour la synchro multi-appareils et `shared` pour le foyer).
  * Émettre `emitBudgetEvent` (de manière non bloquante) après les mutations clés : création/modification/suppression/fractionnement/import de transactions, création/modification/pointage d'enveloppes ou charges fixes, versements/retraits sur objectifs d'épargne, application d'un scénario, clôture de mois et gestion des membres.
- [x] **Backend — Notifications Push d'Activité Partagée (`User.model.ts`, `pushNotification.service.ts`) :**
  * Ajouter `sharedActivityAlertEnabled: boolean` (défaut **`true`**) dans `User.notificationPreferences` (exposé dans `GET/PATCH /api/notifications/preferences`).
  * Lors d'une mutation clé sur un budget **`shared`**, envoyer en asynchrone (*fire-and-forget*, sans jamais ralentir la réponse API) une notification Web Push (via `web-push` / VAPID déjà en place à l'Étape 38) aux autres membres du budget (`member.userId !== actorUserId`) ayant `sharedActivityAlertEnabled: true`, avec message regroupé pour les opérations par lot (import CSV, ticket fractionné) et URL cible ouvrant l'onglet concerné.
- [x] **Frontend — Client SSE Résilient & Synchro TanStack Query (`useBudgetRealtimeSync.ts`, `RealtimeToast.tsx`, `ProfileSheet.tsx`, `App.tsx`) :**
  * Implémenter `useBudgetRealtimeSync(budgetId, enabled)` utilisant `fetch()` + `ReadableStream` (pour transmettre le header `Authorization: Bearer` en toute sécurité) avec :
    * **Reconnexion automatique** avec backoff exponentiel (`1s → 2s → 4s → max 30s`) en cas de coupure réseau ou redémarrage Render,
    * **Gestion `visibilitychange` & `online` :** fermeture propre via `AbortController` lors de la mise en arrière-plan mobile et reconnexion + rafraîchissement immédiat des requêtes actives au retour au premier plan.
  * À la réception d'un événement : invalider automatiquement les clés TanStack Query listées (`['period']`, `['envelopes']`, `['analytics']`, `['goals']`, `['calendar']`, `['net-worth']`) et, si `actorUserId !== currentUser.id`, afficher un **toast discret non intrusif** (`RealtimeToast.tsx`, ex. *« Alex a ajouté 38,00 € dans 🛒 Courses »*, compatible **modes clair et sombre**).
  * Ajouter le 4e interrupteur **`Activité du budget commun`** (activé par défaut) dans la section *Notifications & Rappels* de `ProfileSheet.tsx`.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/realtime.test.ts`) :** tests unitaires sur `realtime.service.ts` (diffusion, filtrage par `budgetId`, limite de connexions, déconnexion forcée d'un membre retiré, heartbeat), tests API sur `GET /api/budgets/:budgetId/events` (en-têtes SSE anti-buffering, JWT `401`, accès `403`), et tests de déclenchement des notifications Push d'activité partagée (`sharedActivityAlertEnabled` true/false, exclusion de l'auteur).
  * **Nouveaux tests Frontend (`frontend/src/__tests__/realtimeSync.test.tsx`) :** mock de flux SSE (`ReadableStream`), invalidation automatique TanStack Query, affichage du `RealtimeToast` uniquement pour un autre membre, reconnexion sur `visibilitychange`, interrupteur `ProfileSheet` en modes clair et sombre.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 54 : Règles d'Auto-Catégorisation (`Payee Rules`) pour l'Import CSV & la Saisie *(Zéro Friction & Tri Automatique)*

- [x] **Modèle de Données (`backend/src/models/PayeeRule.model.ts`) :**
  * Créer la collection `PayeeRuleModel` rattachée à `budgetId` (index `{ budgetId: 1, order: 1 }`) contenant :
    * `budgetId` (`ObjectId`, ref `Budget`, requis),
    * `pattern` (`string`, trim, 1 à 80 car., requis — texte simple sans regex libre pour éviter tout risque ReDoS),
    * `matchType`: `'contains' | 'starts_with' | 'exact'` (défaut `'contains'`, comparaison insensible à la casse et aux accents NFD),
    * `transactionType`: `'all' | 'expense' | 'income'` (défaut `'all'`),
    * `targetEnvelopeName?` (`string`, nom de référence de l'enveloppe variable pour survivre automatiquement à la reconduction mensuelle),
    * `renameLabel?` (`string`, libellé propre de remplacement, max 80 car.),
    * `addTags`: `string[]` (normalisés en minuscules, max 5 tags),
    * `autoExcludeFromImport`: `boolean` (défaut `false` — permet d'ignorer automatiquement les virements internes ou mouvements techniques lors de l'import CSV),
    * `isActive`: `boolean` (défaut `true`),
    * `order`: `number` (détermine la priorité : la première règle active correspondante s'applique),
    * `createdBy` (`ObjectId`, ref `User`), `createdAt`, `updatedAt`.
- [x] **Backend — Contrôleur, Validation Zod & Routes API (`payeeRule.controller.ts`, `budget.routes.ts`) :**
  * Valider les payloads avec Zod (pattern non vide, au moins une action définie parmi `targetEnvelopeName`, `renameLabel`, `addTags` ou `autoExcludeFromImport`, limite max 100 règles par budget).
  * Exposer les endpoints protégés par JWT et `assertBudgetAccess` (lecture pour tous les membres, écriture pour `owner`/`editor`) :
    * `GET /api/budgets/:budgetId/payee-rules` : lister les règles triées par `order`,
    * `POST /api/budgets/:budgetId/payee-rules` : créer une règle,
    * `PATCH /api/budgets/:budgetId/payee-rules/:ruleId` : modifier / activer / désactiver une règle,
    * `DELETE /api/budgets/:budgetId/payee-rules/:ruleId` : supprimer une règle,
    * `PATCH /api/budgets/:budgetId/payee-rules/reorder` : réordonner la priorité des règles.
  * Intégrer `payeeRules[]` dans l'export/import JSON (Étape 51) pour garantir la portabilité complète.
- [x] **Frontend — Moteur Pur d'Évaluation (`frontend/src/utils/applyPayeeRules.ts`) :**
  * Implémenter la fonction pure `applyPayeeRules(rawLabel, transactionType, rules, activeEnvelopes)` (100 % côté client, zéro latence, insensible à la casse et aux accents NFD) retournant la première règle active correspondante et le résultat résolu : `{ matchedRule, resolvedEnvelopeId?, renameLabel?, addTags[], autoExcludeFromImport }`.
  * Fournir un helper `extractSuggestedPattern(rawLabel)` nettoyant les préfixes bancaires courants (`CB `, `PRLV SEPA `, `PAIEMENT PSC `, dates `DD/MM`) pour pré-remplir intelligemment le motif lors de la création d'une règle à la volée.
- [x] **Frontend — Gestion & 3 Points d'Entrée Mobile-First (`PayeeRulesSheet.tsx`, `PayeeRuleFormSheet.tsx`, `CsvImportSheet.tsx`, `QuickAddExpenseSheet.tsx`, `AddExpenseSheet.tsx`) :**
  * **Point d'entrée 1 — Hub complet dans `BudgetSettingsSheet.tsx` → `PayeeRulesSheet.tsx` :**
    * Liste des règles actives/inactives avec résumé visuel (`SI contient "carrefour" → 🛒 Courses · "Carrefour" · #alimentation` ou `🚫 Exclure à l'import`), switch actif/inactif, réordonnancement haut/bas, édition/suppression et champ **« Tester un libellé »** affichant en direct quelle règle se déclenche.
  * **Point d'entrée 2 — À la volée dans la Boîte de Tri CSV (`CsvImportSheet.tsx`) :**
    * Application automatique des règles dès le chargement du CSV/OFX : pré-sélection d'enveloppe, renommage (avec libellé brut affiché en discret dessous), ajout de tags, ou exclusion automatique (`🚫 Exclue par règle`, toujours réactivable en 1 tap), avec badge **`⚡ Règle`**.
    * Bouton discret **`⚡ Créer une règle`** sur chaque ligne classée/exclue manuellement (pré-rempli via `extractSuggestedPattern`) + raccourci **`⚡ Mes règles (N)`** en haut de la boîte de tri.
  * **Point d'entrée 3 — Puce cliquable 1-tap en Saisie Rapide (`QuickAddExpenseSheet.tsx` & `AddExpenseSheet.tsx`) :**
    * Lorsque le libellé saisi ou dicté correspond à une règle active, afficher une **puce cliquable en 1 tap** (ex. **`⚡ Appliquer règle : 🛒 Courses · #alimentation`**) qui applique les champs d'un coup sans jamais écraser silencieusement le travail de l'utilisateur, ainsi qu'un bouton discret **`⚡ Créer une règle`** pour enregistrer une nouvelle règle depuis la saisie.
  * Supporter intégralement les **modes clair et sombre** et les cibles tactiles Mobile-First (`≥ 44px`).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/payeeRule.test.ts`) :** CRUD complet `/api/budgets/:budgetId/payee-rules`, réordonnancement, validation Zod (rejet si aucune action définie), contrôle d'accès JWT & rôles (`viewer` → `403`).
  * **Nouveaux tests Frontend (`frontend/src/__tests__/payeeRules.test.tsx`) :** tests unitaires sur `applyPayeeRules` (`contains`/`starts_with`/`exact`, accents NFD, ordre de priorité, `autoExcludeFromImport`, `extractSuggestedPattern`), tests UI sur `PayeeRulesSheet` (testeur de libellé, création/édition), `CsvImportSheet` (auto-catégorisation + auto-exclusion + création à la volée) et puce 1-tap dans `QuickAddExpenseSheet` en **modes clair et sombre**.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 55 : Deep-Link Quick-Add, Web Share Target & Raccourcis PWA *(Intégration Apple Pay / Google Wallet / SMS)*

- [x] **Manifeste PWA & Configuration (`frontend/vite.config.ts`) :**
  * Déclarer `share_target` dans le manifeste `vite-plugin-pwa` :
    * `action: '/quick-add'`, `method: 'GET'`, `params: { title: 'title', text: 'text', url: 'url' }` (permet sur Android/Desktop de partager directement un SMS bancaire ou un reçu texte vers l'icône Eparnio).
  * Déclarer `shortcuts` dans le manifeste PWA :
    * Raccourci **« + Dépense rapide »** pointant vers `/quick-add` (appui long sur l'icône Eparnio sur Android et clic droit sur Desktop ; ignoré sans erreur sur iOS).
  * Vérifier que le fallback SPA (Vercel `vercel.json` / Vite dev) redirige proprement `/quick-add` vers `index.html`.
- [x] **Moteur Pur de Parsing & Persistance Éphémère (`frontend/src/utils/quickAddDeepLink.ts`) :**
  * Implémenter `parseQuickAddUrlParams(pathname, search)` supportant **2 modes complémentaires** :
    1. **Mode structuré (Apple Pay / Raccourcis iOS / URL) :** paramètres `amount` (normalisation virgule/point, nettoyage symboles `€`/`EUR`/espaces, montant fini `> 0`), `label` (max 160 car.), `envelope` (nom d'enveloppe à résoudre insensiblement à la casse/accents), `date` (`YYYY-MM-DD` validé), `tags` (séparés par `,`, max 5 tags normalisés), `notes` (max 300 car.).
    2. **Mode texte libre / Web Share Target :** paramètres `text` et/ou `title` (ex. *« Paiement carte 18,40 EUR chez CARREFOUR »*) passés dans le moteur local `parseNaturalExpense.ts` (Étape 50) afin d'extraire montant, marchand, date relative, enveloppe et `#tags`.
  * **Croisement avec les Règles d'Auto-Catégorisation (`applyPayeeRules.ts`, Étape 54) :** si le libellé extrait matche une règle active du budget, proposer automatiquement la résolution (enveloppe, libellé nettoyé, tags).
  * **Persistance temporaire en `sessionStorage` (`EPARNIO_PENDING_QUICK_ADD_KEY`) :** si l'utilisateur arrive sur `/quick-add?...` alors que sa session JWT est expirée ou verrouillée, conserver le payload en `sessionStorage` et le consommer automatiquement dès la reconnexion (y compris via Face ID / Empreinte).
  * **Sécurité & Hygiène d'URL :**
    * **Jamais de soumission automatique silencieuse :** le deep-link pré-remplit uniquement `QuickAddExpenseSheet` pour une validation explicite en 1 tap par l'utilisateur.
    * Nettoyer immédiatement l'URL via `window.history.replaceState({}, '', '/')` dès que les paramètres sont capturés afin d'éviter toute réouverture intempestive au rechargement.
- [x] **Intégration `App.tsx` & `QuickAddExpenseSheet.tsx` :**
  * Détecter `/quick-add` au montage d'`App.tsx` (ou à la reconnexion depuis `sessionStorage`), basculer sur l'onglet **`Enveloppes`** si nécessaire et ouvrir automatiquement `QuickAddExpenseSheet` avec `initialPrefill`.
  * Étendre `QuickAddExpenseSheet.tsx` pour accepter `initialPrefill?: QuickAddPrefill` (pré-remplissage du montant, libellé, enveloppe résolue, date, tags, notes + affichage d'un discret bandeau *« Pré-rempli depuis votre raccourci »* en **modes clair et sombre**).
- [x] **Guide Intégré « Automatiser avec Apple Pay / Raccourcis » (`ApplePayShortcutGuideSheet.tsx` & `BudgetSettingsSheet.tsx`) :**
  * Ajouter une entrée **`📱 Automatiser avec Apple Pay / Raccourcis`** dans *Paramètres de l’espace → Général → Outils intelligents* (`BudgetSettingsSheet.tsx`).
  * Construire **`ApplePayShortcutGuideSheet.tsx`** (compatible **modes clair et sombre**) présentant :
    * L'URL modèle personnalisée sur le domaine courant (`${window.location.origin}/quick-add?amount=&label=`) avec bouton **« Copier le lien Quick-Add »** (feedback `Copié ✓`),
    * Un bouton **« Tester maintenant »** ouvrant un exemple pré-rempli (`12,50 € · Boulangerie`) pour vérifier le rendu en 1 tap,
    * Un guide pas à pas en 4 étapes claires pour configurer l'automatisation **Raccourcis iOS → Transaction Apple Pay → Ouvrir l'URL** (et une note sur le partage direct + appui long icône sur Android).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Frontend (`frontend/src/__tests__/quickAddDeepLink.test.tsx`) :**
    * Tests unitaires sur `parseQuickAddUrlParams` (mode structuré `amount=12,50&label=Boulangerie&tags=pain`, mode `share_target` `text=Paiement 18,40 EUR CARREFOUR`, paramètres invalides/vides ignorés proprement, sauvegarde/consommation `sessionStorage`).
    * Tests UI sur `QuickAddExpenseSheet` avec `initialPrefill` (vérification qu'aucune soumission automatique n'est déclenchée sans clic sur *Ajouter*) et sur `ApplePayShortcutGuideSheet` (copie du lien, bouton *Tester maintenant*, modes clair et sombre).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 56 : Suppression de Compte RGPD & Cascade Sécurisée (`DELETE /api/auth/me`) *(Conformité RGPD & Stores)*

- [x] **Backend — Service de Suppression de Compte (`backend/src/services/accountDeletion.service.ts`) :**
  * Créer `deleteUserAccountCascade(userId)` gérant proprement tous les cas métier :
    1. **Budgets personnels (`personal`) ou budgets sans autre membre actif :** suppression en cascade intégrale de toutes les collections liées (`TransactionModel`, `EnvelopeModel`, `SavingsGoalModel`, `AssetAccountModel`, `BudgetPeriodModel`, `BudgetTemplateModel`, `PayeeRuleModel`, puis `BudgetModel`).
    2. **Budgets partagés (`shared`) où l'utilisateur est `editor` ou `viewer` :** retrait de l'utilisateur de `budget.members[]` sans supprimer le budget ni altérer l'historique comptable du foyer.
    3. **Budgets partagés (`shared`) où l'utilisateur est `owner` avec d'autres membres actifs :** **transfert automatique de propriété** au premier membre restant (en priorité un `editor`, sinon un `viewer`) qui devient `owner` (`budget.ownerId` + rôle `owner` dans `members[]`), puis retrait de l'utilisateur supprimé.
    4. **Nettoyage personnel & temps réel :** suppression des abonnements Push (`PushSubscriptionModel.deleteMany({ userId })`), fermeture immédiate des connexions SSE actives (`disconnectUserFromBudget`), puis suppression définitive du document `UserModel` (e-mail, `passwordHash`, `recoveryKeyHash`, `webauthnCredentials`, préférences).
  * Retourner un résumé chiffré (`deletedBudgetsCount`, `transferredBudgetsCount`, `leftSharedBudgetsCount`).
- [x] **Backend — Endpoint Sécurisé (`auth.controller.ts`, `auth.routes.ts`) :**
  * Exposer `DELETE /api/auth/me` protégé par `requireAuth` et `authRateLimiter`.
  * Valider le corps avec Zod (`deleteAccountSchema`) exigeant :
    * `currentPassword` (vérifié via `bcryptjs.compare`, HTTP `401` si incorrect),
    * `confirmation: z.literal('SUPPRIMER')` (HTTP `400` sinon).
- [x] **Frontend — Zone Danger dans `ProfileSheet.tsx` (`Sécurité`) & Service (`auth.service.ts`) :**
  * Ajouter `deleteMyAccount({ currentPassword, confirmation })` dans `frontend/src/services/auth.service.ts`.
  * Ajouter une carte **« Supprimer mon compte »** en bas de l'onglet **`Sécurité`** de `ProfileSheet.tsx` (en **modes clair et sombre**) avec :
    * Déploiement sur clic (*« Supprimer définitivement mon compte »*),
    * Avertissement clair (suppression irréversible des budgets personnels ; transfert automatique de propriété des budgets partagés aux autres membres),
    * Saisie du **mot de passe actuel** + champ de confirmation exigeant le mot **`SUPPRIMER`**,
    * Bouton rouge **`Confirmer la suppression définitive`** bloqué tant que les 2 champs ne sont pas valides.
  * Après succès : exécuter `clearSession()`, `setActiveBudgetId(null)`, `queryClient.clear()`, nettoyer le stockage de session et fermer `ProfileSheet` (retour immédiat sur `AuthScreen`).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/accountDeletion.test.ts`) :**
    * Rejet `401` sans JWT ou avec mauvais `currentPassword`, rejet `400` sans `confirmation: 'SUPPRIMER'`.
    * Suppression en cascade d'un budget personnel (vérification `0` document restant dans toutes les collections + `PushSubscriptionModel` + `UserModel`).
    * Transfert automatique de propriété d'un budget `shared` vers un `editor` (qui devient `owner`, budget et données préservés) et retrait simple d'un membre `viewer`.
  * **Nouveaux tests Frontend (`frontend/src/__tests__/accountDeletion.test.tsx`) :**
    * Ouverture de la zone danger dans `ProfileSheet → Sécurité`, blocage du bouton tant que `SUPPRIMER` + mot de passe ne sont pas saisis, appel API `DELETE /api/auth/me` et nettoyage complet de la session, en **modes clair et sombre**.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `README.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 57 : Optimisation Mobile & Code-Splitting PWA (`React.lazy`, `manualChunks` & Zéro Warning Build) *(Performance 4G & Cache)*

- [x] **Chargement Différé des Vues & Modales Lourdes (`frontend/src/App.tsx`) :**
  * Convertir en `React.lazy()` avec `<Suspense>` les vues secondaires et tiroirs non ouverts au démarrage :
    * Vues analytiques / graphiques : `BudgetCalendarView`, `BudgetPatrimoineView`, `WrappedModal`, `TagDetailModal`.
    * Assistants et tiroirs secondaires : `OnboardingWizard`, `MonthClosingWizard`, `CsvImportSheet`, `BalanceReconcileSheet`, `WhatIfSimulatorSheet`, `GlobalSearchModal`, `ContributionCalculatorSheet`, `InvitePartnerSheet`, `BudgetSettingsSheet`, `ProfileSheet`.
  * Conditionner le montage des modales lazy à leur état d'ouverture (`isOpen && <Suspense fallback={null}>...</Suspense>`) afin que leurs chunks ne soient **jamais téléchargés** tant que l'utilisateur n'ouvre pas la fonctionnalité, tout en affichant un fallback léger discret (skeleton/spinner) pour les vues plein écran (`BudgetCalendarView`, `BudgetPatrimoineView`).
- [x] **Découpage des Chunks Vendors & Cache Longue Durée (`frontend/vite.config.ts`) :**
  * Configurer `build.rollupOptions.output.manualChunks` pour isoler les dépendances stables et éviter de tout re-télécharger à chaque déploiement :
    * `vendor-react` (`react`, `react-dom`),
    * `vendor-query` (`@tanstack/react-query`, `axios`, `zustand`),
    * `vendor-charts` (`recharts`, `d3-*`, `lodash`) — **0 Ko téléchargé au démarrage**,
    * `vendor-icons` (`lucide-react`).
  * Vérifier que `vite-plugin-pwa` (`workbox.globPatterns`) continue de pré-cacher tous les chunks JS générés en arrière-plan afin de préserver un fonctionnement **100 % hors-ligne**.
- [x] **Nettoyage des Warnings Vite (`frontend/src/App.tsx`) :**
  * Supprimer les `import()` dynamiques redondants sur `netWorth.service.ts`, `analytics.service.ts` et `auth.service.ts` (déjà importés statiquement) pour obtenir un build Vite propre sans avertissements.
- [x] **Mesure Avant / Après, Tests & Documentation :**
  * Vérifier au `npm run build --prefix frontend` la réduction significative du chunk principal initial (objectif `< 500 Ko` brut, zéro warning `Some chunks are larger than 500 kB`).
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test --prefix frontend && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `ARCHITECTURE.md` et `README.md`.


---

## Étape 58 : Durcissement Sécurité Production (JWT, `trust proxy` Render, Rate-Limit Global & En-têtes CSP) *(Audit Sécurité)*

- [x] **Backend — Révocation stricte des comptes supprimés & Algorithme JWT épinglé (`backend/src/middlewares/auth.middleware.ts`) :**
  * Dans `resolveAuthenticatedUser`, rejeter immédiatement avec HTTP `401` si `UserModel.findById(authUser.id)` retourne `null` (empêche un ancien JWT d'être accepté après suppression d'un compte via `DELETE /api/auth/me`).
  * Épingler explicitement l'algorithme `{ algorithms: ['HS256'] }` dans `jwt.verify(...)` et `{ algorithm: 'HS256' }` dans `jwt.sign(...)` pour bloquer toute attaque de confusion d'algorithme.
- [x] **Backend — `trust proxy` Render & Rate-Limiter API Global (`backend/src/app.ts`, `backend/src/middlewares/rateLimit.middleware.ts`) :**
  * Configurer `app.set('trust proxy', 1)` dans `createApp()` afin que `req.ip` reflète l'IP réelle du client derrière le reverse proxy Render/Cloudflare (évite qu'un seul utilisateur ne bloque tous les autres sur les rate-limiters).
  * Ajouter un `apiRateLimiter` global souple (ex. `300 requêtes / 15 min` par IP, configurable via `API_RATE_LIMIT_MAX`) monté sur `/api` pour protéger `/search`, `/export`, `/analytics`, `/periods` et `/transactions` contre le flood / DoS.
- [x] **Backend — Audit & Sécurisation des requêtes `$regex` (`backend/src/services/search.service.ts`) :**
  * Vérifier que tout terme utilisateur passé dans une requête MongoDB `$regex` est systématiquement échappé (`escapeRegex`) et borné en longueur pour prévenir tout risque ReDoS.
- [x] **Frontend / Hébergement — En-têtes de Sécurité & CSP (`frontend/vercel.json`) :**
  * Configurer des en-têtes HTTP de sécurité sur le déploiement frontend (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimaliste, et `Content-Security-Policy` compatible PWA / WebAuthn / Web Push / API Render).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/securityHardening.test.ts`) :**
    * Vérifier qu'un JWT valide devient immédiatement rejeté (`401`) dès que le compte est supprimé (`DELETE /api/auth/me`).
    * Vérifier que `trust proxy` résout correctement `X-Forwarded-For` pour isoler les buckets de rate-limiting entre clients distincts.
    * Vérifier l'épinglage `HS256` et le rejet `429` sur dépassement du rate-limiter global.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm test && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `ARCHITECTURE.md` et `README.md`.


---

## Étape 59 : Suivi & Mise à Jour du Solde du Compte Courant *(Manuel Pur & Confirmation Explicite)*

- [x] **Backend — Compte Courant Principal sur `AssetAccountModel` (`AssetAccount.model.ts`, `netWorth.service.ts`, `netWorth.controller.ts`, `budget.routes.ts`) :**
  * Ajouter le champ booléen optionnel `isCheckingAccount?: boolean` (défaut `false`) sur `AssetAccountModel` (garantit l'unicité avec le Patrimoine sans double comptage).
  * Créer un endpoint dédié (protégé par JWT + `assertBudgetAccess`, lecture pour tous, écriture pour `owner`/`editor`) :
    * `PUT /api/budgets/:budgetId/checking-balance` (corps Zod `{ balance: number, label?: string }`) :
      * Si un compte `isCheckingAccount: true` existe sur le budget, enregistre une opération `type: 'set'` (avec `balanceAfter`, mise à jour de `currentBalance` et ajout d'un point dans `history[]`).
      * Sinon, crée automatiquement un compte `AssetAccountModel` (`name: 'Compte courant'`, `category: 'cash'`, `icon: '🏦'`, `color: '#2563EB'`, `isCheckingAccount: true`, `currentBalance: balance`) avec son premier point d'historique et son opération initiale.
  * Exposer `checkingAccount` (id, nom, `currentBalance`, `updatedAt`) dans la réponse de `GET /api/budgets/:budgetId/net-worth`.
- [x] **Frontend — Carte « Compte courant » dans la Vue Synthèse (`CheckingAccountCard.tsx`, `UpdateCheckingBalanceSheet.tsx`, `MonthlyInsights.tsx`, `netWorth.service.ts`) :**
  * Ajouter `updateCheckingAccountBalance(budgetId, { balance, label? })` dans `frontend/src/services/netWorth.service.ts`.
  * Créer **`CheckingAccountCard.tsx`** affichée dans la vue **Synthèse** de l'onglet **Budget** (compatible modes `Essentiel` & `Avancé`, **modes clair et sombre**) :
    * Affiche le **solde actuel du compte courant** (ou un état initial *« Non renseigné »*), la date de dernière mise à jour et un bouton **`Mettre à jour`**.
  * Créer **`UpdateCheckingBalanceSheet.tsx`** (tiroir Mobile-First en **2 temps** avec confirmation obligatoire) :
    1. **Saisie :** montant via `NumericKeypad` (mode manuel pur, aucun recalcul automatique sur les transactions), avec rappel du solde actuel.
    2. **Étape de confirmation obligatoire avant enregistrement :** affichage clair d'un encart récapitulatif **`Ancien solde → Nouveau solde`** (et écart `±X €`), avec boutons **`Modifier`** et **`Confirmer la mise à jour`**.
  * Après confirmation : invalidation des caches TanStack Query (`['net-worth']`, `['analytics']`, `['calendar']`) et feedback de succès.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/checkingBalance.test.ts`) :** création automatique du compte courant au premier `PUT /checking-balance`, mise à jour suivante enregistrant une opération `set` + point `history[]`, unicité dans `GET /net-worth`, contrôle d'accès JWT (`401`) et `viewer` (`403`).
  * **Nouveaux tests Frontend (`frontend/src/__tests__/checkingBalance.test.tsx`) :** affichage de `CheckingAccountCard` dans la vue Synthèse, saisie d'un nouveau solde, vérification de l'apparition obligatoire du **message de confirmation** (`Ancien → Nouveau`) avant tout appel API, puis confirmation et mise à jour, en **modes clair et sombre**.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm test && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 60 : Indicateur « Âge de l'Argent » (*Age of Money* — Méthode FIFO) *(Pilotage & Sortie du Paie-à-Paie)*

- [x] **Backend — Service de calcul FIFO (`backend/src/services/ageOfMoney.service.ts`) & Exposition dans `/analytics` (`analytics.controller.ts`) :**
  * Créer un service pur et testable **`ageOfMoney.service.ts`** calculant l'**Âge de l'Argent** (en jours) selon l'algorithme **FIFO (First In, First Out)** sur l'historique du budget (jusqu'aux 6 derniers mois de périodes) :
    * **Entrées (*inflows*) :** revenus effectivement perçus (`EnvelopeModel` avec `pillar: 'income'` et `isPaid: true`), triés chronologiquement par date.
    * **Sorties (*outflows*) :** dépenses réelles composées des charges fixes payées (`pillar: 'fixed_charge'` et `isPaid: true`) et des dépenses variables (`TransactionModel` avec montant positif, hors remboursements/transferts internes), triées chronologiquement par date.
    * **Appariement FIFO :** chaque sortie consomme les euros disponibles dans la plus ancienne entrée non épuisée ; l'âge d'une sortie correspond au nombre de jours (borné à `>= 0`) entre la date de l'entrée consommée et la date de la sortie (moyenne pondérée si une sortie chevauche plusieurs entrées).
    * **Résultat agrégé (`AgeOfMoneyResult`) :** moyenne des âges sur les **10 dernières sorties** (`ageDays: number | null`, arrondi à l'entier), nombre de sorties analysées (`sampleSize`), seuil minimum requis (`minSamples: 10`), statut pédagogique (`'learning' | 'tight' | 'growing' | 'target_reached'`), et tendance optionnelle (`deltaDays: number | null` vs la fenêtre précédente).
    * Si `sampleSize < 10` ou aucune entrée perçue, retourner `ageDays: null` et `status: 'learning'`.
  * Exposer `ageOfMoney` dans la réponse de `GET /api/periods/:periodId/analytics` (aucune requête réseau supplémentaire côté client).
- [x] **Frontend — Affichage dans l'onglet « Budget » (`SavingsHealthCard.tsx`, `MonthlyInsights.tsx`, `api.types.ts`) :**
  * Typer `ageOfMoney` dans `frontend/src/types/budget.types.ts`.
  * Enrichir **`SavingsHealthCard.tsx`** (ou ajouter un bloc dédié harmonisé dans la vue Synthèse/Analyses de l'onglet `Budget`, compatible **modes clair et sombre** et **mode Essentiel / Avancé**) avec :
    * **Valeur principale :** `X jours` (`tabular-nums`) et **barre de progression vers l'objectif des 30 jours** (*vivre sur l'argent du mois dernier*).
    * **Badge de palier coloré :**
      * `< 15 jours` (Ambre) : *Flux tendu*
      * `15 – 29 jours` (Bleu) : *En progression*
      * `≥ 30 jours` (Vert émeraude) : *Objectif atteint (≥ 30 j)*
    * **État d'apprentissage (`learning`) :** message bienveillant *« Encore N dépense(s) pour calculer l'âge de ton argent »* (ou *« Pointez au moins un revenu perçu »*).
    * **Infobulle / popover pédagogique `ⓘ` :** explication claire en 2 phrases de la méthode FIFO et du cap des 30 jours.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/ageOfMoney.test.ts`) :**
    * Tests unitaires du moteur FIFO : cas nominal sur 1 revenu et plusieurs dépenses, chevauchement de 2 revenus consécutifs (moyenne pondérée), cap des 10 dernières sorties, état `'learning'` si `< 10` sorties ou sans revenu perçu, exclusion des revenus/charges non pointés (`isPaid: false`).
    * Test API `GET /api/periods/:periodId/analytics` vérifiant la présence et la cohérence du champ `ageOfMoney`.
  * **Nouveaux tests Frontend (`frontend/src/__tests__/ageOfMoney.test.tsx`) :** rendu des 4 états (`learning`, `< 15 j`, `15–29 j`, `≥ 30 j`), barre de progression vers 30 jours, ouverture de l'infobulle `ⓘ`, en **modes clair et sombre**.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm test && npm run build`, vérifier zéro régression et mettre à jour `ROADMAP.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 61 : Scan de Ticket de Caisse par OCR 100 % Local & Privé *(Zéro Friction & Saisie Ultra-Rapide)*

- [x] **Dépendance & Configuration Sécurité / Bundle (`frontend/package.json`, `frontend/vite.config.ts`, `frontend/vercel.json`) :**
  * Installer `tesseract.js` dans `frontend/` et **garantir un chargement 100 % paresseux** (`await import('tesseract.js')` uniquement au clic sur le bouton de scan) afin d'ajouter **`0 Ko`** au bundle initial (respect strict de l'Étape 57 : chunk principal `< 500 Ko` et zéro warning build).
  * Mettre à jour les en-têtes **Content-Security-Policy (CSP)** dans `frontend/vercel.json` (Étape 58) pour autoriser l'exécution WebAssembly & Web Worker de Tesseract (`worker-src 'self' blob:`, `'wasm-unsafe-eval'` dans `script-src`, et l'origine du CDN `tessdata_fast` si chargée en dynamique ou hébergement local des assets `.wasm`/`.traineddata.gz` dans `public/ocr/` pour un fonctionnement 100 % autonome et hors-ligne).
- [x] **Frontend — Prétraitement d'Image Mobile (`frontend/src/utils/preprocessReceiptImage.ts`) :**
  * Créer un utilitaire pur client-side prenant un `File` / `Blob` image et le préparant sur un `<canvas>` hors-écran pour maximiser la précision sur papier thermique froissé ou peu contrasté :
    * Respect de l'orientation EXIF et redimensionnement proportionnel à **`1400 px` max** de largeur (prévention des pics RAM sur iOS/Android).
    * Conversion en **niveaux de gris** (luminance pondérée) + **renforcement de contraste** (étirement d'histogramme / seuillage doux).
    * Libération explicite des `ObjectURL` et du buffer canvas après conversion (`canvas.width = 0; canvas.height = 0`) afin d'éviter toute fuite mémoire.
- [x] **Frontend — Parseur de Ticket Français (`frontend/src/utils/parseReceiptText.ts`) :**
  * Créer un module 100 % pur et unitairement testable extrayant une structure typée `ParsedReceipt { amount: number | null; candidateAmounts: number[]; merchant: string | null; date: string | null; rawText: string; confidence: 'high' | 'medium' | 'low' }` à partir du texte brut OCR :
    * **Extraction du montant total :**
      * Normalisation des séparateurs (`42,80`, `42.80`, `42, 80 €`, `EUR`, erreurs OCR classiques `O`→`0`, `l`/`I`→`1`).
      * Score prioritaire pour les lignes contenant des mots-clés de total français (`TOTAL`, `NET A PAYER`, `A PAYER`, `MONTANT TTC`, `CB`, `CARTE BANCAIRE`, `SOMME`, `REGLEMENT`).
      * Exclusion explicite des lignes parasites (`TVA`, `SOUS-TOTAL`, `RENDU`, `ESPECES`, `REMISE`, `ECONOMIE`, `POINTS`, `FIDELITE`, `CODE`, `SIRET`, `TEL`).
      * Fallback sur le montant cohérent le plus élevé du ticket (`> 0` et `< 50 000 €`) + collecte des **3 meilleurs montants candidats** (`candidateAmounts`, dédupliqués) pour correction en 1 tap.
    * **Extraction de la date :**
      * Détection des formats français `JJ/MM/AAAA`, `JJ-MM-AAAA`, `JJ.MM.AAAA`, `JJ/MM/AA` et `JJ mois AAAA` (ex. `26 nov. 2026`).
      * Garde-fou temporel (ignorer les dates incohérentes hors plage `[année courante - 2 ; aujourd'hui + 7 jours]`) et normalisation en format ISO `YYYY-MM-DD`.
    * **Extraction du marchand / libellé :**
      * Analyse des 5 premières lignes significatives en haut du ticket avec nettoyage des lignes purement numériques, numéros de téléphone, codes postaux, adresses (`RUE`, `AVENUE`, `BD`), mentions légales (`SAS`, `SARL`, `SIRET`, `RCS`, `BIENVENUE`, `MERCI`).
      * Capitalisation propre (Title Case) et croisement prioritaire avec les **`PayeeRules`** existantes (`applyPayeeRules.ts`, Étape 54) pour pré-sélectionner automatiquement l'enveloppe correspondante.
- [x] **Frontend — Service OCR & Hook React (`frontend/src/utils/receiptOcr.ts`, `frontend/src/hooks/useReceiptScanner.ts`) :**
  * Encapsuler `tesseract.js` dans `receiptOcr.ts` avec langue française (`fra`), callback de progression (`0` à `100 %`), gestion d'annulation (`AbortController` / `worker.terminate()`), timeout de sécurité (`20 s`) et terminaison systématique du worker dans un bloc `finally`.
  * Créer le hook **`useReceiptScanner.ts`** exposant `{ scanFile, cancelScan, isScanning, progress, error, lastResult, reset }` avec messages d'erreur clairs en français (fichier non image, image illisible, timeout, annulation utilisateur).
- [x] **Frontend — Intégration UI Mobile-First (`QuickAddExpenseSheet.tsx`, `AddExpenseSheet.tsx`, `ReceiptScanButton.tsx`) :**
  * Créer un composant réutilisable **`ReceiptScanButton.tsx`** (compatible **modes clair et sombre**) déclenchant un `<input type="file" accept="image/*" capture="environment" />` (accès direct caméra arrière sur iOS/Android ou galerie sur desktop, zéro permission WebRTC complexe).
  * Intégrer `ReceiptScanButton` dans **`QuickAddExpenseSheet.tsx`** (à côté du bouton micro vocal) et dans **`AddExpenseSheet.tsx`** :
    * Pendant le scan : bandeau compact avec barre de progression (`Lecture du ticket… XX %`) et bouton **`Annuler`**.
    * Après le scan : pré-remplissage non destructif des champs **Montant**, **Libellé**, **Date** et **Enveloppe** (via `PayeeRules`) — **jamais d'enregistrement automatique** sans validation visuelle de l'utilisateur.
    * Si `candidateAmounts.length > 1`, afficher une rangée de **chips cliquables** (*« Autres montants détectés : 42,80 € · 38,50 € »*) permettant de corriger le montant en 1 tap.
    * Mention discrète de confidentialité (*« Analyse 100 % locale — aucune photo n'est envoyée sur nos serveurs »*).
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests unitaires (`frontend/src/__tests__/parseReceiptText.test.ts`) :**
    * Tickets réels/simulés français variés (supermarché Carrefour/Leclerc avec `TOTAL TTC` + `TVA` + `RENDU`, restaurant avec `NET A PAYER`, boulangerie sans mot-clé `TOTAL`, erreurs OCR `42,8O`, dates `JJ/MM/AA` et `JJ/MM/AAAA`, filtrage `SIRET`/`SAS`/`RUE`, fallback `candidateAmounts`, texte vide ou illisible).
  * **Nouveaux tests UI (`frontend/src/__tests__/receiptScanner.test.tsx`) :**
    * Mock du service `receiptOcr` : sélection d'un fichier image dans `QuickAddExpenseSheet` et `AddExpenseSheet`, affichage de la progression + bouton `Annuler`, pré-remplissage automatique du montant/libellé/date/enveloppe (avec `PayeeRules`), sélection d'un montant alternatif via chip, gestion d'erreur OCR, en **modes clair et sombre**.
  * **Non-régression & Documentation :** Vérifier le poids du bundle (`npm run build --prefix frontend` sans warning `> 500 kB`), exécuter `npm run typecheck && npm test && npm run build`, et mettre à jour `ROADMAP.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 62 : Synchronisation Automatique Épargne Liée ↔ Compte Patrimonial *(Zéro Double Comptage)*

- [x] **Backend — Synchronisation par delta (`netWorth.service.ts`, `envelope.controller.ts`, `goal.controller.ts`) :**
  * Créer `syncLinkedAssetAccountForGoalDelta(goal, deltaAmount, label)` dans `backend/src/services/netWorth.service.ts` : met à jour automatiquement `currentBalance`, `history[]` et `operations[]` (`counterpartyType: 'savings_goal'`) du compte patrimonial lié (`goal.assetAccountId`) lorsqu'un objectif d'épargne est crédité ou débité.
  * Brancher la synchronisation sur tous les flux d'épargne : création, ajustement, changement de liaison et suppression d'un versement (`createEnvelope`, `updateEnvelope`, `deleteEnvelope` avec `pillar: 'savings'`) ainsi que création, modification et suppression d'un retrait (`createGoalWithdrawal`, `updateGoalWithdrawal`, `deleteGoalWithdrawal`).
  * Garantie **zéro double comptage** : `getBudgetNetWorth` ne somme que les `AssetAccount` (et `computeEmergencyFundAmount` exclut les objectifs liés à un compte `cash`), donc la fortune totale augmente exactement d'une seule fois le montant versé.
- [x] **Frontend — Rafraîchissement instantané du Patrimoine (`App.tsx`) :**
  * Invalider automatiquement le cache TanStack Query `['net-worth']` dans `syncGoalCache` dès qu'un objectif lié à un compte patrimonial (`goal.assetAccountId`) est mis à jour.
- [x] **Tests & Documentation (`savingsAssetSync.test.ts`, `ROADMAP.md`, `ARCHITECTURE.md`, `USER_GUIDE.md`) :**
  * Test d'intégration complet vérifiant versement (`1 000 → 1 200 €`, `netWorth === 1 200 €`), ajustement (`1 350 €`), retrait (`1 250 €`) et suppression (`900 €`), validé par `npm run typecheck && npm run build`.


---

## Étape 63 : Mode Essentiel / Mode Détaillé — Progressive Disclosure Global *(Simplicité au Démarrage & Contrôle Unique)*

- [x] **Principe Directeur & Périmètre Global :**
  * Utiliser la préférence existante et déjà persistée `User.preferences.budgetViewMode` (`'essential' | 'advanced'`, valeur par défaut `'essential'` pour tout nouvel utilisateur, aucune migration de base de données requise) comme interrupteur global de complexité à travers toute l'application.
  * **Point d'entrée unique :** le basculement entre **Mode essentiel** et **Mode détaillé** se fait **exclusivement** depuis le toggle dédié dans **Mon profil & préférences** (`ProfileSheet` → onglet *Préférences*). Aucun autre toggle, bouton, bannière de découverte ni suggestion automatique ne doit être affiché ailleurs dans l'interface.
  * **Garantie zéro perte de données :** repasser du *Mode détaillé* au *Mode essentiel* masque uniquement l'affichage des outils experts ; aucune donnée existante (scénarios, règles d'auto-catégorisation, rapports, opérations fractionnées, etc.) n'est supprimée ni désactivée côté serveur.
- [x] **Frontend — Point d'Entrée Unique dans `ProfileSheet` (`frontend/src/features/auth/ProfileSheet.tsx`) :**
  * Ajouter dans l'onglet **Préférences** (aux côtés du thème et de l'onglet par défaut) un contrôle clair **« Mode d'affichage »** proposant **Mode essentiel** / **Mode détaillé** (avec courte description explicative de ce qui est affiché/masqué), compatible **modes clair et sombre**.
  * Persister immédiatement le changement via `PATCH /api/auth/me` (`preferences.budgetViewMode`) et mettre à jour le store utilisateur (`useAuthStore`) sans rechargement de page.
- [x] **Frontend — Nettoyage & Filtrage de l'Onglet « Budget » (`MonthlyInsights.tsx`, `App.tsx`) :**
  * **Supprimer** le sélecteur pilule `Essentiel | Avancé` actuellement rendu en tête de `MonthlyInsights.tsx` (afin de garantir l'unicité du point d'entrée dans `ProfileSheet`).
  * **Conserver en Mode essentiel :**
    * Vues **Synthèse épurée** (*Entrées/Sorties*, *Budget quotidien*, *Bandeau Base Zéro*, *Donut Répartition*, *Compte courant* et *Bilan Foyer* si budget partagé), **Calendrier & Trésorerie** et **Patrimoine Net** (y compris la liaison Épargne ↔ Compte Patrimonial).
    * Actions **Exports PDF / CSV** et **Clôture de fin de mois**.
  * **Afficher uniquement en Mode détaillé (`budgetViewMode === 'advanced'`) :**
    * Sous-onglets **Pilotage** (*Âge de l'argent*, *Burn Rate / Projection de fin de mois*, *Avancement mois vs enveloppes*, *Enveloppes en tension*, *Dépenses atypiques*) et **Tendances** (*Tendances multi-mois*, *Simulateur « Et si… ? »*, *Eparnio Wrapped*).
    * Actions **Import CSV / OFX** et **Réconciliation de solde bancaire**.
- [x] **Frontend — Filtrage des Paramètres de l'Espace (`BudgetSettingsSheet.tsx`) :**
  * **Conserver en Mode essentiel :** nom de l'espace, jour de paie (`budgetStartDay`), gestion des membres / partage / calculateur 50-50 & prorata (si budget commun), et suppression de l'espace.
  * **Afficher uniquement en Mode détaillé (`budgetViewMode === 'advanced'`) :** **Scénarios de budget**, **Règles d'auto-catégorisation**, **Automatisation Apple Pay & Raccourcis** et **Restauration de sauvegarde JSON**.
- [x] **Frontend — Filtrage de la Saisie & des Enveloppes (`QuickAddExpenseSheet.tsx`, `AddExpenseSheet.tsx`, `CreationFormModal.tsx`) :**
  * **Conserver en Mode essentiel :** pavé numérique + mini-calculatrice, sélection d'enveloppe, favoris 1-tap, auto-complétion, **Scan de ticket OCR**, **Dictée vocale / langage naturel** et **Tags `#`**.
  * **Afficher uniquement en Mode détaillé (`budgetViewMode === 'advanced'`) :**
    * Option **« ✂️ Répartir sur plusieurs enveloppes »** (*Split Transaction*) dans `QuickAddExpenseSheet.tsx`.
    * Option **Rollover** (*« Reporter le solde au mois suivant »* — positif uniquement / positif et négatif) dans `CreationFormModal.tsx`.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Frontend (`frontend/src/__tests__/displayMode.test.tsx`) :**
    * Vérifier le basculement **Mode essentiel ↔ Mode détaillé** depuis `ProfileSheet` (persistance `PATCH /api/auth/me`, modes clair et sombre).
    * Vérifier l'absence de tout toggle `Essentiel | Avancé` dans `MonthlyInsights.tsx`.
    * Vérifier qu'en **Mode essentiel** : Calendrier, Patrimoine, OCR, Vocal et Tags `#` restent visibles, tandis que Pilotage, Tendances, Import CSV, Réconciliation, Scénarios, Règles, Apple Pay, Restauration JSON, Split Transaction et Rollover sont masqués.
    * Vérifier qu'en **Mode détaillé** : l'ensemble des outils experts réapparaît immédiatement sans perte de données.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm run test:coverage && npm run build`, vérifier zéro régression sur les tests existants (notamment `analytics.test.tsx`) et mettre à jour `ROADMAP.md`, `ARCHITECTURE.md` et `USER_GUIDE.md`.


---

## Étape 64 : Rétention & Habitude sans Culpabilisation (« Point du dimanche » & Jalons de Régularité) *(Mode Essentiel & Détaillé)*

- [x] **Backend — Service de Synthèse Hebdomadaire & Jalons (`backend/src/services/weeklyHabit.service.ts`) :**
  * **Calcul du « Point du dimanche » (`getWeeklyDigest`) :**
    * **Cap de la semaine :** `remainingToLive`, `dailyBudget` (`Y € / jour`), `remainingDays` et statut de rythme bienveillant (`'serene' | 'watch' | 'adjust'` — ton constructif, jamais culpabilisant).
    * **Charges fixes des 7 prochains jours :** filtrer les `EnvelopeModel` (`pillar: 'fixed_charge'`, `isPaid: false`) dont la date d'échéance tombe dans les 7 prochains jours, avec montant total à prévoir.
    * **Enveloppes à surveiller (top 2 max) :** identifier les 1 à 2 enveloppes variables dont le taux de consommation dépasse le plus l'avancement du mois.
    * **Note positive dynamique :** générer 1 phrase valorisante basée sur les données réelles (montant épargné du mois, part de charges fixes déjà passées ou budget équilibré à `0 €`).
  * **Calcul des Jalons de Régularité (`getHabitMilestones`) — 100 % automatique, sans streak quotidien punitif :**
    * **Équilibre Base Zéro :** `1`, `3`, `6` mois équilibrés à `0 €` (cumulés, jamais remis à zéro).
    * **Matelas de sécurité :** `1`, `3`, `6` mois de charges fixes couverts (réutilisation de `computeEmergencyFundAmount`).
    * **Régularité douce :** `4`, `12` semaines de suivi actif (au moins 1 saisie ou pointage dans la semaine).
    * **Épargne :** premier versement enregistré, premier objectif atteint (`currentAmount >= targetAmount`).
    * **Sérénité de trésorerie :** Âge de l'argent `≥ 30 jours` (réutilisation d'`ageOfMoney.service.ts`).
    * Retourner pour chaque jalon : `id`, `category`, `title`, `description`, `unlocked`, `progress` (`0` à `100`), `currentValue`, `targetValue`.
  * **Exposition API (`GET /api/budgets/:budgetId/weekly-digest` & préférences d'alerte) :**
    * Exposer `digest` et `milestones` sur un endpoint protégé par JWT + `assertBudgetAccess`.
    * Étendre `User.notificationPreferences` avec `weeklyDigestEnabled` (défaut `false`), `weeklyDigestDay` (`0–6`, défaut `0` = dimanche) et `weeklyDigestHour` (défaut `'18:00'`), modifiable via `PATCH /api/notifications/preferences`.
- [x] **Frontend — Rituel « Point du dimanche » (`WeeklyDigestSheet.tsx` & `WeeklyDigestCard.tsx`) :**
  * **Visible dès le Mode essentiel** (et en Mode détaillé) dans l'onglet **`Budget`**.
  * Créer une carte compacte **`WeeklyDigestCard.tsx`** dans l'onglet `Budget` donnant un aperçu rapide (météo de rythme + nombre d'échéances de la semaine) et ouvrant **`WeeklyDigestSheet.tsx`** en 1 tap.
  * Dans **`WeeklyDigestSheet.tsx`** (lisible en 30 secondes, compatible **modes clair et sombre**) :
    1. Bloc *Cap de la semaine* (reste à vivre, `Y € / jour`, badge de rythme doux),
    2. Bloc *Charges fixes des 7 prochains jours* avec pointage rapide `✓` en 1 tap,
    3. Bloc *Enveloppes à surveiller* (top 2 max) avec lien direct vers l'enveloppe,
    4. Encart de clôture positif.
  * Ajouter le réglage opt-in **« Point du dimanche »** (activation et heure) dans `ProfileSheet → Alertes`.
- [x] **Frontend — Gamification Douce (`HabitMilestonesCard.tsx`) :**
  * **Visible dès le Mode essentiel** (et en Mode détaillé) dans l'onglet **`Budget`**.
  * Afficher les jalons débloqués (badges sobres) et la barre de progression vers le prochain palier à atteindre — aucune pop-up bloquante ni compteur punitif.
  * Support complet des **modes clair et sombre**.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/weeklyHabit.test.ts`) :** calcul du digest (charges à 7 jours, top 2 enveloppes, note positive) et calcul des jalons cumulés sans remise à zéro punitive.
  * **Nouveaux tests Frontend (`frontend/src/__tests__/weeklyHabit.test.tsx`) :** rendu de `WeeklyDigestCard`, `WeeklyDigestSheet` (y compris pointage `✓` d'une charge fixe et navigation enveloppe) et `HabitMilestonesCard`.
  * **Non-régression & Documentation :** Mise à jour de `ROADMAP.md` et `USER_GUIDE.md`.


---

## Étape 65 : Épuration du Mode Essentiel & Suppression du Doublon `StreakBadgeCard` *(Lisibilité en 1 Scroll)*

- [x] **Suppression complète de `StreakBadgeCard` & `WeeklyRecapSheet` (`App.tsx`) :**
  * Retirer `StreakBadgeCard`, `WeeklyRecapSheet`, l'état `isWeeklyRecapOpen` et la query `streakQuery` de `App.tsx` (remplacés avantageusement par **Point du dimanche** et **Mes jalons de régularité** de l'Étape 64).
  * Nettoyer les imports devenus inutilisés afin d'éviter tout code mort.
- [x] **Épuration de `Budget > Synthèse` en Mode Essentiel (`MonthlyInsights.tsx`, `App.tsx`) :**
  * **Retirer `ExportActionsCard`** de `Budget > Synthèse` en Mode essentiel (les exports PDF/CSV restent accessibles à tout moment dans *Paramètres de l'espace `•••` → onglet Données* et en Mode détaillé).
  * **Affichage contextuel de « Clôture de fin de mois » :** en Mode essentiel, n'afficher la carte de clôture que dans les **5 derniers jours du cycle** (`analytics.dailyBudget.daysRemaining <= 5`) ou si la période est déjà clôturée (`isPeriodClosed`) ; elle reste toujours visible en Mode détaillé.
  * **Masquer `CheckingAccountCard` (*Compte courant*)** dans `Budget > Synthèse` en Mode essentiel (le compte courant reste accessible en 1 tap dans la vue **Patrimoine** déjà visible en Mode essentiel, et dans `Synthèse` en Mode détaillé).
- [x] **Résultat cible en Mode Essentiel (`Budget > Synthèse`) :**
  * Écran épuré lisible en 1 scroll : `Point du dimanche`, `Entrées et sorties d'argent`, `Budget quotidien`, `Bandeau Base Zéro`, `Répartition Fixe/Variable/Épargne`, `Tags` *(si utilisés)*, `Mes jalons de régularité` *(+ `Bilan Foyer` si budget partagé, et `Clôture` uniquement dans les 5 derniers jours)*.
- [x] **Tests & Documentation (`displayMode.test.tsx`, `ROADMAP.md`) :**
  * Mettre à jour `displayMode.test.tsx` pour vérifier : absence de `ExportActionsCard` en Mode essentiel, affichage conditionnel de la clôture (`daysRemaining <= 5` vs `> 5`), et présence en Mode détaillé.


---

## Étape 66 : Indicateur « Solde Estimé en Compte » (Hors Dépenses Fixes Futures) *(Pointage Réel & Réconciliation)*

- [x] **Calcul pur (`frontend/src/utils/activeBalance.ts`) :**
  * Implémenter `computeActiveAccountBalance(envelopes, summary)` calculant le solde actif estimé sur le compte bancaire : `Revenus perçus (✓) − Dépenses fixes payées (✓) − Épargne du mois − Dépenses variables saisies`, ainsi que le total des charges fixes payées et à venir.
- [x] **Affichage combiné Option A + B (Modes Essentiel & Détaillé) :**
  * **Onglet `Dépenses` (`FixedChargesList.tsx`) :** encart compact **Solde estimé en compte** juste sous la jauge `Reste à dépenser`, avec sous-ligne `Payées : X € · À venir : Y €` mise à jour en direct au pointage `✓`.
  * **Onglet `Budget > Synthèse` (`CashFlowSummaryCard.tsx` & `MonthlyInsights.tsx`) :** ligne dédiée **Solde estimé en compte** sous `Restant`, avec mention `Hors Y € de charges à venir`.
- [x] **Mise à jour & Réconciliation du Solde (`App.tsx`, `CheckingAccountCard`, `BalanceReconcileSheet`) :**
  * Alimenter `CheckingAccountCard` et `BalanceReconcileSheet` avec le **solde actif estimé** (sans les dépenses fixes futures) au lieu du reste à vivre prévisionnel.
- [x] **Documentation (`ROADMAP.md`, `USER_GUIDE.md`) :** Mise à jour du manuel utilisateur et de la roadmap.


---

## Étape 67 : Suppression d’Opérations Patrimoniales & Assainissement du Calendrier *(Zéro Pollution & Zéro Doublon)*

- [x] **Backend — Suppression d'une opération patrimoniale (`netWorth.service.ts`, `netWorth.controller.ts`, `budget.routes.ts`) :**
  * Ajouter `deleteAssetOperation(budgetId, assetId, operationId, userId)` et l'endpoint `DELETE /api/budgets/:budgetId/assets/:assetId/operations/:operationId` : supprime l'opération erronée de `operations[]`, recalcule `currentBalance` et met à jour `history[]` afin que l'erreur disparaisse du patrimoine et du calendrier.
- [x] **Backend — Assainissement du Calendrier (`calendar.service.ts`) :**
  * Ne plus impacter la courbe de trésorerie (`netRealized`) par les mouvements purement patrimoniaux (`pillar === 'asset'` → `0` dans `getSignedAmount`).
  * Exclure `counterpartyType === 'savings_goal'` des événements `asset` du calendrier (déjà comptés dans le pilier `savings`, évitant tout doublon).
- [x] **Frontend — Bouton supprimer dans l'historique patrimonial (`BudgetPatrimoineView.tsx`, `netWorth.service.ts`) :**
  * Ajouter un bouton `🗑️` sur chaque ligne d'opération dans l'historique plein écran d'un compte patrimonial, avec rafraîchissement immédiat du patrimoine et du calendrier.
- [x] **Documentation (`ROADMAP.md`, `USER_GUIDE.md`) :** Mise à jour de la roadmap et du manuel utilisateur.


---

## Étape 68 : Correctifs de Cohérence Mongoose, Historique Patrimoine & Nettoyage Code Mort *(Fiabilité & Hygiène)*

- [x] **Backend — Persistance Mongoose de `defaultTab` & `weeklyDigest*` (`backend/src/models/User.model.ts`) :**
  * Ajouter `defaultTab` (`enum: ['revenus', 'depenses', 'enveloppes', 'epargne', 'budget']`, défaut `'depenses'`) dans `userPreferencesSchema` afin que l'onglet d'ouverture par défaut choisi dans `ProfileSheet` soit bien persisté en base.
  * Ajouter `weeklyDigestEnabled` (`Boolean`, défaut `false`), `weeklyDigestDay` (`Number`, défaut `0`) et `weeklyDigestHour` (`String`, défaut `'18:00'`) dans le sous-schéma `notificationPreferences` de `userSchema` afin que les préférences du *Point du dimanche* ne soient plus ignorées en mode strict Mongoose.
- [x] **Backend — Nettoyage de `account.history[]` lors de la suppression d'une opération patrimoniale (`backend/src/services/netWorth.service.ts`) :**
  * Dans `deleteAssetOperation`, retirer de `account.history[]` les points correspondant à la date de l'opération supprimée (ou reconstruire proprement le point du jour concerné à partir des opérations restantes) afin qu'aucun pic fantôme ne persiste sur le graphique d'évolution du patrimoine.
- [x] **Nettoyage du code mort résiduel (suite à l'Étape 65) :**
  * Supprimer les composants UI orphelins `frontend/src/features/analytics/StreakBadgeCard.tsx` et `frontend/src/features/analytics/WeeklyRecapSheet.tsx` (supprimés à l'Étape 72 après vérification qu'aucun test ne les importe).
- [x] **Validation & Documentation :** Mise à jour de `ROADMAP.md`.


---

## Étape 69 : Audit & Résolution de 6 Incohérences Métier, Cache & Typage *(Qualité & Fiabilité)*

- [x] **Alignement du calcul de mise à jour du compte courant (`backend/src/controllers/netWorth.controller.ts`) :**
  * Dans `updateCheckingBalanceHandler`, calculer `delta` par rapport au **solde actif** (`Revenus perçus ✓ − Charges fixes payées ✓ − Épargne − Variables`) au lieu de `remainingToLive`, en cohérence totale avec l'affichage frontend.
- [x] **Prise en compte des `tags` à l'édition d'une transaction (`backend/src/controllers/transaction.controller.ts`) :**
  * Appliquer et normaliser `payload.tags` dans `updateTransaction` avant `transaction.save()`.
- [x] **Prise en compte de `rolloverAmount` dans la jauge « Reste dans les enveloppes » (`frontend/src/features/budget/EnvelopesList.tsx`) :**
  * Inclure la somme des `rolloverAmount` des enveloppes dans `remainingInEnvelopes` pour correspondre exactement à la somme des restants des tuiles `PastelEnvelopeCard`.
- [x] **Invalidations TanStack Query complètes (`frontend/src/App.tsx`, `frontend/src/features/budget/BudgetPatrimoineView.tsx`) :**
  * Invalider `['period']` et `['transactions', periodId]` lors du déplacement d'une transaction entre enveloppes (`updateTransactionMutation`), `['net-worth']` dans `deleteGoalMutation`, `['calendar']` dans `BudgetPatrimoineView`, ainsi que `['calendar']`, `['trends']`, `['tags-summary']`, `['period-anomalies']`, `['weekly-habit']` et `['transaction-suggestions']`.
- [x] **Alignement des contrats TypeScript (`backend/src/models/User.model.ts`, `frontend/src/types/budget.types.ts`) :**
  * Ajouter `notificationPreferences` dans `UserResponse` et `sharedActivityAlertEnabled` / `weeklyDigest*` dans `UserProfile.notificationPreferences`.


---

## Étape 70 : Application Android (Capacitor Mode Hybride), Widgets d'Écran d'Accueil & Accès Prod Limité *(Distribution Privée Hors Play Store)*

> 📖 **Guide manuel complet (macOS → APK) :** Voir [ANDROID_APK_GUIDE.md](./ANDROID_APK_GUIDE.md) pour la procédure pas à pas de compilation, signature, partage et installation de l'APK.

- [x] **Backend — Verrouillage Optionnel d'Inscription en Production (`backend/src/config/env.ts`, `backend/src/controllers/auth.controller.ts`, `backend/.env.example`) :**
  * Ajouter une variable d'environnement optionnelle `REGISTRATION_INVITE_CODE` (chaîne vide par défaut = inscriptions ouvertes en dev).
  * Lorsque `REGISTRATION_INVITE_CODE` est renseignée, exiger un champ `inviteCode` correspondant dans `POST /api/auth/register` (comparaison à temps constant via `crypto.timingSafeEqual`, retour HTTP `403` si manquant ou invalide) et exposer `registrationRequiresInviteCode: boolean` via `GET /api/auth/config` afin que le frontend n'affiche le champ « Code d'accès » que si nécessaire.
- [x] **Frontend — Champ Code d'Accès & Socle Capacitor Android (`frontend/package.json`, `frontend/capacitor.config.ts`, `frontend/src/features/auth/AuthScreen.tsx`) :**
  * Installer `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` et `@capacitor/app` dans `frontend/`.
  * Créer `frontend/capacitor.config.ts` en **Mode Hybride** (`appId: 'com.eparnio.app'`, `appName: 'Eparnio'`, `webDir: 'dist'`, `server.url` piloté par `VITE_CAPACITOR_SERVER_URL` pointant vers l'URL Vercel de production) afin que toutes les mises à jour React déployées sur Vercel soient instantanément disponibles sans réinstaller l'APK, tout en conservant un fonctionnement **100 % identique sur navigateur / PWA (PC, iOS, Android Chrome)**.
  * Générer le projet natif `frontend/android/` (`npx cap add android`) et ajouter les scripts npm `android:sync` et `android:open` dans `frontend/package.json`.
- [x] **Frontend — Deep-Link Natif & Pont Widgets (`frontend/src/utils/androidWidgetBridge.ts`, `frontend/src/App.tsx`, `frontend/src/utils/quickAddDeepLink.ts`) :**
  * Étendre `quickAddDeepLink.ts` pour supporter le paramètre `mode=voice | ocr` (en plus de `amount`, `label`, `envelope`, `tags`) et déclencher automatiquement la dictée vocale ou le sélecteur de scan de ticket à l'ouverture de `QuickAddExpenseSheet`.
  * Écouter `App.addListener('appUrlOpen', ...)` (via `@capacitor/app`, uniquement si `Capacitor.isNativePlatform()`) dans `App.tsx` pour intercepter les liens natifs `eparnio://quick-add`, `eparnio://quick-add?mode=voice` et `eparnio://quick-add?mode=ocr`.
  * Créer `androidWidgetBridge.ts` enregistrant le plugin `WidgetBridge` (`registerPlugin`) et exposant `syncAndroidWidgetData({ dailyBudget, remainingToLive, daysRemaining, budgetName, isNegative })` (no-op silencieux sur navigateur web) appelé automatiquement dès que les données de période / analytics sont mises à jour.
- [x] **Android Natif (`frontend/android-widgets/` + `frontend/scripts/setup-android-widgets.sh`) — Plugin & 2 Widgets d'Écran d'Accueil :**
  * **Deep-Link (`AndroidManifest.xml`) :** Déclarer l'`<intent-filter>` pour le schéma `eparnio://quick-add` sur `MainActivity`.
  * **Pont natif (`WidgetBridgePlugin.kt` + `MainActivity.kt`) :** Stocker le JSON de synthèse dans `SharedPreferences` (`eparnio_widget_prefs`) et diffuser `AppWidgetManager.ACTION_APPWIDGET_UPDATE` vers `DailyBudgetWidgetProvider`.
  * **Widget 1 — « Mon Budget du Jour » (4×2) :** `DailyBudgetWidgetProvider.kt`, `res/layout/widget_daily_budget.xml` et `res/xml/widget_daily_budget_info.xml` affichant le **Budget du jour (`Y € / jour`)**, le **Reste à vivre (`X € · N j restants`)**, le nom du budget actif et un bouton bleu **`+`** ouvrant `eparnio://quick-add`.
  * **Widget 2 — « Saisie Express » (4×1) :** `QuickActionsWidgetProvider.kt`, `res/layout/widget_quick_actions.xml` et `res/xml/widget_quick_actions_info.xml` proposant 3 boutons directs : **`+` Dépense** (`eparnio://quick-add`), **`🎤` Voix** (`eparnio://quick-add?mode=voice`) et **`📷` Ticket** (`eparnio://quick-add?mode=ocr`).
  * Déclarer les deux `<receiver>` dans `AndroidManifest.xml` et exclure les fichiers sensibles (`*.jks`, `*.keystore`, `*.apk`) dans `.gitignore`.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Backend (`backend/src/__tests__/registrationInvite.test.ts`) :** Vérifier `POST /api/auth/register` avec `REGISTRATION_INVITE_CODE` actif (rejet `403` sans code ou mauvais code, succès `201` avec bon code) et inactif (inscription libre).
  * **Nouveaux tests Frontend (`frontend/src/__tests__/androidWidgetBridge.test.tsx`) :** Vérifier que `syncAndroidWidgetData` est un no-op sûr sur navigateur web, appelle `WidgetBridge.updateWidgetData` sur plateforme native mockée, et que `parseQuickAddUrlParams` gère `eparnio://quick-add?mode=voice` et `?mode=ocr`.
  * **Non-régression & Documentation :** Exécuter `npm run typecheck && npm test && npm run build`, vérifier que le déploiement Web/PWA reste 100 % intact et mettre à jour `ROADMAP.md`, `README.md` et `ANDROID_APK_GUIDE.md`.


---

## Étape 71 : Widget Android « Mes Enveloppes » (4×2) — Suivi Temps Réel & Saisie Directe par Enveloppe *(Confort Quotidien)*

> **Objectif :** Permettre de consulter en un coup d'œil le montant restant de ses enveloppes variables principales depuis l'écran d'accueil Android (avant de passer en caisse) et d'ajouter une dépense directement dans l'enveloppe concernée en 1 tap.

- [x] **Frontend — Contrat de Données & Synchronisation des Enveloppes (`frontend/src/utils/androidWidgetBridge.ts`, `frontend/src/App.tsx`) :**
  * Étendre `AndroidWidgetPayload` avec un tableau optionnel `envelopes?: AndroidWidgetEnvelopeItem[]` contenant pour chaque enveloppe : `id`, `name`, `icon` (emoji), `color`, `allocated` (plafond + `rolloverAmount`), `spent`, `remaining` et `percentUsed` (0 à 100+).
  * Créer un helper pur `selectTopWidgetEnvelopes(envelopes, limit = 4)` sélectionnant jusqu'à **4 enveloppes prioritaires** (triées par activité / taux de consommation ou ordre utilisateur, en incluant `rolloverAmount` dans le calcul du disponible) et les transmettre dans `syncAndroidWidgetData(...)` à chaque mise à jour de la période ou d'une transaction.
  * Étendre `parseQuickAddUrlParams` (`frontend/src/utils/quickAddDeepLink.ts`) et l'écouteur `appUrlOpen` dans `App.tsx` pour supporter `eparnio://quick-add?envelopeId=<id>&budgetId=<budgetId>` : basculer automatiquement sur le bon budget si nécessaire puis ouvrir directement la saisie de dépense pré-affectée à l'enveloppe tapée.
- [x] **Android Natif — Stockage Multi-Budgets & Diffusion (`WidgetBridgePlugin.kt`) :**
  * Enregistrer le tableau JSON `envelopes` dans chaque entrée budget de `budgetsJson` (`SharedPreferences` `eparnio_widget_prefs`) afin de conserver les enveloppes propres à chaque budget (*Budget Perso*, *Budget Commun*, etc.).
  * Diffuser `AppWidgetManager.ACTION_APPWIDGET_UPDATE` vers `EnvelopesWidgetProvider` en plus de `DailyBudgetWidgetProvider` à chaque appel de `updateWidgetData`, et synchroniser le switch multi-budgets (`selectedBudgetId`).
- [x] **Android Natif — Widget 3 « Mes Enveloppes » (4×2) (`EnvelopesWidgetProvider.kt`, layouts, drawables & Manifest) :**
  * Créer `EnvelopesWidgetProvider.kt`, `res/layout/widget_envelopes.xml`, `res/xml/widget_envelopes_info.xml` (taille 4×2 redimensionnable) et les drawables de barres de progression (`widget_progress_green.xml` < 80 %, `widget_progress_amber.xml` 80–99 %, `widget_progress_red.xml` ≥ 100 % ou solde négatif).
  * **Design UI/UX (Design System Eparnio / One UI) :**
    * Fond de carte premium `widget_bg_card` (dégradé blanc → lavande `#F5F3FF`, coins `26dp`, bordure `#E9D5FF`).
    * En-tête : mini icône Eparnio + badge pilule violet **`Nom du budget  ⇄`** cliquable pour switcher entre les budgets sans ouvrir l'app + résumé discret du total restant dans les enveloppes.
    * Liste compacte de **3 à 4 lignes d'enveloppes** (visibilité dynamique `View.GONE` si moins de 4 enveloppes) : emoji + nom en gras + **montant restant** aligné à droite (vert `#16A34A`, ambre `#D97706` ou rouge `#EF4444`) + `ProgressBar` horizontale fine (`4dp`).
    * État vide élégant (*« Créez vos enveloppes dans Eparnio »*) lorsque le budget n'a pas encore d'enveloppe variable.
  * **Interactions tactiles :**
    * Tap sur une ligne d'enveloppe → `PendingIntent` vers `eparnio://quick-add?envelopeId=<id>&budgetId=<budgetId>` (saisie directe dans cette enveloppe).
    * Tap sur le badge `Nom du budget  ⇄` → broadcast `ACTION_SWITCH_ENVELOPES_BUDGET` pour basculer sur le budget suivant sans ouvrir l'app.
    * Tap sur le fond / en-tête → ouverture d'Eparnio sur l'onglet **Enveloppes**.
  * Déclarer le `<receiver android:name=".EnvelopesWidgetProvider">` dans `frontend/android/app/src/main/AndroidManifest.xml`, copier les templates dans `frontend/android-widgets/` et mettre à jour `frontend/scripts/setup-android-widgets.sh`.
- [x] **Tests (Nouveaux tests & Non-régression) & Documentation :**
  * **Nouveaux tests Frontend (`frontend/src/__tests__/androidWidgetBridge.test.tsx`) :** Tester `selectTopWidgetEnvelopes` (tri, limite à 4, calcul avec `rolloverAmount`, gestion dépassement > 100 %), la transmission de `envelopes` à `WidgetBridge.updateWidgetData`, et le parsing de `eparnio://quick-add?envelopeId=...&budgetId=...`.
  * **Non-régression & Vérification :** Exécuter `npm run typecheck && npm test && npm run build`, tester le rendu et les taps (switch budget + ajout rapide par enveloppe) sur téléphone Android (One UI).
  * **Documentation :** Mettre à jour `ROADMAP.md`, `ANDROID_APK_GUIDE.md` (passage à 3 widgets d'écran d'accueil) et `USER_GUIDE.md`.


---

## Étape 72 : Hygiène Technique, Nettoyage du Code Mort & Refactorisation Modulaire de `App.tsx` *(Maintenabilité)*

> **Objectif :** Assainir la base de code avant les prochaines fonctionnalités (Mode Sombre, Confidentialité, etc.) en supprimant les composants orphelins et en découpant `frontend/src/App.tsx` (~1 900 lignes) en hooks métier dédiés, sans aucune régression fonctionnelle.

- [x] **Nettoyage du Code Mort (reliquat Étape 68) :**
  * Vérifier les références et supprimer les composants UI orphelins `frontend/src/features/analytics/StreakBadgeCard.tsx` et `frontend/src/features/analytics/WeeklyRecapSheet.tsx` (ainsi que leurs éventuels imports ou tests obsolètes).
  * Cocher la case correspondante dans l'Étape 68 de `ROADMAP.md`.
- [x] **Extraction de Hooks Métier depuis `frontend/src/App.tsx` (`frontend/src/hooks/`) :**
  * **`useAndroidWidgetSync.ts` :** Isoler la logique de calcul et de synchronisation vers les widgets Android (`syncAndroidWidgetData`, `selectTopWidgetEnvelopes`, calcul `daysRemaining` / `dailyBudget`).
  * **`useQuickAddDeepLink.ts` :** Isoler l'écoute des deep-links Web (`/quick-add`), `sessionStorage` en attente et natifs Android (`subscribeNativeAppUrlOpen`), incluant le basculement automatique sur `budgetId` et la pré-sélection par `envelopeId` dans `QuickAddExpenseSheet`.
- [x] **Validation & Non-Régression Complète :**
  * Exécuter `npm run typecheck && npm test && npm run build` (Frontend) et vérifier que les tests et le build PWA passent sans régression.
  * Mettre à jour `ROADMAP.md`.
