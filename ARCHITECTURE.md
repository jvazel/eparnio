# Architecture Technique & Structure du Projet — Eparnio

> **Application :** **Eparnio** (Gestion budgétaire personnelle et partagée, méthode Budget Base Zéro, Mobile-First / PWA)
> **Principe structurant :** Séparation stricte entre le **Frontend** (`frontend/`) et le **Backend** (`backend/`), communiquant via une **API REST JSON** sécurisée par JWT et connectée à **MongoDB**.

---

## 1. Vue d'ensemble de la Stack Technique

### 1.1. Frontend (`frontend/`) — Web App Mobile-First & PWA
* **Framework & Langage :** React 18+ avec TypeScript
* **Build Tool :** Vite (`vite-plugin-pwa` pour l'installation sur écran d'accueil iOS/Android, icônes et manifeste PWA)
* **Styling :** Tailwind CSS (configuré avec les *Design Tokens* d'Eparnio : mode clair/sombre, typographie `tabular-nums`, zones tactiles mobile)
* **Navigation :** React Router
* **Gestion des données serveur & HTTP :** TanStack Query (`@tanstack/react-query`) + Axios (cache, invalidation automatique après ajout d'une transaction, gestion du token JWT)
* **État client global :** Zustand (budget actif Perso/Commun, période mensuelle sélectionnée, thème)
* **Icônes & Visualisations :** Lucide React (icônes UI) + Recharts (graphiques Donut et comparatifs prévu vs réel pour l'onglet Analyses)
* **Tests & Couverture :** Vitest + `@vitest/coverage-v8` + React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`) + `jsdom`

### 1.2. Backend (`backend/`) — API REST & Logique Métier
* **Runtime & Framework :** Node.js + Express + TypeScript
* **Base de données & ODM :** MongoDB + Mongoose
* **Validation des entrées :** Zod (schémas stricts sur les payloads HTTP et paramètres)
* **Authentification & Sécurité :**
  * `jsonwebtoken` (JWT Access Token valable `24h`, révocable via `tokenVersion`)
  * `bcryptjs` (hachage des mots de passe et de la clé de récupération `recoveryKeyHash`)
  * `helmet` (`strict-origin-when-cross-origin`, `x-powered-by` désactivé) & `cors` (contrôle d'origine strict vers le frontend)
  * Rate limiting en mémoire (`rateLimit.middleware.ts`) sur l'authentification et la jonction par code d'invitation
  * `dotenv` & Zod (`parseEnvConfig` bloquant les secrets par défaut ou `< 32` caractères en `production`)
* **Tests & Couverture :** Vitest + `@vitest/coverage-v8` + Supertest + `mongodb-memory-server` (tests unitaires et d'intégration API isolés)

### 1.3. Base de données, Orchestration & Environnement Local
* **Orchestrateur racine (`Eparnio/package.json`) :** `concurrently` permettant de lancer simultanément le frontend et le backend via `npm run dev`, et de piloter les vérifications globales (`npm test`, `npm run test:coverage`, `npm run typecheck`, `npm run build`).
* **MongoDB :** Conteneurisé localement via `docker-compose.yml` (ou connecté à un cluster **MongoDB Atlas** en production).
* **Outils transverses :** TypeScript strict dans les deux dossiers, ESLint / Prettier.

---

## 2. Arborescence Détaillée du Projet (`Eparnio/`)

```text
Eparnio/
├── package.json                        # Orchestrateur racine (dev simultané front+back, test, coverage, typecheck)
├── docker-compose.yml                  # Base MongoDB liée à 127.0.0.1:27017 en local
├── .gitignore                          # Exclusions Git (node_modules, .env, dist, coverage...)
├── AGENTS.md                           # Instructions globales et spécifications de référence du projet
├── README.md                           # Guide de démarrage rapide (Docker, npm run dev, tests)
├── ROADMAP.md                          # Roadmap de développement étape par étape (Étapes 1 à 8)
├── SPECIFICATIONS_EPARNIO.md           # Cahier des charges fonctionnel, UX & Design System
├── ARCHITECTURE.md                     # Ce document d'architecture technique
│
├── backend/                            # API REST Node.js + Express + TypeScript + Mongoose
│   ├── AGENTS.md                       # Règles d'architecture et de tests backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts                # Config Vitest & seuils de couverture v8 backend
│   ├── .env.example                    # PORT, MONGO_URI, JWT_*, BCRYPT_*, INVITE_*, RATE_LIMIT_*, SMTP_*, JSON_BODY_LIMIT
│   └── src/
│       ├── app.ts                      # Configuration Express (CORS, Helmet, JSON, routes, erreurs)
│       ├── server.ts                   # Connexion MongoDB puis démarrage du serveur HTTP
│       ├── config/
│       │   ├── db.ts                   # Connexion Mongoose & gestion des événements
│       │   └── env.ts                  # Chargement et validation Zod stricte (parseEnvConfig, prod >= 32 car., SMTP)
│       ├── models/                     # Schémas & Modèles Mongoose
│       │   ├── User.model.ts           # Profil, préférences, tokenVersion, recoveryKeyHash/Hint & resetEmailCodeHash/ExpiresAt
│       │   ├── Budget.model.ts         # Budget perso/commun, membres, inviteCode & inviteExpiresAt (24h)
│       │   ├── BudgetPeriod.model.ts   # Cycle mensuel et agrégats (Reste à vivre, Base Zéro)
│       │   ├── Envelope.model.ts       # Piliers (revenus, dépenses fixes, enveloppes, épargne)
│       │   ├── Transaction.model.ts    # Dépenses/revenus saisis au fil de l'eau
│       │   └── SavingsGoal.model.ts    # Objectifs d'épargne pluriannuels
│       ├── controllers/                # Gestion des requêtes/réponses HTTP
│       │   ├── auth.controller.ts
│       │   ├── budget.controller.ts
│       │   ├── period.controller.ts
│       │   ├── envelope.controller.ts
│       │   ├── transaction.controller.ts
│       │   ├── goal.controller.ts
│       │   └── analytics.controller.ts
│       ├── services/                   # Logique métier pure et calculs financiers
│       │   ├── budgetAccess.service.ts     # Contrôle d'accès membre/propriétaire par budget et période
│       │   ├── zeroBasedBudget.service.ts  # Calcul du "Reste à attribuer" (Base Zéro = 0 €)
│       │   ├── remainingToLive.service.ts  # Recalcul temps réel du "Reste à vivre / Reste à dépenser"
│       │   ├── periodRollover.service.ts   # Reconduction automatique des récurrents et enveloppes
│       │   ├── invite.service.ts           # Génération/validation d'invitations et calcul 50/50 & prorata
│       │   └── email.service.ts            # Client SMTP natif TLS/STARTTLS (code reset gratuit Gmail)
│       ├── routes/                     # Définition des endpoints REST
│       │   ├── index.ts                # Montage global sous /api
│       │   ├── auth.routes.ts
│       │   ├── budget.routes.ts
│       │   ├── period.routes.ts
│       │   ├── envelope.routes.ts
│       │   ├── transaction.routes.ts
│       │   └── goal.routes.ts
│       ├── middlewares/
│       │   ├── auth.middleware.ts      # Vérification JWT (TTL 24h) + tokenVersion en base et req.user
│       │   ├── rateLimit.middleware.ts # Limitation de débit anti-brute-force (auth & /join)
│       │   ├── validate.middleware.ts  # Validation Zod des body / query / params
│       │   └── error.middleware.ts     # Format uniforme des erreurs API
│       └── __tests__/                  # Tests unitaires et d'intégration Supertest + mongodb-memory-server
│
└── frontend/                           # Web App Mobile-First React + TypeScript + Vite + Tailwind
    ├── AGENTS.md                       # Règles Mobile-First, Design System et tests frontend
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts                  # Proxy /api -> backend + configuration vite-plugin-pwa + Vitest
    ├── vitest.config.ts                # Config Vitest & seuils de couverture v8 frontend
    ├── tailwind.config.js              # Design tokens Eparnio (couleurs, polices, ombres)
    ├── postcss.config.js               # Configuration PostCSS / Tailwind CSS
    ├── index.html                      # Balises viewport mobile-first & meta PWA
    ├── .env.example                    # VITE_API_URL, VITE_PORT, VITE_API_PROXY_TARGET
    ├── public/
    │   └── manifest.webmanifest        # Métadonnées d'installation PWA (nom Eparnio, thème)
    └── src/
        ├── main.tsx                    # Point d'entrée React + QueryClientProvider
        ├── App.tsx                     # Définition des routes et protection authentifiée
        ├── index.css                   # Directives Tailwind & utilitaires (tabular-nums, safe-area)
        ├── vite-env.d.ts               # Déclarations de types Vite
        ├── components/
        │   ├── ui/                     # Briques du Design System Eparnio (calibrées sur captures)
        │   │   ├── Card.tsx
        │   │   ├── RingGauge.tsx       # Jauge circulaire SVG (Reste à dépenser / Reste enveloppes)
        │   │   ├── DonutChart.tsx      # Graphique Donut (Revenus, Épargne, Analyses) + switch €/%
        │   │   ├── ProgressBar.tsx     # Barre de progression linéaire fine (objectifs d'épargne)
        │   │   ├── PastelEnvelopeCard.tsx # Tuile pastel 2 colonnes (anneau icône + Montant/Restant)
        │   │   ├── CheckableListCard.tsx  # Carte horizontale avec pastille ✓ verte/grise + récurrence
        │   │   ├── BottomSheet.tsx     # Tiroir modal tactile glissant depuis le bas
        │   │   ├── Button.tsx
        │   │   ├── Badge.tsx
        │   │   ├── PillarInfoPopover.tsx # Bulle/tiroir pédagogique au clic sur ⓘ Section
        │   │   └── NumericKeypad.tsx   # Pavé numérique ergonomique au pouce
        │   └── layout/                 # Squelette Mobile-First
        │       ├── MobileShell.tsx     # Conteneur centré mobile (max-w-md sur desktop)
        │       ├── TopHeader.tsx       # Avatar violet + "Bonjour Prénom" + bouton portefeuille (BudgetSwitcher)
        │       ├── PeriodSelector.tsx  # Pilule blanche < Mois Année > + titre ⓘ Section
        │       ├── BudgetSwitcher.tsx  # Overlay BudgetSwitcherOverlay + cartes Espace Budget
        │       ├── BottomNav.tsx       # 5 onglets (Revenus, Dépenses, Enveloppes, Epargne, Budget) en violet actif
        │       └── QuickAddButton.tsx  # FAB (+) bleu bas-droite (crée Revenu / Charge fixe / Enveloppe / Objectif)
        ├── features/                   # Modules fonctionnels découplés
        │   ├── auth/
        │   │   ├── AuthScreen.tsx          # Connexion / Inscription (démarrage à 0,00 €)
        │   │   ├── OnboardingWizard.tsx    # Onboarding Base Zéro (jour de cycle, premiers pas)
        │   │   └── ProfileSheet.tsx        # Profil utilisateur, avatar, mot de passe & déconnexion
        │   ├── budget/
        │   │   ├── ZeroBasedBanner.tsx         # Bandeau "Reste à attribuer" (objectif 0 €)
        │   │   ├── EnvelopesList.tsx           # Grille 2 colonnes de tuiles pastel
        │   │   ├── FixedChargesList.tsx        # Charges fixes & pointage Payée/À venir
        │   │   ├── IncomeList.tsx              # Sources de revenus du cycle
        │   │   ├── BudgetSettingsSheet.tsx     # Paramètres de l'espace (••• : nom, jour de cycle, suppression)
        │   │   ├── CreationFormModal.tsx       # Modale de création/édition (trio d'icônes, pavé numérique, 11 pastilles)
        │   │   ├── SharedFormFields.tsx        # Champs partagés (nom, date, récurrence, membre payeur/apporteur)
        │   │   ├── SectionManageHeader.tsx     # En-tête de section avec mode gestion rapide (⚙️)
        │   │   └── EnvelopeFormSheet.tsx       # Création / édition d'enveloppe (depuis le FAB +)
        │   ├── transactions/
        │   │   ├── EnvelopeDetailSheet.tsx     # Tiroir détail d'une enveloppe (au tap sur une tuile pastel)
        │   │   ├── AddExpenseSheet.tsx         # Saisie de dépense avec NumericKeypad intégré au BottomSheet
        │   │   └── TransactionHistory.tsx      # Historique filtrable par enveloppe
        │   ├── savings/
        │   │   ├── SavingsGoalsList.tsx        # Cagnottes & objectifs d'épargne
        │   │   └── GoalDetailSheet.tsx         # Détail et ajout de versement
        │   ├── analytics/
        │   │   ├── CashFlowSummaryCard.tsx   # Carte "Entrées et sorties d'argent" (5 lignes + Restant)
        │   │   ├── DailyBudgetCard.tsx       # Carte "Gestion du budget quotidien" (X jours & Y €/jour)
        │   │   ├── AllocationDonut.tsx       # Carte "Part des dépenses" (Fixe Violet / Variable Bleu / Épargne Vert)
        │   │   ├── MemberBreakdownCard.tsx   # Bilan apports vs dépenses par membre (budget commun)
        │   │   └── MonthlyInsights.tsx       # Suivi complémentaire Base Zéro / Évolution
        │   └── shared-budget/
        │       ├── InvitePartnerSheet.tsx      # Partage gratuit : lien d'invitation, SMS natif (sms:) et accès QR Code
        │       ├── QrCodeModal.tsx             # Affichage SVG du QR Code scannable généré 100 % côté client
        │       ├── ContributionCalculatorSheet.tsx # Calculateur d'apport équitable (50/50 ou Prorata)
        │       └── MembersList.tsx             # Liste, couleurs et gestion des membres du budget
        ├── services/                   # Couche d'accès API (découplée de l'UI)
        │   ├── api.ts                  # Instance Axios + intercepteur JWT
        │   ├── auth.service.ts
        │   ├── budget.service.ts
        │   ├── period.service.ts
        │   ├── envelope.service.ts
        │   ├── transaction.service.ts
        │   ├── goal.service.ts
        │   └── analytics.service.ts
        ├── store/
        │   ├── useAuthStore.ts         # Utilisateur connecté & token JWT
        │   └── useBudgetStore.ts       # ID du budget actif et de la période active
        ├── types/
        │   ├── budget.types.ts         # Modèles TypeScript métier (Envelope, Period, etc.)
        │   └── api.types.ts            # Formats de réponses et erreurs API
        ├── utils/
        │   ├── format.ts               # Formatage monétaire EUR (fr-FR), dates FR & validateStrongPassword
        │   ├── lightTheme.ts           # Référentiel figé des tokens & palettes du Thème Clair par défaut
        │   └── qrCode.ts               # Générateur matriciel QR Code ISO 18004 SVG côté client (0 dépendance)
        └── __tests__/                  # Configuration RTL/jsdom et tests de non-régression UI
```

---

## 3. Contrat d'API REST Principal (Frontend ↔ Backend)

Toutes les routes (hors authentification publique et santé) sont montées sous `/api` et protégées par le middleware JWT (`Authorization: Bearer <token>`), avec vérification systématique que l'utilisateur appartient au `budgetId` demandé.

### 3.1. Authentification (`/api/auth`)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Inscription avec mot de passe fort (8+ car., majuscule, minuscule, chiffre), génération d'une clé de récupération `EPAR-XXXX-XXXX` et création du budget personnel (protégé par `authRateLimiter`). |
| `POST` | `/api/auth/login` | Connexion et délivrance du token JWT `24h` lié au `tokenVersion` (protégé par `authRateLimiter`). |
| `GET` | `/api/auth/me` | Récupération du profil (incluant `recoveryKeyHint`) et des préférences (`budgetStartDay`, `currency`, `theme`). |
| `PATCH` | `/api/auth/me` | Mise à jour du profil (`displayName`, `avatarEmoji`) et des préférences (`budgetStartDay`, `theme`). |
| `POST` | `/api/auth/password/forgot` | Envoie un code de réinitialisation à 6 chiffres (valable 15 min) par e-mail via SMTP Gmail gratuit (protégé par `authRateLimiter`, réponse neutre anti-énumération). |
| `PATCH` | `/api/auth/password` | Mise à jour sécurisée du mot de passe (exige `currentPassword`, `recoveryKey` ou `emailCode` à 6 chiffres ; incrémente `tokenVersion` pour révoquer les anciens JWT ; protégé par `authRateLimiter`). |
| `POST` | `/api/auth/recovery-key` | Régénère une nouvelle clé de récupération personnelle et invalide immédiatement la précédente. |

### 3.2. Budgets & Partage (`/api/budgets`)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/budgets` | Liste les budgets de l'utilisateur (personnels et partagés). |
| `POST` | `/api/budgets` | Crée un nouveau budget (`personal` ou `shared`). |
| `PATCH` | `/api/budgets/:id` | Renomme un budget ou modifie son `budgetStartDay`. |
| `DELETE` | `/api/budgets/:id` | Supprime un espace budgétaire secondaire (réservé au `owner`) avec suppression en cascade des périodes, enveloppes, transactions et objectifs liés. |
| `POST` | `/api/budgets/:id/invite` | Génère ou régénère le `inviteCode` unique et son échéance `inviteExpiresAt` (24h). |
| `POST` | `/api/budgets/join/:inviteCode` | Permet à un partenaire de rejoindre le budget partagé (renvoie HTTP `410` si expiré ; protégé par `inviteJoinRateLimiter`). |
| `PATCH` | `/api/budgets/:id/contribution-split` | Met à jour le mode de répartition (`equal_50_50`, `income_prorata`, `custom`) et les revenus déclarés des membres pour calculer les apports. |
| `DELETE` | `/api/budgets/:id/members/:userId` | Retire un membre d'un budget partagé (réservé au `owner` ou départ volontaire). |

### 3.3. Cycles Budgétaires (`/api/budgets/:budgetId/periods`)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/budgets/:budgetId/periods/current` | Récupère la période active (selon `budgetStartDay`) ou la crée automatiquement en reconduisant les récurrents et enveloppes de la période précédente. |
| `GET` | `/api/budgets/:budgetId/periods/by-month` | Récupère (ou crée automatiquement par reconduction des récurrents et enveloppes) la période correspondant au mois sélectionné (`< Mois Année >`). |
| `POST` | `/api/budgets/:budgetId/periods` | Crée manuellement une période budgétaire (`startDate`, `endDate`). |
| `POST` | `/api/budgets/:budgetId/periods/:periodId/rollover` | Force la duplication/reconduction des postes récurrents et enveloppes vers la période suivante. |
| `POST` | `/api/budgets/:budgetId/periods/:periodId/close` | Clôture la période (`closedAt`), applique les choix de surplus (`rollover_next_month`, `transfer_to_goal`, `reset_zero`), ajuste/reconduit le mois suivant et bloque une double clôture (`409`). |

### 3.4. Enveloppes & Piliers (`/api/periods/:periodId/envelopes`)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/periods/:periodId/envelopes` | Liste les postes classés par pilier (`income`, `fixed_charge`, `variable_envelope`, `savings`). |
| `POST` | `/api/periods/:periodId/envelopes` | Ajoute une nouvelle enveloppe, dépense fixe, revenu ou versement épargne et recalcule `remainingToAllocate` et `remainingToLive`. |
| `PATCH` | `/api/periods/:periodId/envelopes/reorder` | Réorganise l'ordre d'affichage des postes d'un pilier (champ `order` via `orderedIds`). |
| `PATCH` | `/api/periods/:periodId/envelopes/:id` | Met à jour le montant alloué, l'icône, la couleur, la récurrence ou le statut `isPaid`. |
| `DELETE` | `/api/periods/:periodId/envelopes/:id` | Supprime un poste budgétaire et met à jour les agrégats de la période. |

### 3.5. Transactions (`/api/periods/:periodId/transactions`)
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/periods/:periodId/transactions` | Historique des transactions de la période (filtrable par `envelopeId`, `type`, `authorId`). |
| `POST` | `/api/periods/:periodId/transactions` | Enregistre une dépense/entrée, incrémente `spentOrPaidAmount` de l'enveloppe et recalcule en temps réel `remainingToLive` dans `BudgetPeriod`. |
| `PATCH` | `/api/periods/:periodId/transactions/:id` | Modifie le montant, le libellé, la date ou `paidByUserId` d'une transaction existante et recalcule `spentOrPaidAmount` et `remainingToLive`. |
| `DELETE` | `/api/periods/:periodId/transactions/:id` | Supprime une transaction et rétablit automatiquement les montants sur l'enveloppe et la période. |

### 3.6. Objectifs d'Épargne & Analyses
| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/budgets/:budgetId/goals` | Gestion des objectifs d'épargne pluriannuels (`savings_goals`). |
| `POST` / `PATCH` / `DELETE` | `/api/budgets/:budgetId/goals/:id/withdrawals(/:withdrawalId)` | Enregistrement, édition et suppression des retraits sur une cagnotte d'épargne sans impacter le `remainingToLive` de la période active. |
| `GET` | `/api/periods/:periodId/analytics` | Renvoie la synthèse Base Zéro, le reste quotidien, les pourcentages par pilier et le bilan par membre (si budget partagé). |
| `GET` | `/api/budgets/:budgetId/export/csv` | Exporte les mouvements au format CSV UTF-8 avec BOM (`;` Excel), filtrable par `periodId` ou `year`, avec protection anti-injection de formules CSV et `X-Content-Type-Options: nosniff`. |
| `GET` | `/api/budgets/:budgetId/export/json` | Exporte une sauvegarde JSON complète de l'espace budgétaire (métadonnées, périodes, enveloppes, transactions, objectifs et retraits). |

---

## 4. Communication, Commandes & Tests en Développement Local

En local, les 3 briques restent strictement découplées tout en offrant un pilotage unifié depuis la racine `Eparnio/` :

| Service | Port / URL locale | Rôle & Configuration |
| :--- | :--- | :--- |
| **Frontend (Vite + React)** | `http://localhost:5173` | Interface Mobile-First / PWA. `vite.config.ts` configure un proxy `/api` redirigeant automatiquement vers `http://localhost:4000` pour éviter tout problème CORS en dev. |
| **Backend (Express API)** | `http://localhost:4000` | Expose les routes `/api/*`. Autorise `http://localhost:5173` via `CORS_ORIGIN`. |
| **Base de données (MongoDB)** | `mongodb://localhost:27017/eparnio` | Lancée via `docker-compose up -d` à la racine du projet. |

### Commandes unifiées à la racine (`Eparnio/package.json`)
| Commande | Action exécutée |
| :--- | :--- |
| `npm run dev` | Lance **simultanément** le backend (`http://localhost:4000`) et le frontend (`http://localhost:5173`) via `concurrently` (logs colorés et préfixés `[API]` / `[WEB]`). |
| `npm test` | Exécute l'ensemble des suites de tests automatisés de non-régression (`backend` puis `frontend`). |
| `npm run test:coverage` | Exécute tous les tests et génère les rapports de **couverture de code** (`@vitest/coverage-v8`) pour le backend et le frontend. |
| `npm run typecheck` | Vérifie la compilation TypeScript stricte (`tsc --noEmit`) côté `backend` et `frontend`. |
| `npm run build` | Compile les builds de production `backend` et `frontend`. |

---

## 5. Sécurité & Durcissement (Étape 8)

* **Authentification & Révocation (`auth.controller.ts` / `auth.middleware.ts` / `email.service.ts`) :**
  * Mots de passe robustes exigés (`8` caractères minimum avec majuscule, minuscule et chiffre), hachés avec `bcryptjs`.
  * Clé de récupération personnelle **100 % gratuite** au format `EPAR-XXXX-XXXX` générée à l'inscription (`recoveryKeyHash` haché en base, indice masqué dans `recoveryKeyHint`, affichage éphémère hors `localStorage` + téléchargement `.txt` côté client) et régénérable via `POST /api/auth/recovery-key`.
  * Code de secours gratuit par e-mail via `POST /api/auth/password/forgot` et le client SMTP natif (`email.service.ts`, compatible Gmail `smtp.gmail.com:465` / `587`) : code à 6 chiffres haché (`resetEmailCodeHash`), valable 15 minutes (`410` au-delà), bloqué après 5 essais erronés (`429`).
  * Réinitialisation impossible sans preuve : `PATCH /api/auth/password` exige `currentPassword`, `recoveryKey` ou `emailCode`, et incrémente `tokenVersion` pour invalider immédiatement tous les JWT existants (TTL réduit à `24h`).
* **Limitation de débit & En-têtes HTTP (`rateLimit.middleware.ts` / `app.ts`) :**
  * `authRateLimiter` (20 requêtes / 15 min) sur `/api/auth/register`, `/login`, `/password`, `/password/forgot` et `inviteJoinRateLimiter` (15 requêtes / 15 min) sur `/api/budgets/join/:inviteCode`, renvoyant `429` + en-tête `Retry-After`.
  * `x-powered-by` désactivé et `helmet` configuré avec `referrerPolicy: 'strict-origin-when-cross-origin'`.
* **Variables d'environnement configurables (`backend/.env` & `frontend/.env`) :**
  * *Backend (`backend/src/config/env.ts`)* : `PORT`, `NODE_ENV`, `MONGO_URI`, `CORS_ORIGIN`, `JSON_BODY_LIMIT` (`1mb`), `JWT_SECRET`, `JWT_EXPIRES_IN` (`24h`), `BCRYPT_SALT_ROUNDS` (`10`), `INVITE_CODE_TTL_HOURS` (`24`), `RATE_LIMIT_WINDOW_MINUTES` (`15`), `AUTH_RATE_LIMIT_MAX` (`20`), `INVITE_RATE_LIMIT_MAX` (`15`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TIMEOUT_MS` (`15000`), `PASSWORD_RESET_CODE_TTL_MINUTES` (`15`) et `PASSWORD_RESET_MAX_ATTEMPTS` (`5`).
  * *Frontend (`frontend/vite.config.ts` & `api.ts`)* : `VITE_API_URL` (`/api`), `VITE_PORT` (`5173`) et `VITE_API_PROXY_TARGET` (`http://localhost:4000`).
* **Invitations éphémères, Intégrité & Infrastructure :**
  * Codes et QR Codes d'invitation dotés d'une expiration configurable (`INVITE_CODE_TTL_HOURS`, `24h` par défaut ; `inviteExpiresAt`, HTTP `410` au-delà, régénérables en 1 clic).
  * Suppression en cascade des périodes, enveloppes, transactions et objectifs liés dans `DELETE /api/budgets/:id`.
  * Port MongoDB local restreint à `127.0.0.1:27017:27017` dans `docker-compose.yml` et validation stricte de `JWT_SECRET` (`>= 32` caractères hors valeur de dev) en mode `production` via `parseEnvConfig`.

---

## 6. Évolutions Mobile & Visualisation (Étapes 9 à 12)

* **Page dédiée Enveloppe (`EnvelopeDetailPage.tsx`) :** Vue plein écran contrôlée par état remplaçant la popin, avec `RingGauge` des dépenses, édition/suppression au tap sur chaque ligne et réglages (`⚙️`).
* **Détails des enveloppes dans Budget (`EnvelopeBreakdownCard.tsx`) :** Synthèse `Budget réparti`, `Budget consommé`, `Reste à dépenser` et Donut de répartition des dépenses par enveloppe (avec état vide).
* **Rollover des enveloppes variables (`periodRollover.service.ts`) :** Report optionnel du solde d'un mois sur l'autre (`rolloverEnabled`, `rolloverMode`: `positive_only` | `both`, `rolloverAmount`, `previousEnvelopeId`), exclu du `Reste à répartir` (Base Zéro) et propagé dynamiquement en cas de modification rétroactive.
* **Filtres & tri rapide (`ListFilterBar.tsx`) :** Recherche instantanée, tri et sous-total dynamique sur les dépenses fixes (`FixedChargesList.tsx`) et les dépenses variables (`EnvelopeDetailPage.tsx`, avec filtre par membre en budget partagé).
* **Projection de fin de mois (`PaceProjectionCard.tsx`) :** Calcul du rythme de dépense (`burnRate`), date estimée de passage en négatif et solde projeté en fin de cycle dans l'onglet `Budget`.
* **Saisie express vocale & langage naturel (`parseNaturalExpense.ts`, `useSpeechRecognition.ts`, `QuickAddExpenseSheet.tsx`) :** Parsing 100 % local (montants FR, dates relatives, enveloppe directe ou via historique `suggestions`, `#tags`, payeur en budget commun) + dictée vocale Web Speech API avec dégradation élégante.
* **Indicateurs avancés de pilotage (`MonthVsEnvelopesCard.tsx`, `SavingsHealthCard.tsx`, `EnvelopesAtRiskCard.tsx`) :** Comparatif avancement du mois vs enveloppes, taux d'épargne, matelas de sécurité (combinant comptes patrimoniaux `cash` / liquidités et objectifs d'épargne non liés sans double comptage) et top enveloppes en tension dans l'onglet `Budget`.
* **Équilibrage & activité partagée (`MemberBreakdownCard.tsx`, `SharedActivityCard.tsx`) :** Calcul « Qui doit à qui » (`computeSettlementSuggestion`) avec bouton *Marquer comme réglé* et fil d'activité récente du foyer dans l'onglet `Budget`.
* **Installation PWA Mobile (`usePwaInstall.ts` / `PwaInstallBanner.tsx`) :** Interception de `beforeinstallprompt` (Android/Chrome) et guide iOS Safari (`Partager → Sur l'écran d'accueil`), masqué automatiquement en mode `standalone`.
* **Connexion Biométrique (`webauthn.controller.ts` / `@simplewebauthn/server` & `@simplewebauthn/browser`) :**
  * Endpoints `POST /api/auth/webauthn/register/options`, `POST /api/auth/webauthn/register/verify`, `DELETE /api/auth/webauthn/credentials`, `POST /api/auth/webauthn/login/options` et `POST /api/auth/webauthn/login/verify`.
  * Activation depuis `ProfileSheet` et connexion Face ID / Empreinte depuis `AuthScreen`.
* **Anticipation des dépenses annuelles (*Sinking Funds*, `sinkingFund.ts`) :** Calcul automatique de la mensualité conseillée selon l'échéance (`deadline`) dans `GoalFormSheet` et affichage du badge (`Conseillé`, `Objectif atteint`, `Échéance dépassée`) sur `SavingsGoalCard`.
* **Rappels & Notifications PWA (`useReminders.ts`) :** Activation/désactivation des rappels locaux de saisie (quotidien / hebdomadaire) depuis `ProfileSheet` via l'API `Notification`.
* **Mode Hors-Ligne (`offlineQueue.ts`, `useOfflineSync.ts`, `OfflineBanner.tsx`) :** Détection réseau, mise en file locale des actions hors-ligne et synchronisation automatique au retour de la connexion.
* **Tendances multi-mois (`GET /api/budgets/:budgetId/trends?months=N`, `TrendsCard.tsx`) :** Historique mensuel paramétrable depuis le frontend (`1` à `36` mois) avec graphique en barres et filtres (`Tout` / `Variables` / `Épargne`).
* **Remboursements, Notes & Calcul live du Rollover (Étape 24 — `AddExpenseSheet.tsx`, `TransactionHistory.tsx`, `EnvelopeDetailPage.tsx`, `remainingToLive.service.ts`) :** Prise en compte de `rolloverAmount` dans la prévisualisation live de saisie, support des remboursements (`type: 'income'`) créditant l'enveloppe et le `memberBreakdown` (y compris en crédit net `< 0`, avec gardes analytiques `>= 0` sur le Donut), champ `notes` (300 car. max) éditable/effaçable et filtrable, et affichage distinctif en modes clair et sombre.
* **Retraits sur cagnottes d'épargne (Étape 25 — `SavingsGoal.model.ts`, `goal.controller.ts`, `GoalWithdrawalSheet`, `SavingsGoalsList.tsx`) :** Sous-documents `withdrawals[]` sur `SavingsGoal`, endpoints `/goals/:id/withdrawals`, recalcul de `currentAmount` (`initialAmount + totalContributions - totalWithdrawals`, borné à `>= 0`) sans impact sur `plannedSavings` / `remainingToLive`, bouton `−` sur `SavingsGoalCard`, aperçu live du solde et gestion complète dans l'accordéon en modes clair et sombre.
* **Sous-onglets Budget & Garde-fou Base Zéro (Étape 26 — `MonthlyInsights.tsx`, `ZeroBasedBanner.tsx`, `App.tsx`) :** Restructuration de l'onglet `Budget` derrière une barre de sous-onglets pilules accessibles (`Essentiel`, `Pilotage`, `Tendances`, `Foyer` en budget partagé) avec navigation clavier (`ArrowLeft`/`ArrowRight`/`Home`/`End`), mémorisation `sessionStorage` (`BUDGET_SUBTAB_STORAGE_KEY`) et état vide `Tendances` ; enrichissement de `ZeroBasedBanner` avec le mode sombre complet, le raccourci **« Auto-équilibrer à 0 € »** en 1 tap (vers enveloppe variable ou objectif d'épargne) lorsque `remainingToAllocate > 0` et l'alerte explicite de sur-allocation avec boutons d'ajustement rapide (`onNavigateToTab`).
* **Récurrences avancées & Échéancier (Étape 27 — `Envelope.model.ts`, `periodRollover.service.ts`, `CreationFormModal.tsx`, `FixedChargesList.tsx`, `CheckableListCard.tsx`) :** Ajout de `recurrenceFrequency` (`monthly` / `quarterly` / `semiannual` / `yearly`), `recurrenceEndDate` et `recurrenceRemainingCount` avec reconduction par intervalle (y compris lors de la navigation mois par mois), décrémentation des mensualités et arrêt automatique à échéance ; formulaire étendu dans `CreationFormModal`, badges discrets dans `CheckableListCard` et vue **Échéancier chronologique** par date avec sous-totaux et bascule *Inclure payées* dans `FixedChargesList` en modes clair et sombre.
* **Rituel guidé de clôture de fin de mois (Étape 28 — `BudgetPeriod.model.ts`, `period.controller.ts`, `periodRollover.service.ts`, `MonthClosingWizard.tsx`, `PeriodSelector.tsx`, `MonthlyInsights.tsx`) :** Champ `closedAt` sur `BudgetPeriod` et endpoint `POST /api/budgets/:budgetId/periods/:periodId/close` appliquant en une passe les décisions sur les surplus d'enveloppes (`rollover_next_month`, `transfer_to_goal`, `reset_zero`), les ajustements $M+1$ et le recalcul des objectifs liés ; entrée **« Clôturer le mois »** et badge `Clôturé` ouvrant l'assistant Mobile-First en 3 étapes (`1. Bilan`, `2. Surplus`, `3. Mois suivant`) en modes clair et sombre.
* **Exports CSV / PDF & Sauvegarde JSON (Étape 29 — `export.controller.ts`, `exportReport.ts`, `ExportActionsCard.tsx`, `BudgetSettingsSheet.tsx`, `MonthlyInsights.tsx`) :** Endpoints sécurisés `/budgets/:budgetId/export/csv` (UTF-8 BOM, filtrage `periodId`/`year`, neutralisation des formules `=`, `+`, `-`, `@`, `\t`) et `/export/json` ; générateur binaire PDF 1.4 multi-pages 100 % client (`generatePeriodPdfBytes`, zéro sink HTML) et déclencheurs **« Exporter en CSV (Excel) »**, **« Télécharger le bilan PDF »** et **« Sauvegarde complète (.json) »** en modes clair et sombre.
* **Vue Calendrier & Trésorerie Prévisionnelle (Étape 37 — `calendar.service.ts`, `analytics.controller.ts`, `BudgetCalendarView.tsx`, `CalendarGrid.tsx`, `CashFlowProjectionChart.tsx`, `CalendarDaySheet.tsx`) :** Endpoint `GET /api/periods/:periodId/calendar` agrégeant opérations réalisées, échéances à venir/en retard, opérations patrimoniales (`asset`), courbe de trésorerie projetée et échéances périodiques sur 3 mois ; switcher `Synthèse | Calendrier | Patrimoine` dans `Budget`, grille en mode **carte de chaleur**, bandeau résumé des échéances (`⚠️ en retard` / `⏳ à venir`) + raccourci **« Aujourd’hui »**, filtre `DropdownSelect` par pilier, tiroir jour (`Mardi 24 novembre 2026`).
* **Notifications Push PWA (Étape 38 — `PushSubscription.model.ts`, `pushNotification.service.ts`, `notification.controller.ts`, `NotificationsSettingsSection.tsx`) :** Abonnements Web Push VAPID, scheduler `node-cron` (rappels quotidiens, échéances J-2, seuils d'enveloppe ≥ 80 %), nettoyage `410 Gone` et réglages dans `ProfileSheet`.
* **Simulateur « Et si… ? » (Étape 39 — `whatIfSimulator.ts`, `WhatIfSimulatorSheet.tsx`) :** Simulation éphémère (ponctuel, mensuel, `Nx`) avec calcul Avant/Après, badge de faisabilité et conversion en vraie transaction ou charge fixe.
* **Eparnio Wrapped (Étape 40 — `annualWrapped.service.ts`, `WrappedModal.tsx`) :** Endpoint `GET /api/budgets/:budgetId/wrapped?year=YYYY` et carrousel « Stories » en 5 slides incluant épargne, enveloppes phares, score Base Zéro et Patrimoine Net.
* **Détecteur d'écarts & Auto-équilibrage Base Zéro (Étapes 41–42 — `fixedChargeVariance.service.ts`, `zeroBasedAutoBalance.service.ts`, `AutoBalanceSheet.tsx`) :** Comparaison `N` vs `N-1` (`↗` / `↘`) sur charges fixes/revenus, et équilibrage guidé en 1 tap (`GET /auto-balance/suggestion`, `POST /auto-balance/apply`).
* **Patrimoine Net, Opérations & Transferts (Étapes 43–45 — `AssetAccount.model.ts`, `netWorth.service.ts`, `BudgetPatrimoineView.tsx`, `DropdownSelect.tsx`, `exportReport.ts`) :** Suivi `Actifs − Passifs`, liaison `N → 1` avec `SavingsGoal` (`assetAccountId`), opérations/transferts (`external`, `asset`, `savings_goal`, `budget_period`), historique plein écran, export PDF enrichi du patrimoine, et sélecteurs tactiles unifiés (`DropdownSelect` / `PillSelect`).

* **Recherche Globale Multi-Mois (Étape 35 — `search.service.ts`, `search.controller.ts`, `GlobalSearchModal.tsx`) :** Endpoint `GET /api/budgets/:id/search` interrogeant en parallèle `TransactionModel` (`label`, `notes`, `amount`) et `EnvelopeModel` (`name`, `allocatedAmount`) avec index `{ budgetId: 1, date: -1 }`, modale plein écran avec flèche retour, debounce 250 ms, filtres rapides, groupement par mois/année et navigation directe.
* **Propagation & Synchronisation des Récurrences (`periodRollover.service.ts`, `period.controller.ts`, `FixedChargesList.tsx`) :** Propagation automatique des nouveaux revenus/dépenses fixes récurrents vers les périodes futures déjà créées (`propagateRecurringEnvelopeToFuturePeriods`) et endpoint `POST /api/budgets/:budgetId/periods/:periodId/sync-recurring` exposé via le bouton **« Reconduire le mois précédent »**.
* **Feedback Haptique (`haptics.ts`) :** Utilitaire `triggerHaptic('light' | 'medium' | 'success')` branché sur `NumericKeypad`, `CheckableListCard` et les formulaires de saisie.
* **Restauration & Import JSON v2 (Étape 51 — `jsonImport.service.ts`, `export.controller.ts`, `JsonImportSheet.tsx`, `export.service.ts`) :** Export JSON `schemaVersion: 2` incluant `assets[]` (rétrocompatible v1), endpoints `POST /api/budgets/import/json/preview`, `POST /api/budgets/import/json` (`create_new` avec rollback compensatoire) et `POST /api/budgets/:budgetId/import/json` (`replace_existing`, `owner` uniquement) avec limite dédiée `10 Mo`, `importRateLimiter`, protection anti-injection `$`/`.`, remapping déterministe des `ObjectId` et recalcul d'intégrité post-import.
* **Scénarios & Modèles de Budget (Étape 52 — `BudgetTemplate.model.ts`, `budgetTemplate.service.ts`, `budgetTemplate.controller.ts`, `BudgetTemplatesSheet.tsx`) :** CRUD `/api/budgets/:budgetId/templates` (création manuelle ou snapshot `sourcePeriodId` en 1 tap) et `POST /api/periods/:periodId/apply-template` (`dryRun: true` pour aperçu Avant/Après obligatoire). Cible `variable_envelope` + `savings` en montants fixes (€), met à `0 €` les enveloppes absentes du scénario sans les supprimer ni altérer `income`/`fixed_charge`/`rolloverAmount`, avec sélecteur tactile en 1 tap des enveloppes actives.
* **Synchronisation Temps Réel SSE & Notifications Partagées (Étape 53 — `realtime.service.ts`, `realtime.controller.ts`, `useBudgetRealtimeSync.ts`, `RealtimeToast.tsx`) :** Flux `GET /api/budgets/:budgetId/events` (JWT via header `Authorization: Bearer`, en-têtes anti-buffering Render/Cloudflare `no-transform` + `X-Accel-Buffering: no`, heartbeat 25 s) actif sur tous les budgets, client résilient `fetch` + `ReadableStream` (backoff exponentiel + pause/reprise `visibilitychange`/`online`) invalidant TanStack Query en direct, et préférence Push `sharedActivityAlertEnabled` (défaut `true`).
* **Règles d'Auto-Catégorisation (`Payee Rules`, Étape 54 — `PayeeRule.model.ts`, `payeeRule.controller.ts`, `applyPayeeRules.ts`, `PayeeRulesSheet.tsx`) :** CRUD + réordonnancement `/api/budgets/:budgetId/payee-rules`, moteur pur NFD insensible à la casse/accents (`contains`/`starts_with`/`exact`, `autoExcludeFromImport`, `extractSuggestedPattern`) et testeur de libellé en direct.
* **Refonte ergonomique des Paramètres (`BudgetSettingsSheet.tsx` & `ProfileSheet.tsx`) :** Organisation en 3 onglets segmentés (`Général | Membres | Données` pour l'espace budget ; `Profil | Sécurité | Alertes` pour le profil utilisateur) en modes clair et sombre.
* **Deep-Link Quick-Add, Web Share Target & Raccourcis PWA (Étape 55 — `manifest.webmanifest`, `quickAddDeepLink.ts`, `ApplePayShortcutGuideSheet.tsx`) :** Déclaration `share_target` (`/quick-add`) et `shortcuts` (*Dépense rapide*) dans le manifeste PWA, parseur sécurisé `/quick-add` (mode structuré Apple Pay/Raccourcis + mode texte libre `parseNaturalExpense`, persistance `sessionStorage`, nettoyage `replaceState`, zéro soumission automatique) et guide intégré dans `BudgetSettingsSheet`.
* **Suppression de Compte RGPD (Étape 56 — `accountDeletion.service.ts`, `auth.controller.ts`, `ProfileSheet.tsx`) :** Endpoint `DELETE /api/auth/me` (protégé par JWT, `authRateLimiter`, vérification `currentPassword` + `confirmation: 'SUPPRIMER'`) supprimant en cascade les budgets personnels et les abonnements Push, transférant automatiquement la propriété des budgets partagés au premier `editor`/membre actif, et nettoyant intégralement la session côté client.
* **Optimisation Mobile & Code-Splitting PWA (Étape 57 — `App.tsx`, `vite.config.ts`) :** Chargement différé (`React.lazy` + `Suspense`) des 14 vues et modales secondaires, découpage `manualChunks` (`vendor-react`, `vendor-query`, `vendor-charts`, `vendor-icons`) réduisant le chunk principal de `1 175 Ko` (`316 Ko` gzip) à `295 Ko` (`73 Ko` gzip, **-75 %**), zéro warning Vite et pré-cache Workbox complet (`25 entries`) pour le hors-ligne.
* **Durcissement Sécurité Production (Étape 58 — `auth.middleware.ts`, `app.ts`, `rateLimit.middleware.ts`, `frontend/vercel.json`) :** Rejet immédiat (`401`) des JWT appartenant à un compte supprimé, épinglage strict `HS256`, `app.set('trust proxy', 1)` pour Render/Cloudflare, `apiRateLimiter` global (`300 req / 15 min`) sur `/api`, et en-têtes HTTP de sécurité + rewrite SPA dans `frontend/vercel.json`.
* **Suivi & Mise à Jour du Compte Courant (Étape 59 — `AssetAccount.model.ts`, `netWorth.controller.ts`, `CheckingAccountCard.tsx`) :** Champ `isCheckingAccount` sur `AssetAccountModel` (`category: 'cash'`, zéro doublon avec Patrimoine), endpoint `PUT /api/budgets/:budgetId/checking-balance` (création auto + opération `set` + historique) et carte `CheckingAccountCard` dans la vue Synthèse avec confirmation obligatoire (`Ancien → Nouveau`) avant enregistrement.
