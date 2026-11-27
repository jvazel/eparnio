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
  - Basculez entre le **Mode essentiel** (affichage épuré par défaut) et le **Mode détaillé** (outils experts : pilotage, tendances, simulateur, import CSV, scénarios, règles, fractionnement et rollover).

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
- **Dépenses atypiques du mois :** Eparnio détecte automatiquement les dépenses inhabituelles (pic par rapport à votre médiane, impact `> 50 %` sur une enveloppe ou nouveau libellé élevé) avec un bandeau préventif à la saisie et une carte dédiée dans l'onglet `Budget` (acquittable en 1 tap via **« C'est normal »**).
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


---

## 9. Recherche Globale Multi-Mois & Reconduction des Récurrences

- **Recherche globale (`🔍`) :** depuis la loupe en haut à droite de l'application, recherchez instantanément une dépense, un revenu, une note ou un montant sur l'ensemble de vos mois et enveloppes (avec filtres rapides *Tout*, *Dépenses variables*, *Dépenses fixes*, *Revenus*, *Notes* et historique des 5 dernières recherches). Un tap sur un résultat vous emmène directement sur le mois et l'enveloppe concernés.
- **Propagation & Reconduction manuelle des récurrences :** toute nouvelle dépense fixe ou revenu récurrent est automatiquement propagé vers les mois suivants déjà créés ; le bouton **« Reconduire le mois précédent »** dans l'onglet **Dépenses** permet également de rattraper en 1 tap les éléments récurrents manquants du mois précédent.
- **Feedback haptique :** micro-vibrations légères sur mobile lors de la saisie au pavé numérique, du pointage `✓` et de la validation d'une opération.

---

## 10. Vue Calendrier & Trésorerie Prévisionnelle

Dans l'onglet **Budget**, utilisez le sélecteur **Synthèse | Calendrier** en haut de l'écran :
- **Carte de chaleur :** plus une journée concentre de dépenses, plus son fond bleu est intense ; des repères discrets signalent les revenus, les échéances à venir et les retards.
- **Filtres & résumé rapide :** filtrez par pilier via la liste déroulante (**Tout**, **Revenus**, **Fixes**, **Variables**, **Épargne**, **Patrimoine**) ou par membre en budget commun, visualisez en un coup d'œil les échéances à venir ou en retard et accédez au jour actuel via le bouton **« Aujourd’hui »**.
- **Détail du jour (`JJ/MM/AAAA`) :** tapez sur un jour pour voir ses opérations, pointer une charge fixe ou un revenu (`✓`) en 1 tap, ou ajouter une dépense.
- **Courbe de trésorerie :** visualisez votre solde réalisé et projeté jusqu'à la fin du cycle (avec option pour inclure votre budget quotidien moyen) ainsi que vos prochaines échéances trimestrielles ou annuelles.

---

## 11. Patrimoine Net, Simulateur & Bilan Annuel

- **Patrimoine Net (`Budget > Patrimoine`) :** suivez vos comptes (liquidités, placements, immobilier, crypto, crédits), filtrez par catégorie, ajoutez/retirez des montants avec libellé et source/destination (autre compte, objectif d'épargne ou restant à répartir du mois), consultez l'historique plein écran et retrouvez votre patrimoine dans l'export PDF.
- **Lier un projet d'épargne :** dans l'onglet **Epargne**, choisissez **« Placé sur le compte (optionnel) »** pour rattacher vos cagnottes (ex. *Vacances Italie*) à un compte physique (ex. *Livret A*).
- **Matelas d'urgence (`Budget > Pilotage`) :** le nombre de mois de charges fixes couverts combine automatiquement vos comptes patrimoniaux de catégorie **Liquidités** et vos objectifs d'épargne non liés à ces comptes (sans double comptage).
- **Saisie express vocale & langage naturel (`Quick-Add`) :** dictez au micro (`🎤`) ou tapez librement une phrase (ex. *« 42,50 € Carrefour courses hier #promo »*) pour pré-remplir instantanément et 100 % en local le montant, le libellé, l'enveloppe, la date, les tags et le payeur avant de valider.
- **Simulateur « Et si… ? » & Bilan annuel :** depuis l'onglet **Budget**, simulez l'impact d'un achat (ponctuel, mensuel ou en `Nx`) avant de l'enregistrer, ou lancez **Eparnio Wrapped** pour revivre votre année financière en 5 slides.
- **Restauration de sauvegarde (.json) :** depuis *Paramètres de l’espace* (bouton portefeuille → `•••` → onglet **Données**), restaurez une sauvegarde Eparnio v1 ou v2 en créant un nouvel espace (recommandé) ou en remplaçant l'espace actuel (propriétaire uniquement) après vérification de l'aperçu.
- **Scénarios de budget (*Mois Normal*, *Mois Serré*, *Vacances*) :** depuis *Paramètres de l’espace* → onglet **Général** → **Scénarios de budget**, capturez votre mois actuel en 1 tap ou composez un modèle à partir de vos enveloppes variables et épargnes, puis appliquez-le avec un aperçu Avant/Après obligatoire.
- **Règles d’auto-catégorisation :** depuis *Paramètres de l’espace* → onglet **Général** → **Règles d’auto-catégorisation**, créez des règles simples (`SI contient "CARREFOUR" → Courses + renommer + #alimentation` ou exclusion automatique CSV) et testez-les en direct.
- **Synchronisation en direct & Alertes :** vos budgets se synchronisent automatiquement en temps réel entre appareils et partenaires, et les préférences d'alertes (onglet **Alertes** de *Mon profil & préférences*) sont enregistrées instantanément à chaque changement.
- **Automatisation Apple Pay, Raccourcis & Partage :** depuis *Paramètres de l’espace* → onglet **Général** → **Apple Pay & Raccourcis**, copiez votre lien `/quick-add?amount=&label=` et suivez le guide en 4 étapes pour pré-remplir automatiquement Eparnio à chaque paiement Apple Pay (ou partagez un SMS bancaire vers Eparnio sur Android).
- **Suppression de compte (RGPD) :** depuis *Mon profil & préférences* → onglet **Sécurité** → **Supprimer mon compte**, supprimez définitivement votre compte et vos budgets personnels après confirmation par mot de passe et saisie de `SUPPRIMER` (les budgets partagés avec d'autres membres leur sont automatiquement transférés).
- **Solde du compte courant :** depuis l'onglet **Budget** → vue **Synthèse**, la carte **Compte courant** vous permet de mettre à jour manuellement votre solde bancaire réel avec un écran de confirmation explicite (`Ancien → Nouveau`) avant enregistrement.
- **Âge de l'Argent (`Budget > Pilotage`) :** dans la carte **Santé de l'épargne**, suivez en jours depuis combien de temps l'argent que vous dépensez aujourd'hui est arrivé sur votre compte (méthode FIFO sur vos 10 dernières sorties), avec barre de progression vers l'objectif des **30 jours** et explication rapide via l'icône `ⓘ`.
- **Scan de ticket de caisse (`📷 Scanner un ticket`) :** tout en haut de **Ajouter une dépense rapide** et **Ajouter une dépense** (dans une enveloppe), photographiez ou importez un ticket de caisse pour pré-remplir automatiquement le montant, le marchand, la date et l'enveloppe suggérée — **100 % en local** (aucune photo n'est envoyée sur un serveur), avec chips de montants alternatifs en 1 tap pour corriger si besoin.
- **Synchronisation Épargne ↔ Patrimoine (sans double comptage) :** lorsqu'un objectif d'épargne est lié à un compte patrimonial (*« Placé sur le compte »*, ex. *Livret A*), chaque versement, ajustement, suppression ou retrait sur cette épargne met automatiquement à jour le solde et l'historique du compte patrimonial lié, sans jamais compter la somme deux fois dans votre fortune totale.
- **Point du dimanche & Jalons de régularité (`Budget`, visibles dès le Mode essentiel) :** consultez en 30 secondes votre budget par jour, vos charges fixes des 7 prochains jours (pointables en 1 tap `✓`) et vos enveloppes à surveiller, et suivez vos jalons de régularité cumulés sans remise à zéro punitive. Le rappel hebdomadaire est activable dans *Mon profil & préférences → Alertes*.
