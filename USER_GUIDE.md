# Manuel Utilisateur — Eparnio

Bienvenue dans **Eparnio**, votre application Mobile-First (PWA) de gestion budgétaire personnelle et partagée basée sur la méthode du **Budget Base Zéro** et la **saisie manuelle proactive**.

---

## 1. Philosophie : le Budget Base Zéro

Contrairement aux applications qui affichent uniquement l'historique passé, Eparnio vous invite à attribuer un rôle précis à chaque euro gagné **avant** de le dépenser :

```text
Revenus du mois − Dépenses fixes − Enveloppes variables − Épargne = 0 €
```

- **Restant à répartir :** tant qu'il reste de l'argent non attribué, le bandeau Base Zéro vous indique combien il reste à placer (dans une enveloppe ou un objectif d'épargne).
- **Reste à vivre :** somme réellement disponible pour vos dépenses quotidiennes après déduction des charges fixes, de l'épargne et des dépenses déjà effectuées.

---

## 2. Démarrage & Compte

### 2.1. Inscription, Connexion & Biométrie
- Créez votre compte avec votre e-mail, un mot de passe et votre prénom.
- **Clé de récupération :** une clé de secours vous est proposée pour réinitialiser votre mot de passe sans e-mail, en complément de la réinitialisation par code e-mail.
- **Connexion biométrique (Face ID / Empreinte) :** activez WebAuthn depuis votre profil (avatar en haut à gauche) pour vous connecter en 1 tap.

### 2.2. Onboarding & Préférences
- Lors de la première connexion, choisissez votre **jour de paie** (`1` à `31`, ex. `25` ou `28`) pour aligner votre cycle budgétaire sur votre salaire.
- Depuis votre **Profil** (icône avatar en haut à gauche) :
  - Changez le **thème** (*Clair* / *Sombre*).
  - Choisissez votre **onglet d'ouverture par défaut** (*Dépenses fixes*, *Enveloppes*, *Revenus*, *Épargne* ou *Budget*).

---

## 3. Navigation Principale (5 Onglets)

### 3.1. Onglet « Revenus »
- Ajoutez vos salaires, primes, aides ou revenus complémentaires via le bouton bleu **`+`**.
- Cochez la case **Récurrent** pour que le revenu soit reconduit automatiquement chaque mois.
- Basculez l'affichage du graphique Donut entre **`€`** et **`%`**.
- Tapez sur la pastille **`✓`** à droite d'une ligne pour pointer un revenu comme perçu.

### 3.2. Onglet « Dépenses » (*Dépenses fixes*)
- Enregistrez vos charges contraintes (loyer, électricité, internet, assurances, abonnements, mensualités de crédit).
- La jauge circulaire affiche votre **Reste à vivre** global en temps réel.
- Tapez sur **`✓`** pour pointer une charge comme *Payée* ou *À venir*.
- Utilisez l'icône **`⚙️`** pour supprimer ou réorganiser rapidement la liste.

### 3.3. Onglet « Enveloppes » (*Dépenses variables*)
- Créez des enveloppes par catégorie (*Courses*, *Carburant*, *Sorties*, *Santé*...) avec emoji, couleur pastel et plafond mensuel.
- **Saisie rapide (Quick-Add) :**
  - Appuyez sur le **FAB bleu `+`** → **« Ajouter une dépense »** (ou **« Nouvelle enveloppe »**).
  - Sélectionnez l'enveloppe en 1 tap via les **chips pastel** (le solde restant inclut le report du mois précédent).
  - Utilisez la **mini-calculatrice intégrée** (`+`, `−`, `×`, `÷`, `=`) directement sur le pavé numérique.
- **Auto-complétion & Favoris 1-Tap :**
  - Tapez les premières lettres d'un libellé déjà saisi pour voir apparaître des **suggestions** qui pré-remplissent le libellé, l'enveloppe et le dernier montant.
  - Appuyez sur **`☆ Enregistrer en favori`** pour retrouver vos dépenses fréquentes en 1 tap tout en haut du tiroir.
- **Fractionnement de ticket (Split Transaction) :**
  - Activez **« ✂️ Répartir sur plusieurs enveloppes »** pour ventiler un même ticket (ex. supermarché) sur 2 enveloppes ou plus, avec calcul en direct du *Reste à répartir (`0,00 €`)* et bouton **« Compléter »**.
  - Les parts liées affichent un badge **`✂️ Ticket partagé`** dans l'historique.

### 3.4. Onglet « Épargne » (*Objectifs & Projets*)
- Créez vos cagnottes (*Matelas de sécurité*, *Vacances*, *Apport immobilier*...) avec un montant cible.
- Appuyez sur le **`+`** pastel d'une carte pour enregistrer un versement, ou effectuez un retrait si besoin sans fausser vos dépenses mensuelles.

### 3.5. Onglet « Budget » (*Synthèse, Analyses & Outils*)
- **Entrées et sorties d'argent** & **Budget quotidien** (*X jours restants & Y € à dépenser par jour*).
- **Part des dépenses par rapport aux revenus** (Donut Fixe / Variable / Épargne).
- **Import manuel de relevé CSV / OFX (Boîte de tri) :**
  - Appuyez sur **« Importer un relevé CSV »** : lecture 100 % locale dans votre navigateur (zéro connexion bancaire), détection des doublons, exclusion en 1 tap et affectation rapide aux enveloppes.
- **Réconciliation de solde bancaire :**
  - Appuyez sur **« Réconcilier mon solde bancaire »**, saisissez le solde réel de votre banque et visualisez immédiatement l'écart éventuel.
- **Clôture de fin de mois :**
  - Clôturez le cycle en choisissant le sort des soldes d'enveloppes (*reporter au mois suivant*, *transférer vers un objectif d'épargne* ou *remettre à zéro*).
- **Exports :**
  - **Bilan PDF** : rapport structuré avec bandeau, cartes KPI, camembert de répartition, tableaux des enveloppes, objectifs, dépenses fixes et détail des dépenses variables jour par jour et par enveloppe (dates `JJ/MM/AAAA`).
  - **Export CSV** (compatible Excel) et **Sauvegarde JSON** complète.

---

## 4. Multi-Budgets & Budget Commun (Couple / Colocation)

- Appuyez sur l'icône **Portefeuille (`💳`)** en haut à droite pour basculer entre vos espaces (*Budget Perso*, *Budget Commun*, *Vacances*...) ou en créer un nouveau.
- **Partager un espace :** générez un **QR Code** ou copiez le **lien d'invitation** (SMS, WhatsApp...).
- **Calculateur 50/50 & Prorata :** calculez automatiquement la contribution équitable de chaque membre selon ses revenus.
- **Suivi « Payé par » :** chaque dépense indique le membre concerné avec sa pastille colorée, et l'onglet **Budget** affiche le bilan comparatif (*qui doit à qui*).

---

## 5. Mode Hors-Ligne & Installation PWA

- **Installer l'application :** sur mobile (iOS Safari / Android Chrome) ou ordinateur, utilisez *« Ajouter à l'écran d'accueil »* pour profiter d'Eparnio comme d'une application native.
- **Mode Hors-Ligne :** vos consultations et saisies continuent de fonctionner sans réseau ; les actions en attente sont synchronisées automatiquement dès le retour de la connexion.
