---
name: eparnio-mobile-ui
description: >-
  Guide du Design System et de l'ergonomie Mobile-First d'Eparnio (calibré exactement sur les captures Finzee).
  Activer ce skill lors de la création ou modification de composants UI, cartes, jauges circulaires,
  tuiles pastel d'enveloppes, BottomSheet, pavé numérique, graphiques ou écrans dans frontend/.
---

# Design System & Ergonomie Mobile-First — Eparnio

L'interface d'**Eparnio** reprend l'identité visuelle des captures de référence : claire, chaleureuse, colorée par des tuiles pastel et des anneaux d'icônes, avec une lecture instantanée au pouce.

## 1. Palette de Couleurs & Design Tokens (Tailwind CSS)
* **Fond d'application :** `bg-[#F6F7FB]` (`bg-slate-50`).
* **Surface Cartes & Pilule Mois :** `bg-white rounded-2xl border border-slate-100/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05)]`.
* **Violet Marque (Avatar, Onglet actif `BottomNav`, lien `Tout voir ▶`) :** `#7C3AED` / `#8B3DFF` (`violet-600`).
* **Bleu Action (FAB `+` bas-droite & Arc de jauge circulaire) :** `#1D7DFA` / `#3B82F6` (`blue-600` / `blue-500`).
* **Vert Pointage (Coche `✓` validée, épargne saine, Base Zéro `0 €`) :** `#22C55E` / `#10B981` (`emerald-500`).
* **Textes :** Principal `#111827` (`text-slate-900`), Secondaire/Dates `#6B7280` (`text-slate-500`).

### Palette Pastel des Enveloppes Variables (`PastelEnvelopeCard`)
Chaque enveloppe dispose d'un thème pastel doux (grille à 2 colonnes `grid-cols-2 gap-3`) :
* **Menthe :** fond `bg-[#CBEAD6]`, anneau `#16A34A`
* **Glacier :** fond `bg-[#D6F0F3]`, anneau `#06B6D4`
* **Rose Poudré :** fond `bg-[#F8D4E6]`, anneau `#EC4899`
* **Vanille :** fond `bg-[#FEF0C7]`, anneau `#F59E0B`
* **Lavande :** fond `bg-[#EDE9FE]`, anneau `#7C3AED`

## 2. Architecture Layout Commune (`MobileShell`)
* **Conteneur :** `max-w-md mx-auto min-h-dvh bg-[#F6F7FB] relative pb-28 shadow-xl` (centré sur desktop, plein écran sur mobile).
* **`TopHeader` :**
  * À gauche : Avatar rond violet (`w-10 h-10 rounded-full bg-[#8B3DFF]`) avec emoji + texte `Bonjour <Prénom>`.
  * À droite : Bouton rond blanc ombré (`w-10 h-10 rounded-full bg-white shadow-sm`) ouvrant le `BudgetSwitcher` (*Perso / Commun*) et les réglages.
* **`PeriodSelector` :** Grande pilule blanche (`rounded-2xl bg-white shadow-sm py-3 px-4 flex items-center justify-between`) avec boutons `<` et `>` ronds encadrant le mois (`Décembre 2025`).
* **Titre de vue centré :** `ⓘ <Nom de l'écran>` (`flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-700`).
* **`BottomNav` (5 onglets fixes en bas avec `safe-area-inset-bottom`) :**
  1. `Revenus`
  2. `Dépenses` (*Dépenses fixes*)
  3. `Enveloppes` (*Dépenses variables*)
  4. `Epargne`
  5. `Budget` (*Synthèse Base Zéro, Quotidien, Analyses & Budget Commun*)
  * Onglet actif en **violet (`text-violet-600`)**, inactif en **gris (`text-slate-400`)**.
* **`QuickAddButton` (FAB `+`) :** Bouton rond bleu vif (`w-14 h-14 rounded-full bg-[#1D7DFA] text-white shadow-lg`) positionné **en bas à droite** au-dessus de la `BottomNav` (`fixed bottom-20 right-4 z-30` à l'intérieur du gabarit `max-w-md`). Il crée l'élément principal de l'onglet actif (un revenu, une charge fixe, une **nouvelle enveloppe** sur l'onglet *Enveloppes*, ou un objectif d'épargne) et est **masqué sur l'onglet `Budget`**.

## 3. Composants Graphiques Clés (Fidèles aux Captures)
* **`RingGauge` (Jauge Circulaire `Dépenses` & `Enveloppes`) :**
  * Anneau SVG à bords arrondis (`strokeLinecap="round"`), piste gris clair `#E5E7EB`, arc bleu `#3B82F6` (ou rouge `#EF4444` si dépassement), montant `Reste à dépenser` / `Reste dans les enveloppes` centré en `tabular-nums font-bold text-xl text-slate-900`.
* **`DonutSummaryCard` (`Revenus` & `Epargne`) :**
  * En haut à gauche : `Total` + montant gras. En haut à droite (sur Revenus) : switch pilule `€ | %`.
  * En dessous : Donut coloré à gauche + légende à puces colorées et montants à droite.
* **`CheckableListCard` (Lignes `Historique des revenus` & `Historique des dépenses fixes`) :**
  * Carte blanche horizontale (`rounded-2xl bg-white p-3.5 shadow-sm relative flex items-center gap-3`).
  * À gauche : cercle blanc à bordure colorée contenant l'emoji (`💵`, `🍿`, `🚗`, `🏠`, `💧`, `⚡`).
  * Au centre : libellé gras + `Montant € - date` (ex. `19,99 € - 10 déc.`).
  * Sur le bord droit : pastille circulaire `✓` (grise si à venir, verte `#22C55E` si perçu/payé) + icône `🔄` si récurrent.
* **`PastelEnvelopeCard` (Cartes `Les enveloppes` en grille 2 colonnes) :**
  * Fond pastel arrondi (`rounded-2xl p-3.5`).
  * En-tête : badge circulaire blanc entouré d'un mini anneau de progression SVG coloré contenant l'emoji + nom en gras à droite.
  * Corps : 2 lignes avec puces colorées : puce bleue `Montant : X €` et puce rouge `Restant : Y €` (ou alerte rouge vif si dépassé).
* **`SavingsGoalCard` (Cartes `Historique des épargnes`) :**
  * Carte blanche (`rounded-2xl p-4 shadow-sm`) : icône cerclée + nom + menu `⋮`, `Objectif` & `Total epargné` alignés à droite, barre de progression fine colorée (`h-1.5 rounded-full`), pied avec `Epargne du mois` + chevron `⌄` + bouton rond `+` pastel assorti à la couleur du projet.
* **Cartes de l'onglet `Budget` (Capture *Budget*) :**
  * **`CashFlowSummaryCard` (`Entrées et sorties d'argent`) :** carte blanche listant 5 lignes séparées par `divide-y divide-slate-100` avec badge carré `rounded-xl` coloré à gauche et montant `tabular-nums` à droite (`Revenus` bleu, `Dépenses fixes` violet, `Dépenses variables` indigo, `Epargne` bleu ciel, et **`Restant`** avec badge `bg-emerald-50 text-emerald-600` et texte/montant en gras).
  * **`DailyBudgetCard` (`Gestion du budget quotidien`) :** carte blanche avec badge carré gris `ⓘ` à gauche et phrase dynamique `Il reste <span class="text-red-500 font-bold">X jours</span> avant la fin du mois & <span class="text-emerald-500 font-bold">Y €</span> à dépenser par jour!`.
  * **`AllocationDonutCard` (`Part des dépenses par rapport aux revenus`) :** Donut à 3 couleurs (`Fixe` violet `#8B5CF6`, `Variable` bleu `#3B82F6`, `Épargne` vert `#22C55E`) à gauche + légende à puces et pourcentages alignés à droite.

## 4. Formulaire de Saisie / Création (`CreationFormModal` — Capture *Ajouter une dépense fixe*)
Tous les formulaires d'ajout (revenu, dépense fixe, enveloppe, dépense variable, objectif d'épargne) adoptent cette mise en page exacte :
* **Fond & En-tête :** léger dégradé pastel très doux (`bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-50`), trio de bulles d'icônes colorées avec halo translucide centré en haut (ex. `🏠` bleu, `🚗` orange plus grand au centre, `📞` corail) + titre centré en gras.
* **Zone Montant Hero :** grand chiffre centré sans bordure (`text-5xl font-bold tabular-nums text-slate-900`) saisi via `NumericKeypad` + sous-titre en direct `Restant à répartir: X €` (ou `Restant dans l'enveloppe: X €`) en `text-sm text-slate-400 tabular-nums`.
* **Pile de cartes blanches (`rounded-2xl bg-white p-4 shadow-sm space-y-3`) :**
  1. **Nom :** label `Nom` + input sans bordure (`Nom de ma dépense`).
  2. **Date :** icône calendrier + label `Date` + date lisible (`10 décembre 2025`).
  3. **Récurrence (`Ajouter chaque mois`) :** case à cocher carrée `☐ Dépense récurrente` (pour revenus et charges fixes).
  4. **Apparence Icône :** aperçu en direct à gauche du cercle blanc entouré de la couleur sélectionnée contenant l'emoji (`💡`) + `Apparence / Icône` + invitation `Cliquez pour ajouter un emoji`.
  5. **Couleur de l'icône :** rangée de 11 pastilles rondes (`#FCE96A`, `#075985`, `#16A34A`, `#6EE7B7`, `#38BDF8`, `#4F46E5`, `#F472B6`, `#34D399`, `#FB923C`, `#F87171`, `#E879F9`) — la pastille active porte `ring-2 ring-slate-900 ring-offset-1`.
  6. *(Budget Commun uniquement)* **Payé par / Membre :** pastilles des membres.
* **CTA Validation :** grand bouton pleine largeur `w-full py-4 rounded-2xl bg-[#1D7DFA] text-white font-semibold shadow-sm` libellé `Ajouter`.

## 5. Sélecteur d'Espace Budget (`BudgetSwitcherOverlay`) & Modale de Partage (`ShareBudgetModal`)
* **Overlay plein écran (`BudgetSwitcherOverlay`) :** déclenché par le bouton portefeuille en haut à droite du `TopHeader` (`bg-slate-900/60 backdrop-blur-[2px]`), avec un bouton rond blanc `✕` (`w-10 h-10 rounded-full bg-white/90 text-slate-800`) en haut à droite et une pile de cartes en bas de l'écran :
  * **Carte active (`BudgetSpaceCard`) :** `bg-gradient-to-br from-purple-600 via-pink-500 to-cyan-400 rounded-3xl p-5 text-white shadow-xl`. Affiche `Espace Budget :`, le nom en gras (`budget 1`), `Espace actuel` en bas à gauche (les cartes empilées en dessous affichent `Accéder` avec swipe horizontal gauche/droite), et 2 boutons ronds blanc cassé (`w-10 h-10 rounded-full bg-white/85 text-slate-800`) en haut à droite : **Partager** et **Menu `•••`**.
* **Modale de partage (`ShareBudgetModal`) :** carte centrée style sheet natif (`rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden text-center`) affichant le titre *« Partagez votre espace Eparnio avec vos proches ! »*, le sous-titre *« Les transactions et le budget sont synchronisés en temps réel »*, puis 4 boutons pleine largeur (`min-h-12 text-indigo-700 font-medium divide-y divide-slate-200`) :
  1. `Envoyer par SMS`
  2. `Scanner le QR Code`
  3. `Copier l'URL d'invitation`
  4. `Annuler`

## 6. Typographie & Ergonomie Tactile
* **Chiffres alignés :** Tout montant financier (`€`) ou pourcentage porte impérativement `tabular-nums font-bold`.
* **Saisie d'une dépense variable au pouce :**
  * Taper sur une **`PastelEnvelopeCard`** ouvre son tiroir de détail (`EnvelopeDetailSheet` : budget alloué, restant, historique des dépenses de l'enveloppe et bouton d'ajout).
  * Le formulaire de saisie d'une dépense (`AddExpenseSheet`) reprend le gabarit ci-dessus (grand montant centré + `Restant dans l'enveloppe: X €`, cartes `Nom`, `Date`, `Payé par...` en budget commun) avec le **pavé numérique tactile (`NumericKeypad`)** intégré au tiroir (`rounded-t-3xl`).
* **Zones tactiles :** Hauteur minimale `44px` (`min-h-11`) pour chaque élément cliquable.


## 7. Sélecteurs & Listes Déroulantes (Interdiction des `<select>` natifs)
* **Ne jamais utiliser de `<select>` HTML natif** dans l'interface utilisateur.
* **Listes déroulantes (`DropdownSelect.tsx`) :** pour choisir un compte, un objectif ou une contrepartie :
  * Bouton déclencheur tactile (`w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium`), affichant icône, libellé, sous-libellé `tabular-nums` et chevron `ChevronDown` animé.
  * Menu déroulant flottant (`rounded-2xl bg-white dark:bg-slate-800 border shadow-xl max-h-48 overflow-y-auto divide-y`) avec coche `Check` violette sur l'élément actif.
* **Choix courts (`PillSelect.tsx`) :** pour 2 à 5 options visibles en un tap (ex. catégories, enveloppe cible), utiliser des pilules `rounded-full px-3 py-1.5 text-xs font-semibold` (actif : `bg-violet-600 text-white`, inactif : `bg-slate-100 dark:bg-slate-700`).
