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
  * Calculer le **matelas de sécurité** en mois de charges fixes (`totalSavingsGoals / plannedFixedCharges`, ex. *« 3,2 mois de charges fixes d'avance »*).
- [x] **Top enveloppes en tension (`EnvelopesAtRiskCard.tsx`) :**
  * Identifier et afficher les 2 à 3 enveloppes dont le taux de consommation dépasse le plus l'avancement du mois.
- [x] **Tests & Documentation :**
  * Tests unitaires sur les formules et tests UI des 3 cartes (modes clair et sombre) dans `advancedIndicators.test.tsx`.
  * Mise à jour de `ROADMAP.md`, `ARCHITECTURE.md` et `README.md`, puis validation `npm run typecheck && npm run test:coverage && npm run build`.

---

## Étape 23 : Améliorations Budget Commun (Équilibrage, Apports 1-Tap, Charges Fixes & Activité)

- [x] **« Qui doit à qui » & Régularisation (`MemberBreakdownCard.tsx`, `analytics.controller.ts`) :**
  * Calculer et afficher la phrase de régularisation entre membres (*« X doit Y € à Z pour équilibrer le mois »*) avec bouton **« Marquer comme réglé »**.
- [ ] **Génération en 1 tap des apports depuis le calculateur (`ContributionCalculatorSheet.tsx`) :**
  * Permettre d'appliquer directement la répartition 50/50 ou Prorata en créant/mettant à jour les lignes d'apports (`income`) de chaque membre sur la période active.
- [x] **« Payé par… » sur les dépenses fixes (`CreationFormModal.tsx`, `analytics.controller.ts`) :**
  * Associer un membre payeur sur les `fixed_charge` en budget commun et l'intégrer dans `memberBreakdown`.
- [x] **Fil d'activité récente du foyer (`SharedActivityCard.tsx`) :**
  * Afficher les dernières actions du foyer (*ajout de dépense, versement, pointage*) dans l'onglet `Budget`.
- [x] **Tests & Documentation :**
  * Tests UI sur l'équilibrage (`computeSettlementSuggestion`, `MemberBreakdownCard`) et `SharedActivityCard` dans `sharedSettlementAndActivity.test.tsx`.
  * Mise à jour de `ROADMAP.md` et `ARCHITECTURE.md`, puis validation `npm test --prefix frontend && npm run build`.
