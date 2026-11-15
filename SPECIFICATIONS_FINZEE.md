# Spécifications Fonctionnelles & Style Graphique — Inspiration Finzee (Projet Eparnio)

> **Source analysée :** Écosystème **Finzee** (`https://www.finzee-app.fr/#fonctionnalites`, fiches App Store / Google Play et présentation produit).
> **Objectif :** Servir de cahier des charges fonctionnel, UI/UX (Mobile-First) et de base de modélisation **MongoDB** pour la création de l'application **Eparnio**.

---

## 1. Présentation Générale & Philosophie de Finzee

* **Origine :** Application mobile française de gestion budgétaire personnelle fondée par Johann Nguelet (alias *Monsieur Budget* / AJL Budget).
* **Public cible :** Accessible à tous — étudiants, jeunes actifs, familles, couples, colocataires, indépendants — et particulièrement pensée pour les personnes qui n'aiment pas les chiffres, le jargon financier complexe ou les tableaux Excel.
* **Promesse centrale :** Reprendre le contrôle de ses finances, éviter les découverts bancaires, réduire le stress et la charge mentale de fin de mois, et épargner plus sereinement.
* **Méthode fondamentale — Le Budget Base Zéro (*Zero-Based Budgeting*) :**
  * **Principe :** Contrairement aux applications passives qui se contentent d'afficher l'historique des dépenses bancaires, Finzee impose d'attribuer un rôle précis à chaque euro gagné **avant** même de le dépenser.
  * **Formule d'équilibre :**
    ```text
    Revenus du mois - Dépenses fixes (incluant mensualités de crédits) - Enveloppes variables - Épargne = 0 €
    ```
  * Aucun euro ne « disparaît » sans justification.
* **Approche de saisie proactive (Saisie manuelle au fil de l'eau) :**
  * L'utilisateur enregistre lui-même ses dépenses en quelques secondes au moment de l'achat (sans connexion bancaire obligatoire ni transmission d'identifiants bancaires à un tiers).
  * Cette démarche favorise la prise de conscience comportementale, la confidentialité et le contrôle actif du budget.

---

## 2. Liste Détaillée des Fonctionnalités (`#fonctionnalites`)

### 2.1. Planification & Méthode du Budget Base Zéro
* Saisie des revenus mensuels (salaires, primes, aides, revenus complémentaires).
* Affectation guidée pas à pas de chaque euro dans les **grands postes du mois** :
  1. **Dépenses fixes** (charges contraintes, abonnements et mensualités de crédits/dettes),
  2. **Enveloppes budgétaires** (dépenses variables du quotidien),
  3. **Épargne** (projets et précaution).
* Indicateur d'équilibre budgétaire en temps réel (**« Restant à répartir » / « Reste à attribuer »**) guidant l'utilisateur jusqu'à atteindre `0 €`.

### 2.2. Calcul Automatique du « Reste à Vivre » en Temps Réel
* Déduction automatique des charges fixes et dépenses incompressibles dès le début du cycle budgétaire.
* Affichage permanent et mis à jour en temps réel de la somme réellement disponible pour vivre sans risque de basculer dans le rouge.
* Possibilité d'offrir des vues dérivées complémentaires pour la pédagogie (reste à vivre sur la période, par semaine ou par jour).

### 2.3. Système d'Enveloppes Budgétaires Virtuelles
* Création d'enveloppes dédiées par catégorie de dépenses variables : *Courses, Sorties / Restaurants, Shopping, Transports / Carburant, Loisirs, Santé, Imprévus*, etc.
* Personnalisation de chaque enveloppe : nom, plafond/montant alloué, icône/emoji, couleur d'identification.
* Jauge de progression visuelle en temps réel : montant déjà dépensé vs **montant restant à dépenser** dans l'enveloppe.
* Alertes visuelles en cas d'approche du plafond ou de dépassement, avec possibilité de rééquilibrer les montants entre enveloppes en cours de mois.

### 2.4. Gestion des Charges Fixes & Anticipation des Dépenses Périodiques
* Suivi des charges récurrentes mensuelles (loyer, électricité, internet, téléphonie, assurances, abonnements, mensualités).
* Statut de pointage (`Payée` / `À venir`) pour savoir immédiatement quelles charges sont déjà passées sur le compte.
* **Anticipation des dépenses futures ou annuelles** (*Sinking Funds*) : lissage mensuel des dépenses ponctuelles ou annuelles (impôts, entretien du véhicule, cadeaux de Noël, vacances) pour éviter les mauvaises surprises.

### 2.5. Objectifs d'Épargne & Projets
* Création de cagnottes et d'objectifs personnalisés (*Épargne de précaution / Matelas de sécurité, Vacances, Apport immobilier, Changement de véhicule, Projets personnels*).
* Définition d'un montant cible et d'une échéance éventuelle.
* Suivi visuel pas à pas du pourcentage d'avancement et de l'historique des versements pour maintenir la motivation.

### 2.6. Suivi des Crédits & Mensualités (Intégré aux Dépenses Fixes)
* Pour conserver une interface épurée et fidèle aux captures de référence, les mensualités de crédits ou remboursements de dettes (prêt auto, crédit conso, etc.) sont directement saisies en tant que **dépenses fixes récurrentes** (`fixed_charge`) dans l'onglet **Dépenses** (pas de module Dettes séparé).

### 2.7. Budget Commun / Partagé (Couple, Colocation, Foyer)
* Création d'un espace budgétaire partagé indépendant du budget personnel (sans jamais mélanger les comptes privés et les finances communes).

#### 2.7.1. Sélecteur rapide d'espace (`Budget Switcher`)
* Sélecteur permanent en haut de l'application permettant de basculer en **1 clic** entre le *Budget Perso*, le *Budget Commun* (couple, coloc, foyer) ou tout autre budget créé, avec possibilité de créer un nouvel espace budgétaire directement depuis ce menu.

#### 2.7.2. Alimentation & Calculateur d'apport équitable (50/50 ou Prorata)
* Dans un budget commun en méthode **Budget Base Zéro**, les entrées du mois (pilier `income`) correspondent aux **apports mensuels de chaque membre** (ou aux revenus mis en commun).
* **Calculateur intégré d'aide à la répartition :** outil guidé permettant de calculer automatiquement la contribution idéale de chaque partenaire aux dépenses communes selon 2 modes :
  * **Égalitaire (50/50) :** chacun verse exactement la même somme pour couvrir le budget commun.
  * **Équitable au prorata des revenus :** chacun saisit son revenu net mensuel et Eparnio calcule automatiquement la quote-part proportionnelle (ex. : `60 %` / `40 %`) ainsi que les montants exacts à verser pour équilibrer le budget à `0 €`.
*Possibilité également de saisir des apports personnalisés libres (`custom`).*

#### 2.7.3. Suivi transparent au quotidien (« Qui a payé / Qui a versé »)
* Lors de la saisie rapide d'une transaction (`+`) ou de l'ajout d'un apport dans un budget commun, un sélecteur rapide permet d'indiquer **« Payé par... » / « Apporté par... »** (pré-sélectionné par défaut sur l'utilisateur connecté, modifiable en 1 tap).
* Affichage systématique d'une **pastille / initiale colorée** identifiant le membre concerné sur chaque ligne de transaction et d'apport.

#### 2.7.4. Invitation simplifiée (QR Code & Lien) & Gestion des membres
* Chaque partenaire dispose de son propre compte individuel Eparnio.
* Invitation d'un partenaire, conjoint ou colocataire via un **QR Code scannable** directement depuis l'écran du téléphone ou un **lien d'invitation** copiable et partageable (SMS, WhatsApp, etc.).
* Gestion complète des membres depuis les paramètres du budget commun : visualisation des participants actifs et de leurs rôles (`owner`, `editor`, `viewer`), régénération/révocation du code d'invitation et possibilité de retirer un membre.

#### 2.7.5. Bilan par membre dans l'onglet Analyses
* Lorsqu'un budget de type `shared` est actif, l'onglet **Analyses** inclut une section dédiée affichant le **bilan comparatif par membre** : total des apports versés et total des dépenses réglées par chacun sur la période.

### 2.8. Personnalisation du Cycle Budgétaire & Reconduction Automatique
* Choix libre du jour de début du mois budgétaire (ex. : le `25`, le `27` ou le `28` du mois selon la date de versement du salaire, au lieu d'être bloqué au 1er du mois calendaire).
* **Reconduction automatique au changement de mois :** lorsque l'utilisateur navigue vers un nouveau mois via le `PeriodSelector` (`< Mois Année >`), la période est créée automatiquement en dupliquant les revenus et dépenses fixes marqués **récurrents** (`isRecurring: true`, avec `isPaid` remis à `false`) ainsi que la structure et les plafonds des **enveloppes variables** (avec montant dépensé remis à `0 €`).

### 2.9. Onglet Analyses & Statistiques (Vue d'ensemble)
* Centralisation de tous les flux financiers de la période : **Revenus, Dépenses fixes, Dépenses variables (Enveloppes) et Épargne**.
* Graphiques clairs et pédagogiques (répartition en pourcentage, reste à dépenser par jour, bilan par membre en budget partagé).

### 2.10. Multi-Budgets, Sauvegarde Cloud & Accès Complet sans Restriction
* **100 % débloqué dans Eparnio :** aucune barrière payante ni badge « Premium » bloquant. Chaque utilisateur bénéficie gratuitement et sans limitation :
  * des **revenus et dépenses fixes récurrents** (*Ajouter chaque mois*),
  * de la gestion de **budgets multiples illimités** (budget personnel, budget couple, budget colocation, budget vacances/événement...),
  * du **partage en temps réel** et des analyses complètes.

---

## 3. Architecture des Écrans (Mobile-First — Calquée sur les Captures Finzee)

L'interface doit être pensée **pouce-centrée (Mobile-First)** avec une structure homogène sur l'ensemble des écrans :

### 3.0. Structure Commune (Squelette `MobileShell`)
* **En-tête (`TopHeader`) :**
  * À gauche : **Avatar rond violet** (`#8B3DFF`) avec personnage/emoji + salutation personnalisée (**« Bonjour Prénom »**).
  * À droite : **Bouton rond blanc avec ombre portée** (icône carte/portefeuille) ouvrant le **Sélecteur de Budget** (*Budget Perso* / *Budget Commun*) et les réglages du compte.
* **Sélecteur de période (`PeriodSelector`) :**
  * Grande **carte pilule blanche** (`rounded-2xl`, ombre douce) avec flèches circulaires `<` et `>` encadrant le mois actif centré en gras (ex. : `Décembre 2025`).
* **Titre de vue centré :** Icône d'information **`ⓘ`** suivie du titre de l'onglet (`Revenus`, `Dépenses fixes`, `Dépenses variables`, `Epargne`, `Budget`).
* **Barre de navigation inférieure (`BottomNav` à 5 onglets) :**
  1. **Revenus** (icône portefeuille)
  2. **Dépenses** (icône carte bancaire — *Dépenses fixes*)
  3. **Enveloppes** (icône enveloppe — *Dépenses variables*)
  4. **Epargne** (icône tirelire)
  5. **Budget** (icône camembert — *Vue globale Base Zéro, Quotidien, Analyses & Budget Commun*)
  * *État actif :* **Violet vif (`#7C3AED` / `#8B5CF6`)**. *État inactif :* Gris (`#9CA3AF`).
* **Bouton d'action flottant (`FAB +`) :**
  * **Bouton rond Bleu vif (`#1D7DFA` / `#2563EB`)** avec `+` blanc et ombre portée, positionné **en bas à droite au-dessus de la `BottomNav`**, ouvrant un **`BottomSheet`** pour créer l'élément principal de l'onglet actif :
    * Sur **Revenus** : création d'un nouveau revenu.
    * Sur **Dépenses** : création d'une nouvelle dépense fixe.
    * Sur **Enveloppes** : création uniquement d'une **nouvelle enveloppe budgétaire** (nom, budget alloué, emoji, couleur pastel).
    * Sur **Epargne** : création d'un nouvel objectif d'épargne (tandis que le `+` pastel sur la carte d'objectif ajoute un versement).
    * Sur **Budget** : aucun bouton flottant `+` (écran de synthèse et d'analyse en lecture seule).

### 3.1. Onboarding & Configuration initiale
* Explication rapide et visuelle de la méthode Base Zéro en 3 étapes.
* Choix du jour de début de cycle budgétaire (date de salaire).
* Saisie guidée des premiers revenus et des charges fixes récurrentes.

### 3.2. Écran 1 — Onglet « Revenus »
* **Carte Synthèse Donut (`DonutSummaryCard`) :**
  * En haut à gauche : `Total` + montant global en gras (ex. : `3 500,00 €`).
  * En haut à droite : **Switch pilule `€ | %`** pour basculer l'affichage des montants en euros ou en pourcentage.
  * Corps de carte : **Graphique Donut** coloré à gauche + **légende à droite** avec puces colorées et montants par source/membre (ex. : *salaire Monsieur*, *salaire Madame*).
* **Section « Historique des revenus »** (avec icône engrenage `⚙️` de paramétrage à droite) :
  * Cartes blanches horizontales contenant : cercle coloré avec emoji (`💵`), libellé en gras, montant + date (`1 500,00 € - 10 déc.`), **pastille de pointage circulaire `✓`** sur le bord droit (grise = en attente, **verte** = perçu) et icône de récurrence (`🔄`) si mensuel.
  * **Édition / Suppression & Mode `⚙️` :** un tap sur une carte ouvre son tiroir d'édition (avec bouton `Supprimer`) ; le bouton `⚙️` active le mode de gestion rapide de la liste (suppression `🗑️` en 1 tap et réorganisation).

### 3.3. Écran 2 — Onglet « Dépenses » (*Dépenses fixes*)
* **Carte Synthèse Jauge Circulaire (`RingGaugeCard`) :**
  * En haut à gauche : `Total` des dépenses fixes engagées sur le mois (ex. : `1 069,99 €`) et lien optionnel `Tout voir ▶` en violet à droite.
  * Au centre : libellé `Reste à dépenser` au-dessus d'une **grande jauge circulaire (anneau)** grise avec arc de progression **Bleu (`#3B82F6`)** et montant disponible affiché au centre de l'anneau.
  * **Formule exacte (`Reste à dépenser`) :** `Revenus totaux − Dépenses fixes − Épargne du mois − Dépenses variables saisies` (le **Reste à vivre global** du cycle, ex. : `2 240,01 €` sur la capture).
* **Section « Historique des dépenses fixes »** (avec icône `⚙️`) :
  * Cartes blanches horizontales : anneau coloré autour de l'icône/emoji (`🍿`, `🚗`, `🏠`, `💧`, `⚡`), nom en gras, `Montant € - date` et **pastille de pointage `✓`** sur le bord droit (grise = à venir, **verte** = payée).
  * **Édition / Suppression & Mode `⚙️` :** un tap sur la carte ouvre le tiroir d'édition / suppression ; un tap sur `✓` bascule uniquement le pointage payé/à venir ; le bouton `⚙️` active la gestion rapide (suppression `🗑️` en 1 tap / réorganisation).

### 3.4. Écran 3 — Onglet « Enveloppes » (*Dépenses variables*)
* **Carte Synthèse :**
  * Libellé centré `Reste dans les enveloppes` + **grande jauge circulaire** avec arc bleu et montant restant global au centre (ex. : `1 130,00 €`).
  * **Formule exacte (`Reste dans les enveloppes`) :** `Somme des plafonds alloués aux enveloppes − Somme des dépenses saisies dans ces enveloppes`.
* **Section « Les enveloppes » — Grille à 2 colonnes de cartes pastel (`grid-cols-2`) :**
  * Chaque enveloppe est une **carte carrée/rectangulaire à fond pastel** (vert menthe, bleu glacier, rose poudré, jaune vanille...) :
    * En haut : **cercle blanc entouré d'un anneau de progression coloré** contenant l'emoji (`🐶`, `🛒`, `💅`, `🖤`) + **nom de l'enveloppe en gras**.
    * En bas : 2 lignes synthétiques à puces colorées :
      * Puce bleue : `Montant : X €`
      * Puce rouge : `Restant : Y €`
  * **Ajout d'une enveloppe :** via le bouton flottant bleu `(+)` en bas à droite.
  * **Saisie d'une dépense variable :** un tap sur la **carte pastel de l'enveloppe concernée** ouvre le tiroir détail (`EnvelopeDetailSheet`) affichant le rappel du budget (`Montant` / `Restant`), les options d'édition/suppression de l'enveloppe, l'historique des dépenses de cette enveloppe et le tiroir d'ajout de dépense (`AddExpenseSheet`) équipé d'un **pavé numérique tactile intégré au tiroir** (gros boutons au pouce) + champs nom/libellé, date et « Payé par... » (en budget commun).

### 3.5. Écran 4 — Onglet « Epargne » (*Objectifs & Projets*)
* **Carte Synthèse Donut :**
  * En haut à gauche : `Total` épargné sur le mois (ex. : `150,00 €`).
  * Corps de carte : **Graphique Donut** multicolore à gauche + légende à puces colorées à droite (*Voyage Bali*, *épargne de précaution*, *mariage*...).
* **Section « Historique des épargnes » :**
  * Grandes cartes blanches par objectif :
    * En-tête : anneau coloré avec emoji (`✈️`, `🏠`) + nom en gras + menu contextuel `⋮` à droite.
    * Indicateurs alignés à droite : `Objectif: 5 000,00 €` et `Total epargné: 505,00 €`.
    * **Barre de progression linéaire fine** de la couleur du projet.
    * Pied de carte : `Epargne du mois: 50,00 €` + chevron `⌄` (déplier les versements) + **bouton rond `+` pastel assorti** en bas à droite de la carte pour ajouter rapidement un versement.

### 3.6. Écran 5 — Onglet « Budget » (*Vue globale, Quotidien, Répartition & Partage*)
*(Sans bouton flottant `+` sur cet onglet, conformément à la capture de référence.)*
* **Carte 1 — « Entrées et sorties d'argent » (`CashFlowSummaryCard`) :**
  * Carte blanche avec 5 lignes séparées par de fins traits horizontaux, chacune dotée d'un badge carré arrondi (`rounded-xl`) à gauche et du montant aligné à droite (`tabular-nums`) :
    1. **Revenus** (badge bleu clair, icône portefeuille)
    2. **Dépenses fixes** (badge violet clair, icône carte)
    3. **Dépenses variables** (badge indigo clair, icône enveloppe)
    4. **Epargne** (badge bleu ciel, icône tirelire)
    5. **Restant** (badge vert tendre `bg-emerald-50 text-emerald-600`, icône portefeuille, libellé et montant en **gras**) : `Revenus - Dépenses fixes - Dépenses variables - Epargne`.
* **Carte 2 — « Gestion du budget quotidien » (`DailyBudgetCard`) :**
  * Badge gris clair avec icône `ⓘ` à gauche et phrase dynamique à droite :
    `Il reste ` **`X jours`** (en rouge gras `#EF4444`) ` avant la fin du mois & ` **`Y €`** (en vert gras `#22C55E`) ` à dépenser par jour!`
  * Formule : `Y = Restant / nombre de jours restants dans la période budgétaire`.
* **Carte 3 — « Part des dépenses par rapport aux revenus » (`AllocationDonutCard`) :**
  * À gauche : **Graphique Donut** à 3 couleurs (**Fixe** en violet `#8B5CF6`, **Variable** en bleu `#3B82F6`, **Épargne** en vert `#22C55E`).
  * À droite : légende à puces colorées avec pourcentages alignés à droite (`• Fixe 83.7%`, `• Variable 4.5%`, `• Épargne 11.8%`).
* **Modules complémentaires Eparnio (en dessous) :**
  * Bandeau d'équilibre **Budget Base Zéro** (`Reste à attribuer : 0 €`).
  * *(Si Budget Commun actif)* **Bilan par membre** (apports vs dépenses payées par chacun) et **Calculateur 50/50 & Prorata**.

### 3.7. Écrans / Tiroirs Modaux de Saisie & Création (`CreationFormModal` / `BottomSheet`) & Paramètres
* **Design unifié des formulaires de création et saisie (calibré sur la capture *Ajouter une dépense fixe*) :**
  * **Fond :** dégradé très léger et lumineux (lavande/bleu glacier très doux sur fond clair).
  * **En-tête visuel :** trio de bulles d'icônes pastel avec halo translucide (ex. maison bleue, voiture orange plus grande au centre, téléphone corail) + titre centré en gras (*Ajouter une dépense fixe*, *Ajouter un revenu*, *Ajouter une enveloppe*, *Ajouter une dépense*, *Ajouter une épargne*).
  * **Montant Hero centré :** très grand chiffre centré (`text-5xl`, `tabular-nums`), saisi via le **pavé numérique tactile intégré** au tiroir, accompagné du sous-titre dynamique en gris doux **`Restant à répartir: X €`** (`Revenus totaux − Dépenses fixes − Enveloppes allouées − Épargne du mois − montant saisi`), ou **`Restant dans l'enveloppe: X €`** lors d'une dépense variable, calculé en direct.
  * **Pile de cartes blanches arrondies (`rounded-2xl`) :**
    1. **Nom :** champ épuré (*Nom de ma dépense* / *Nom de l'enveloppe*...).
    2. **Date :** icône calendrier + date formatée en français (`10 décembre 2025`).
    3. **Récurrence (`Ajouter chaque mois`) :** case à cocher carrée `☐ Dépense récurrente` (ou revenu récurrent), **100 % gratuite et activable par tous** (reconduite automatiquement au mois suivant).
    4. **Apparence Icône :** aperçu en direct du cercle à anneau coloré avec l'emoji actif (`💡`) + *« Cliquez pour ajouter un emoji »*.
    5. **Couleur de l'icône :** rangée de **11 pastilles rondes colorées** (la pastille sélectionnée est entourée d'une bordure noire nette).
    6. *(Si Budget Commun actif)* **Payé par / Membre :** sélection rapide du membre concerné.
  * **Bouton de validation pleine largeur :** grand bouton bleu vif `#1D7DFA` (`rounded-2xl`) **`Ajouter`**.
* **Parcours d'ouverture :**
  * **Via le FAB `+` bleu :** création d'un revenu, d'une dépense fixe, d'une **nouvelle enveloppe** (onglet *Enveloppes*) ou d'un objectif d'épargne.
  * **Via le tap sur une tuile pastel d'enveloppe :** ouverture du détail de l'enveloppe (`EnvelopeDetailSheet`) et saisie d'une dépense dans cette enveloppe en moins de 5 secondes (pavé numérique tactile intégré, nom, date, auteur *« Payé par... »* en budget commun).
  * **Via le `+` pastel d'une carte d'épargne :** ajout d'un versement sur l'objectif concerné.
* **Paramètres & Partage (via l'icône portefeuille en haut à droite ou avatar) :** Gestion des budgets (*Budget Perso* / *Budget Commun*), cycle budgétaire (`budgetStartDay`), génération de **QR Code** et lien d'invitation, gestion des membres.

### 3.8. Sélecteur d'Espace Budget (`BudgetSwitcherOverlay`) & Modale de Partage (`ShareBudgetModal`)
*(Calibrés exactement sur la capture « Espace Budget / Partagez votre espace »)*
* **Ouverture (`BudgetSwitcherOverlay`) :** Un tap sur le bouton rond portefeuille (`💳`) en haut à droite du `TopHeader` recouvre l'écran d'un **voile sombre translucide** (`backdrop`) avec :
  * Un **bouton rond blanc `✕`** en haut à droite pour fermer l'overlay.
  * Un texte indicatif centré guidant le geste horizontal (*« Swipez vers la gauche ou vers la droite pour changer d'espace »*).
* **Cartes d'Espace Budget empilées / swipables en bas d'écran (`BudgetSpaceCard`) :**
  * Grande carte (`rounded-3xl`, `p-5`) au **dégradé vibrant violet-rose-turquoise** (`from-purple-600 via-pink-500 to-cyan-400`, texte blanc) affichant :
    * En haut à gauche : libellé `Espace Budget :` puis le nom du budget en gras (ex. : `budget 1`).
    * En bas à gauche : statut `Espace actuel` (ou action `Accéder` sur les autres cartes d'espace empilées juste en dessous, accessibles par swipe horizontal).
    * En haut à droite de la carte : **2 boutons ronds blanc cassé** :
      1. **Bouton Partager** (icône réseau `<`) ouvrant la modale de partage.
      2. **Bouton Options (`•••`)** ouvrant les paramètres de l'espace (renommer, cycle `budgetStartDay`, membres, calculateur 50/50 & prorata, création d'un nouvel espace).
* **Modale centrale de partage (`ShareBudgetModal`) :**
  * Carte modale centrée au-dessus du voile sombre (`rounded-2xl bg-white/95 text-center`) contenant :
    * **Titre en gras :** *« Partagez votre espace Eparnio avec vos proches ! »*
    * **Sous-titre :** *« Les transactions et le budget sont synchronisés en temps réel »*
    * **4 boutons d'action pleine largeur** empilés et séparés par de fins traits horizontaux :
      1. **`Envoyer par SMS`** (ouvre le partage natif / lien `sms:` avec l'invitation).
      2. **`Scanner le QR Code`** (affiche/scanne le QR Code d'invitation de l'espace).
      3. **`Copier l'URL d'invitation`** (copie le lien unique dans le presse-papiers avec feedback de confirmation).
      4. **`Annuler`** (ferme la modale de partage).

---

## 4. Style Graphique & Design System (Calibré sur les Captures Finzee)

### 4.1. Direction Artistique Générale
* **Clarté & Pédagogie :** Hiérarchie visuelle immédiate où les montants clés (*Reste à dépenser*, *Reste dans les enveloppes*, *Total*, *Restant*) sont immédiatement lisibles.
* **Approche chaleureuse, colorée & non anxiogène :** Fonds blancs très doux sur fond gris clair, cartes d'enveloppes aux **tons pastel** ludiques, emojis encadrés par des anneaux colorés, et coche verte `✓` satisfaisante pour le pointage.
* **Feedback visuel immédiat :** Anneaux circulaires (`RingGauge`), Donuts de répartition et jauges linéaires fines.

### 4.2. Palette de Couleurs (Design Tokens exacts)

#### Couleurs de Marque & d'Action
* **Primaire Navigation Active & Liens (`Violet Finzee`) :** `#7C3AED` / `#8B5CF6` (Avatar top-left `#8B3DFF`, icônes et labels actifs de la `BottomNav`, lien `Tout voir ▶`).
* **Action Principale (`FAB +` & Anneaux de jauge) :** Bleu vif `#1D7DFA` / `#2563EB` (jauges circulaires `#3B82F6`).
* **Validation / Pointage (`Check ✓`) :** Vert émeraude `#22C55E` / `#10B981` (bordure et coche verte sur les revenus perçus et charges fixes payées ; gris clair `#CBD5E1` quand en attente).

#### Palette Pastel des Enveloppes Variables (Grille 2 colonnes)
* **Vert Menthe Pastel :** fond `#CBEAD6`, anneau `#16A34A` / `#15803D`.
* **Bleu Glacier Pastel :** fond `#D6F0F3`, anneau `#0EA5E9` / `#06B6D4`.
* **Rose Poudré Pastel :** fond `#F8D4E6`, anneau `#EC4899`.
* **Jaune Vanille Pastel :** fond `#FEF0C7`, anneau `#F59E0B`.
* **Lavande Pastel :** fond `#EDE9FE`, anneau `#7C3AED`.
* *Puces internes aux cartes enveloppes :* Puce `Montant` en bleu (`#3B82F6`), puce `Restant` en rouge (`#EF4444`).

#### Couleurs Sémantiques (Alertes & Dépassements)
* **Sain (`< 70 %` consommé) :** Couleur de l'enveloppe ou Vert `#22C55E`.
* **Attention (`70 % – 95 %` consommé) :** Ambre / Orange `#F59E0B`.
* **Alerte / Dépassement (`>= 95 %` ou `100 %`) :** Rouge Corail `#EF4444`.

#### Fonds, Surfaces & Textes
* **Mode Clair (par défaut) :**
  * Background principal : `#F6F7FB` (`bg-slate-50`)
  * Surface Carte & Pillule Mois : `#FFFFFF`
  * Piste grise des jauges circulaires et barres : `#E5E7EB`
  * Bordure subtile : `#EEF2F6`
  * Texte principal : `#111827` / `#0F172A`
  * Texte secondaire / dates / labels : `#6B7280` / `#9CA3AF`
* **Mode Sombre (optionnel / préférence utilisateur) :**
  * Background principal : `#0F172A`, Surface Carte : `#1E293B`, Texte principal : `#F8FAFC`.

### 4.3. Typographie
* **Famille de polices :** Sans-serif géométrique moderne — **Inter**, **Plus Jakarta Sans** ou **DM Sans**.
* **Alignement des montants :** Activer impérativement `font-variant-numeric: tabular-nums;` (`tabular-nums`) sur tous les montants en euros (`€`) et pourcentages (`%`).
* **Échelle typographique Mobile-First :**
  * *Montant central des jauges circulaires :* `20px` à `24px`, graisse `Bold (700)`.
  * *Titre du mois (`Décembre 2025`) & Totaux cartes :* `17px` à `18px`, graisse `Bold (700)`.
  * *Titres de cartes (lignes d'historique, enveloppes) :* `15px` à `16px`, graisse `SemiBold (600)` / `Bold (700)`.
  * *Sous-titres, montants + dates (`19,99 € - 10 déc.`) :* `13px` à `14px`, graisse `Medium (500)`.
  * *Labels BottomNav & légendes :* `11px` à `12px`, graisse `Medium (500)`.

### 4.4. Composants UI & Ergonomie Mobile
* **Cartes (`Cards`) :** Coins très arrondis (`border-radius: 20px` à `24px`), ombre portée douce (`box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05)`), padding `16px`.
* **Jauge Circulaire (`RingGauge`) :** Anneau SVG épais (`strokeWidth` ~14-16px), `strokeLinecap="round"`, piste `#E5E7EB`, arc `#3B82F6`, montant centré à l'intérieur.
* **Pastille de pointage (`CheckCircle`) :** Cercle `26px` à `28px` posé sur le bord droit des cartes d'historique (revenus et charges fixes), cliquable en 1 tap (`min-h-[44px]` sur la zone de tap).
* **Barre de navigation inférieure (`BottomNav`) :** Fixée en bas (`height: 64px` + `env(safe-area-inset-bottom)`), fond blanc `#FFFFFF`, ombre légère vers le haut, 5 onglets (*Revenus*, *Dépenses*, *Enveloppes*, *Epargne*, *Budget*).
* **Bouton Flottant (`FAB +`) :** Cercle `56px × 56px` bleu `#1D7DFA` avec icône `+` blanche, positionné au-dessus de la `BottomNav` à droite (`bottom-20 right-4`).
* **Tiroirs modaux (`BottomSheet`) :** Ouverture depuis le bas (`rounded-t-3xl`) pour la saisie rapide au pouce (pavé numérique tactile + sélection par icône).

---

## 5. Proposition d'Architecture de Données MongoDB (Pour Eparnio)

Pour transposer fidèlement le modèle fonctionnel de Finzee sur une stack **MongoDB** (Node.js / Mongoose ou driver natif, avec Next.js / React Native / PWA Mobile-First), voici une structure de collections adaptée :

### 5.1. `users`
Profil utilisateur, authentification et préférences de cycle budgétaire.
```json
{
  "_id": "ObjectId",
  "email": "string",
  "passwordHash": "string",
  "displayName": "string",
  "preferences": {
    "currency": "EUR",
    "budgetStartDay": 28,
    "theme": "light"
  },
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### 5.2. `budgets`
Représente un espace budgétaire (Personnel ou Commun/Partagé, permettant le multi-budgets).
```json
{
  "_id": "ObjectId",
  "name": "Budget Commun",
  "type": "personal | shared",
  "ownerId": "ObjectId (ref: users)",
  "contributionMode": "equal_50_50 | income_prorata | custom",
  "members": [
    {
      "userId": "ObjectId (ref: users)",
      "role": "owner | editor | viewer",
      "color": "#4F46E5",
      "declaredMonthlyIncome": 2400,
      "joinedAt": "ISODate"
    }
  ],
  "inviteCode": "string (unique, pour lien ou QR Code)",
  "budgetStartDay": 28,
  "createdAt": "ISODate"
}
```

### 5.3. `budget_periods`
Instance d'un cycle mensuel pour un budget donné (ex. : du 28 octobre au 27 novembre).
```json
{
  "_id": "ObjectId",
  "budgetId": "ObjectId (ref: budgets)",
  "label": "Novembre 2026",
  "startDate": "ISODate",
  "endDate": "ISODate",
  "summary": {
    "plannedIncome": 2500,
    "plannedFixedCharges": 1100,
    "plannedEnvelopes": 900,
    "plannedSavings": 500,
    "spentVariables": 120,
    "remainingToAllocate": 0,
    "remainingToLive": 780
  },
  "createdAt": "ISODate"
}
```
*Note de calcul :*
* `remainingToAllocate` *(Restant à répartir — Base Zéro)* = `plannedIncome − plannedFixedCharges − plannedEnvelopes − plannedSavings`.
* `remainingToLive` *(Reste à dépenser / Restant global)* = `plannedIncome − plannedFixedCharges − spentVariables − plannedSavings`.

### 5.4. `envelopes` (Piliers & Catégories d'une période)
Regroupe les postes du mois (revenus/apports, dépenses fixes incluant mensualités de crédits, enveloppes variables, versements épargne).
```json
{
  "_id": "ObjectId",
  "budgetId": "ObjectId (ref: budgets)",
  "budgetPeriodId": "ObjectId (ref: budget_periods)",
  "pillar": "income | fixed_charge | variable_envelope | savings",
  "name": "Courses",
  "icon": "🛒",
  "color": "#10B981",
  "allocatedAmount": 400,
  "spentOrPaidAmount": 165.50,
  "isRecurring": true,
  "isPaid": false,
  "memberId": "ObjectId (optionnel, ref: users — utile pour identifier l'auteur d'un apport dans un budget commun)",
  "linkedGoalId": "ObjectId (optionnel, ref: savings_goals)",
  "order": 1
}
```

### 5.5. `transactions`
Chaque dépense ou entrée saisie manuellement au fil de l'eau.
```json
{
  "_id": "ObjectId",
  "budgetId": "ObjectId (ref: budgets)",
  "budgetPeriodId": "ObjectId (ref: budget_periods)",
  "envelopeId": "ObjectId (ref: envelopes)",
  "authorId": "ObjectId (ref: users — membre ayant saisi la transaction)",
  "paidByUserId": "ObjectId (ref: users — membre ayant effectivement payé ou versé la somme)",
  "type": "expense | income | transfer",
  "amount": 42.80,
  "label": "Supermarché",
  "date": "ISODate",
  "notes": "Courses de la semaine",
  "createdAt": "ISODate"
}
```

### 5.6. `savings_goals` (Objectifs d'épargne pluriannuels)
Collection transversale reliée aux versements mensuels (`linkedGoalId`) pour suivre la progression cumulée des cagnottes dans le temps.
```json
// savings_goals
{
  "_id": "ObjectId",
  "budgetId": "ObjectId (ref: budgets)",
  "name": "Matelas de sécurité",
  "icon": "🛡️",
  "color": "#10B981",
  "targetAmount": 5000,
  "currentAmount": 2150,
  "deadline": "ISODate (optionnel)",
  "createdAt": "ISODate"
}
```

### Index MongoDB Recommandés
* `transactions`: index composé `{ budgetPeriodId: 1, date: -1 }` et `{ envelopeId: 1 }` pour des tableaux de bord instantanés.
* `envelopes`: index `{ budgetPeriodId: 1, pillar: 1, order: 1 }`.
* `budget_periods`: index `{ budgetId: 1, startDate: -1 }`.
* `budgets`: index `{ "members.userId": 1 }` et index unique `{ inviteCode: 1 }` (sparse).
