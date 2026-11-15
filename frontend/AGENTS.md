# Règles Frontend — Eparnio (`frontend/`)

## Stack Technique
* **Core :** React 18+, TypeScript (`strict: true`), Vite, Tailwind CSS.
* **Données & État :** TanStack Query (`@tanstack/react-query`) + Axios (`src/services/`), Zustand (`src/store/`).
* **Navigation & UI :** React Router, Lucide React, Recharts, `vite-plugin-pwa`.
* **Tests & Couverture :** Vitest, `@vitest/coverage-v8`, React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`), `jsdom`.

## Contraintes Mobile-First & Ergonomie Tactile
1. **Conception Mobile d'abord :**
   * Toujours concevoir chaque écran pour une largeur mobile (`375px` à `430px`), encapsulée dans le composant `MobileShell` (`max-w-md mx-auto min-h-dvh`) afin d'offrir un rendu application mobile cohérent sur desktop comme sur smartphone.
2. **Zone de confort du pouce :**
   * Tous les boutons, liens interactifs et items cliquables doivent avoir une zone tactile d'au moins `44px × 44px` (`min-h-11`).
   * La navigation principale est assurée par la `BottomNav` fixée en bas de l'écran (avec `env(safe-area-inset-bottom)`) composée de **5 onglets** (`Revenus`, `Dépenses`, `Enveloppes`, `Epargne`, `Budget` — icône active en violet), accompagnée du bouton flottant bleu `(+)` positionné **en bas à droite** au-dessus de la barre pour créer l'élément principal de l'onglet actif (sur *Enveloppes*, le `(+)` crée uniquement une nouvelle enveloppe).
   * Pour saisir une **dépense variable**, l'utilisateur tape directement sur la carte pastel de l'enveloppe concernée, ouvrant son détail puis le formulaire d'ajout dans un `BottomSheet` doté d'un grand montant centré avec sous-titre `Restant` en direct, **pavé numérique tactile intégré (`NumericKeypad`)** et cartes blanches (`Nom`, `Date`, `Payé par...`).
   * Tous les formulaires de création (revenu, charge fixe, enveloppe) suivent le patron visuel `CreationFormModal` défini dans le skill `eparnio-mobile-ui` (trio de bulles d'icônes, grand montant + `Restant à répartir`, cartes blanches `Nom`, `Date`, `Récurrence`, `Apparence Icône` + 11 pastilles couleur, bouton bleu `Ajouter`).

## Règles Visuelles & Formatage Financier
* **Chiffres alignés :** Appliquer systématiquement `tabular-nums` (`font-variant-numeric: tabular-nums`) sur tous les montants en euros, compteurs et pourcentages.
* **Formatage français :** Utiliser un helper dédié reposant sur `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
* **Design System :** Avant de créer ou modifier un composant UI, une carte, une barre de progression, un tiroir modal ou un écran, activer et suivre le skill `eparnio-mobile-ui`.

## Architecture du Code Frontend
* **Couche API isolée :** Aucun appel `fetch` ou `axios` directement dans les composants React. Tout passe par `src/services/*.service.ts` et des hooks TanStack Query.
* **Fraîcheur des données :** Toute mutation (`POST`, `PATCH`, `DELETE`) sur une enveloppe, une charge fixe ou une transaction doit invalider les clés TanStack Query impactées (`['period']`, `['envelopes']`, `['transactions']`, `['analytics']`) pour que le *Reste à vivre* et le *Reste à attribuer* soient toujours synchronisés à l'écran.

## Tests Automatisés & Couverture Obligatoires
* **Tests de composants & parcours utilisateur :** Pour chaque nouveau composant UI clé (`RingGauge`, `PastelEnvelopeCard`, `NumericKeypad`, `CreationFormModal`...) ou écran fonctionnel, ajouter des tests Vitest + React Testing Library dans `src/__tests__/` ou en co-localisation (`*.test.tsx`).
* **Non-régression & Couverture :** Exécuter `npx vitest run --coverage` (ou `npm run test:coverage` à la racine) après chaque développement pour vérifier l'absence de régression et contrôler la couverture de code.
