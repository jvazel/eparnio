<p align="center">
  <img src="frontend/public/icon.svg" alt="Eparnio" width="80" />
</p>

# Eparnio

Application **Mobile-First (PWA)** de gestion budgétaire personnelle et partagée, reposant sur la méthode du **Budget Base Zéro** et la saisie manuelle proactive.

> 📖 **Manuel Utilisateur :** Consultez [USER_GUIDE.md](./USER_GUIDE.md) pour le guide complet d'utilisation d'Eparnio (pas à pas, fonctionnalités avancées, budget commun, exports et mode hors-ligne).

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
- **Rollover des enveloppes variables :** Report optionnel du solde d'un mois sur l'autre (*Positif uniquement* ou *Positif et négatif*) avec chaînage entre périodes et propagation dynamique en cas de modification rétroactive.
- **Filtres & tri rapide :** Recherche instantanée, tri (date/montant) et sous-total dynamique sur les dépenses fixes et variables (avec filtre par membre en budget partagé).
- **Projection de fin de mois (Burn Rate) :** Indicateur de rythme de dépense dans l'onglet `Budget` estimant le solde de fin de cycle et la date éventuelle de passage en négatif.
- **Saisie express vocale & langage naturel (100 % local) :** Dans le `Quick-Add`, dictez au micro (Web Speech API) ou tapez une phrase libre (*« 42,50 € Carrefour courses hier »*) pour pré-remplir montant, libellé, enveloppe, date, tags et payeur sans coût serveur.
- **Indicateurs avancés de pilotage :** Comparatif avancement du mois vs consommation des enveloppes, taux d'épargne, matelas de sécurité (en mois de charges fixes, incluant les liquidités du patrimoine sans double comptage), top enveloppes en tension et **détection des dépenses atypiques** (alertes préventives).
- **Vue Calendrier & Trésorerie Prévisionnelle :** Bascule `Synthèse | Calendrier | Patrimoine` dans l'onglet `Budget` avec carte de chaleur des dépenses, filtres par pilier (revenus, fixes, variables, épargne, patrimoine) et par membre, courbe Recharts de trésorerie projetée et suivi des échéances périodiques à 3 mois.
- **Patrimoine Net & Transferts :** Suivi `Actifs − Passifs` (liquidités, placements, immobilier, crypto, crédits), liaison multi-projets depuis l'onglet `Epargne`, historique plein écran, transferts entre comptes/épargne/budget et inclusion dans l'export PDF.
- **Simulateur « Et si… ? », Notifications Push PWA & Eparnio Wrapped :** Simulation d'achats (ponctuel, mensuel, `Nx`), rappels Web Push VAPID, détecteur de hausses d'abonnements (`N` vs `N-1`), équilibrage Base Zéro en 1 tap et rétrospective annuelle en 5 slides.
- **Souveraineté totale (Export / Import JSON v2 & Suppression RGPD) :** Sauvegarde complète `.json` (incluant le patrimoine), restauration guidée en 3 étapes (`create_new` ou `replace_existing` avec aperçu) et suppression définitive de compte `DELETE /api/auth/me` (transfert automatique des budgets partagés).
- **Scénarios de Budget & Règles d'Auto-Catégorisation (`Payee Rules`) :** Création de modèles (*Mois Normal*, *Mois Serré*, *Vacances*) applicables avec aperçu Avant/Après, et règles `SI … ALORS …` (enveloppe, renommage, `#tags`, exclusion CSV) avec testeur en direct.
- **Synchronisation Temps Réel (SSE), Apple Pay & Performance Mobile :** Mise à jour instantanée multi-appareils/foyer via SSE (`0 €`), deep-link `/quick-add` + Web Share Target (Raccourcis iOS / Apple Pay / Android) et code-splitting PWA (`React.lazy` + `manualChunks`, chunk principal réduit de **-75 %**).

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

## Nouveautés récentes (Étapes 51 à 57)

- **Restauration JSON v2** (`JsonImportSheet`) : import complet avec aperçu, remapping déterministe des `ObjectId` et rétrocompatibilité v1.
- **Scénarios & Modèles de Budget** (`BudgetTemplatesSheet`) : snapshot en 1 tap du mois actif, sélecteur tactile d'enveloppes et aperçu Avant/Après obligatoire.
- **Synchronisation Temps Réel (SSE) & Push Partagé** (`useBudgetRealtimeSync`, `RealtimeToast`) : 100 % gratuit, compatible Render/Cloudflare.
- **Règles d'Auto-Catégorisation** (`PayeeRulesSheet`) : règles `SI … ALORS …` + exclusion automatique CSV + testeur en direct.
- **Apple Pay / Raccourcis & Web Share Target** (`ApplePayShortcutGuideSheet`, `/quick-add`) : saisie express en 1 tap sans connexion bancaire.
- **Suppression de Compte RGPD** (`DELETE /api/auth/me`) & **Code-Splitting PWA** (chunk initial `295 Ko` / `73 Ko` gzip, zéro warning Vite).

## Documentation

- [Cahier des charges & Design System](./SPECIFICATIONS_EPARNIO.md)
- [Architecture technique & Contrat API](./ARCHITECTURE.md)
- [Roadmap de développement](./ROADMAP.md)
- [Guide de déploiement (Render + Vercel + MongoDB Atlas)](./DEPLOY_GUIDE.md)
- [Guide de création & partage de l'APK Android (macOS + Widgets)](./ANDROID_APK_GUIDE.md)
