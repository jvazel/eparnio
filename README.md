# Eparnio

Application **Mobile-First (PWA)** de gestion budgétaire personnelle et partagée, reposant sur la méthode du **Budget Base Zéro** et la saisie manuelle proactive.

## Architecture

- `frontend/` : Web App Mobile-First / PWA (React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Zustand).
- `backend/` : API REST JSON (Node.js, Express, TypeScript, Mongoose, Zod, JWT).
- `docker-compose.yml` : Base de données **MongoDB** en local (`mongodb://localhost:27017/eparnio`).

## Fonctionnalités principales

- **Budget Base Zéro & démarrage à `0,00 €` :** Chaque nouvel utilisateur démarre avec un espace vierge à `0,00 €` (aucune donnée factice pré-remplie). L'affectation guidée permet d'attribuer chaque euro jusqu'à atteindre `Reste à attribuer = 0 €`, avec calcul en temps réel du **Reste à dépenser**.
- **Expérience Mobile-First & PWA à 5 onglets :** Navigation pouce-centrée (`Revenus`, `Dépenses`, `Enveloppes`, `Epargne`, `Budget`), pavé numérique tactile intégré (`NumericKeypad`), jauges circulaires, tuiles pastel d'enveloppes et graphiques Donut (`€ | %`).
- **Cycle sur-mesure & Reconduction automatique :** Choix libre du jour de début de cycle (`1` à `28` selon la date de paie) et reconduction automatique au mois suivant des revenus et charges fixes récurrents (`isPaid` remis à `false`) ainsi que des enveloppes variables (montant dépensé remis à `0 €`).
- **Multi-Budgets & Budget Commun 100 % gratuit (`0 €`) :** Sélecteur d'espace (`BudgetSwitcherOverlay`), invitation par lien unique (valable 24h), application SMS native du téléphone (`sms:`) et **QR Code SVG généré 100 % côté client** (sans API tierce payante), pastilles membres *« Payé par / Apporté par »*, bilan comparatif par membre et calculateur d'apport **50/50 ou au prorata des revenus**.
- **Sécurité & Protection des comptes :** Mots de passe robustes hachés via `bcryptjs`, clé de récupération personnelle gratuite (`EPAR-XXXX-XXXX` téléchargeable en `.txt`), envoi gratuit d'un code à 6 chiffres par e-mail via **SMTP Gmail** (`15 min`), jetons JWT `24h` révocables (`tokenVersion`), limitation de débit anti-brute-force (`429`), en-têtes Helmet et MongoDB local restreint à `127.0.0.1:27017`.
- **Thème Clair (par défaut) & Mode Sombre :** Bascule instantanée entre le thème clair et le mode sombre depuis le profil utilisateur (`ProfileSheet`), avec sauvegarde des préférences côté serveur et tests automatisés de non-régression pour les deux thèmes.

## Prérequis

- Node.js >= 20 (vérifié avec v24) & npm
- Docker Desktop / Docker Engine (pour MongoDB local)

## Installation initiale (première fois)

1. **Installer les dépendances (racine, backend et frontend) :**
   ```bash
   npm install && npm install --prefix backend && npm install --prefix frontend
   ```

2. **Configurer les fichiers d'environnement (`backend/.env` & `frontend/.env`) :**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   - `backend/.env` centralise notamment la durée de session utilisateur (`JWT_EXPIRES_IN=24h`), le coût Bcrypt (`BCRYPT_SALT_ROUNDS=10`), l'expiration des invitations (`INVITE_CODE_TTL_HOURS=24`), les seuils anti-brute-force (`RATE_LIMIT_WINDOW_MINUTES`, `AUTH_RATE_LIMIT_MAX`, `INVITE_RATE_LIMIT_MAX`), la limite de payload (`JSON_BODY_LIMIT=1mb`) et les réglages SMTP (`SMTP_*`, `SMTP_TIMEOUT_MS`, `PASSWORD_RESET_CODE_TTL_MINUTES`, `PASSWORD_RESET_MAX_ATTEMPTS`).
   - `frontend/.env` centralise `VITE_API_URL`, `VITE_PORT` et `VITE_API_PROXY_TARGET`.

3. **(Optionnel — 100 % gratuit) Activer l'envoi d'e-mails de réinitialisation via Gmail :**
   - Dans un compte Google dédié, activez la **Validation en 2 étapes**, puis créez un **Mot de passe d'application**.
   - Renseignez `SMTP_USER` (votre adresse Gmail) et `SMTP_PASS` (le mot de passe d'application à 16 caractères) dans `backend/.env`.
   - En développement, si `SMTP_USER` / `SMTP_PASS` sont vides, le code à 6 chiffres s'affiche directement dans les logs `[Eparnio DEV SMTP]` du serveur backend.

## Lancement en local

Depuis la racine du projet (`Eparnio/`), exécutez les commandes suivantes :

### 1. Mode complet (MongoDB + Backend + Frontend)

1. **Démarrer MongoDB en arrière-plan :**
   ```bash
   docker-compose up -d
   ```

2. **Lancer simultanément le Frontend (port `5173`) et le Backend (port `4000`) :**
   ```bash
   npm run dev
   ```

### 2. Mode Frontend uniquement (optionnel)

Si Docker ou MongoDB n'est pas démarré et que vous souhaitez uniquement tester l'interface visuelle :
```bash
npm run dev --prefix frontend
```

### URLs locales

- **Application Web (Frontend) :** http://localhost:5173
- **API REST (Backend) :** http://localhost:4000
- **Santé de l'API (Health Check) :** http://localhost:4000/api/health

## Commandes de Vérification & Tests

Toutes les commandes suivantes s'exécutent depuis la racine `Eparnio/` :

| Commande | Description |
| :--- | :--- |
| `npm run dev` | Lance simultanément le backend (`[API]`) et le frontend (`[WEB]`). |
| `npm run dev --prefix frontend` | Lance uniquement le frontend Vite (utile sans MongoDB/Docker). |
| `npm run typecheck` | Vérifie la compilation TypeScript stricte (`tsc --noEmit`) côté backend et frontend. |
| `npm test` | Exécute les suites de tests unitaires et d'intégration (backend + frontend). |
| `npm run test:coverage` | Exécute les tests de non-régression avec rapport de couverture (`@vitest/coverage-v8`). |
| `npm run build` | Compile les builds de production backend et frontend. |

## Nouveautés récentes (Étapes 9 à 16)

- **Page dédiée Enveloppe** (`EnvelopeDetailPage`) avec jauge circulaire, édition/suppression au tap et réglages (`⚙️`).
- **Détails des enveloppes & Tendances multi-mois** dans l'onglet *Budget* (`EnvelopeBreakdownCard` & `TrendsCard`).
- **PWA Mobile** : installation guidée (Android / iOS Safari), **connexion biométrique** (Face ID / Empreinte via WebAuthn), **rappels locaux** et **mode hors-ligne** avec file de synchronisation.
- **Sinking Funds** : calcul automatique de la mensualité conseillée selon l'échéance des objectifs d'épargne.

## Documentation

- [Cahier des charges & Design System](./SPECIFICATIONS_FINZEE.md)
- [Architecture technique & Contrat API](./ARCHITECTURE.md)
- [Roadmap de développement](./ROADMAP.md)
- [Guide de déploiement (Render + Vercel + MongoDB Atlas)](./DEPLOY_GUIDE.md)
