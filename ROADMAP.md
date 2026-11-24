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
