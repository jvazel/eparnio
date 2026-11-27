# Guide Complet — Créer, Signer et Partager l’APK Android d’Eparnio (depuis un Mac)

> **Objectif :** Compiler une application Android **Eparnio** (avec les **2 widgets d’écran d’accueil**) depuis votre **Mac**, sans passer par le Google Play Store, pour la distribuer en production à un cercle restreint (famille, proches, couple).
>
> **Important :** Votre application Web/PWA (Vercel) reste **100 % accessible sur navigateur** (PC, iOS Safari, Android Chrome). Grâce au **Mode Hybride Capacitor**, toutes vos futures mises à jour React déployées sur Vercel apparaîtront automatiquement dans l’APK **sans avoir à renvoyer un nouveau fichier APK** à vos proches.

---

## Table des matières

1. [Prérequis à installer sur votre Mac (1 seule fois)](#1-prérequis-à-installer-sur-votre-mac-1-seule-fois)
2. [Vérifier la configuration du projet avant de compiler](#2-vérifier-la-configuration-du-projet-avant-de-compiler)
3. [Synchroniser et ouvrir le projet dans Android Studio](#3-synchroniser-et-ouvrir-le-projet-dans-android-studio)
4. [Tester l’application et les 2 widgets avant de générer l’APK](#4-tester-lapplication-et-les-2-widgets-avant-de-générer-lapk)
5. [Générer votre clé de signature (Keystore) et l’APK Release](#5-générer-votre-clé-de-signature-keystore-et-lapk-release)
6. [Partager l’APK à vos proches & procédure d’installation Android](#6-partager-lapk-à-vos-proches--procédure-dinstallation-android)
7. [Ajouter les 2 widgets sur l’écran d’accueil Android](#7-ajouter-les-2-widgets-sur-lécran-daccueil-android)
8. [Comment gérer les mises à jour par la suite ?](#8-comment-gérer-les-mises-à-jour-par-la-suite-)
9. [Sécuriser l’accès en production (Code d’invitation)](#9-sécuriser-laccès-en-production-code-dinvitation)
10. [Dépannage (FAQ)](#10-dépannage-faq)

---

## 1. Prérequis à installer sur votre Mac (1 seule fois)

### 1.1. Node.js & Git
Vérifiez dans votre Terminal Mac que Node.js `>= 20` est installé :
```bash
node -v
npm -v
```

### 1.2. Installer Android Studio (macOS)
1. Téléchargez **Android Studio** depuis le site officiel : https://developer.android.com/studio
   * Choisissez **Mac with Apple chip** si vous avez un Mac M1 / M2 / M3 / M4.
   * Choisissez **Mac with Intel chip** si vous avez un Mac Intel.
2. Ouvrez le fichier `.dmg` et glissez **Android Studio** dans le dossier **Applications**.
3. Lancez **Android Studio** une première fois :
   * Choisissez **Standard** dans l’assistant de configuration.
   * Laissez-le télécharger le **Android SDK** (API 34 ou 35), les **Android SDK Build-Tools** et le **JDK intégré**.
   * Attendez la fin du téléchargement et cliquez sur **Finish**.

### 1.3. Configurer les variables d’environnement dans le Terminal Mac *(recommandé)*
Ouvrez votre fichier `~/.zshrc` :
```bash
nano ~/.zshrc
```
Ajoutez ces 2 lignes à la fin du fichier :
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```
Enregistrez (`Ctrl + O`, `Entrée`, `Ctrl + X`), puis rechargez :
```bash
source ~/.zshrc
```

---

## 2. Vérifier la configuration du projet avant de compiler

*(Ces étapes s’appliquent une fois l’**Étape 70** de `ROADMAP.md` implémentée dans le dépôt.)*

1. Récupérez la dernière version du dépôt sur votre Mac et installez les dépendances :
   ```bash
   git pull
   npm install && npm install --prefix frontend
   ```
2. Vérifiez que l’URL de production Vercel est bien renseignée dans `frontend/.env` (ou directement dans `frontend/capacitor.config.ts`) :
   ```env
   VITE_CAPACITOR_SERVER_URL=https://votre-eparnio.vercel.app
   ```
   > **Attention :** Remplacez `https://votre-eparnio.vercel.app` par votre **vraie URL de production Vercel** (en `https://`, sans slash `/` à la fin).

3. Vérifiez que votre backend Render autorise bien l’origine Capacitor dans sa variable `CORS_ORIGIN` (si vous utilisez un mode embarqué ultérieurement, ajoutez `https://localhost,capacitor://localhost` ; en mode Hybride `server.url`, l’origine reste celle de votre URL Vercel).

---

## 3. Synchroniser et ouvrir le projet dans Android Studio

Depuis le dossier `frontend/` sur votre Mac :

```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
```

* `npm run build` compile le bundle web de secours.
* `npx cap sync android` copie la configuration (`capacitor.config.ts`) et met à jour les plugins Android.
* `npx cap open android` ouvre automatiquement le dossier `frontend/android/` dans **Android Studio**.

> **Patience à la 1re ouverture :** Android Studio va lancer **Gradle Sync** (barre de progression en bas à droite). Cela peut prendre 1 à 3 minutes la toute première fois le temps de télécharger les dépendances Android. Attendez que la barre disparaisse et qu’il n’y ait aucune erreur.

---

## 4. Tester l’application et les 2 widgets avant de générer l’APK

### Option A — Sur votre vrai téléphone Android *(recommandé)*
1. Sur votre téléphone Android, activez les **Options pour les développeurs** :
   * Allez dans **Paramètres → À propos du téléphone**.
   * Tapez **7 fois** rapidement sur **Numéro de build** (ou *Version MIUI/OneUI*).
2. Revenez dans **Paramètres → Système → Options pour les développeurs** et activez **Débogage USB**.
3. Branchez votre téléphone au Mac avec un câble USB (acceptez la pop-up *« Autoriser le débogage USB »* sur le téléphone).
4. Dans la barre supérieure d’Android Studio, sélectionnez votre téléphone dans la liste des appareils, puis cliquez sur le bouton vert **Run ▶**.
5. L’appli **Eparnio** s’installe et se lance sur votre téléphone. Connectez-vous pour alimenter les données du widget, puis testez l’ajout des 2 widgets sur votre écran d’accueil.

### Option B — Sur un émulateur Android (sans téléphone branché)
1. Dans Android Studio, ouvrez **Tools → Device Manager → Create Virtual Device**.
2. Choisissez un **Pixel 7 / Pixel 8** avec une image **API 34 ou 35**, puis cliquez sur **Finish**.
3. Cliquez sur **Run ▶** pour lancer Eparnio dans l’émulateur.

---

## 5. Générer votre clé de signature (Keystore) et l’APK Release

Un APK doit obligatoirement être **signé numériquement** pour pouvoir être installé sur un téléphone Android.

### 5.1. Générer l’APK depuis Android Studio
1. Dans le menu en haut de votre Mac, cliquez sur :
   **Build → Generate Signed App Bundle or APK…**
2. Sélectionnez **APK** *(et NON Android App Bundle, qui est réservé au Play Store)*, puis cliquez sur **Next**.
3. Dans la section **Key store path** :
   * **La toute première fois :** cliquez sur **Create new…**
     * **Key store path :** choisissez un emplacement **en dehors du dossier Git** (par exemple : `/Users/votre-nom/Documents/Eparnio-Keys/eparnio-release.jks`).
     * **Password :** choisissez un mot de passe fort (et notez-le !).
     * **Key Alias :** `eparnio`
     * **Key Password :** même mot de passe (ou un autre, notez-le !).
     * **Validity (years) :** `25`
     * **First and Last Name :** votre nom (les autres champs peuvent rester vides).
     * Cliquez sur **OK**.
   * **Les fois suivantes :** cliquez sur **Choose existing…** et sélectionnez votre fichier `eparnio-release.jks`.
4. Cliquez sur **Next**.
5. Dans **Build Variants**, sélectionnez **`release`**, puis cliquez sur **Create**.

> ⚠️ **CRUCIAL — Sauvegardez votre fichier `eparnio-release.jks` !**
> * **Ne le commitez JAMAIS dans Git** (ni sur GitHub).
> * Faites-en une copie de secours (ex. dans votre gestionnaire de mots de passe, iCloud Drive privé ou clé USB) avec l’alias et les mots de passe.
> * **Pourquoi ?** Si vous perdez cette clé, Android refusera d’installer vos futures mises à jour d’APK par-dessus l’ancienne version : vos proches seraient obligés de désinstaller puis réinstaller l’appli.

### 5.2. Récupérer le fichier APK généré
Une fois la compilation terminée, une notification apparaît en bas à droite d’Android Studio avec un lien **locate**.
Le fichier se trouve dans :
```text
frontend/android/app/release/app-release.apk
```
Copiez-le sur votre Bureau et renommez-le proprement, par exemple :
```text
Eparnio-v1.0.apk
```

---

## 6. Partager l’APK à vos proches & procédure d’installation Android

### 6.1. Comment l’envoyer ?
Envoyez simplement `Eparnio-v1.0.apk` aux personnes autorisées via :
* **WhatsApp / Telegram / Signal** (en tant que *Document*),
* **Google Drive / iCloud Drive** (lien de partage privé),
* ou **AirDrop / e-mail**.

### 6.2. Ce que vos proches doivent faire sur leur téléphone Android *(1 seule fois)*
1. Télécharger et ouvrir le fichier `Eparnio-v1.0.apk`.
2. Android affiche une alerte de sécurité (*« Pour votre sécurité, votre téléphone n’est pas autorisé à installer des applis inconnues depuis cette source »*) :
   * Taper sur **Paramètres** → activer **Autoriser depuis cette source** → revenir en arrière.
3. Taper sur **Installer** → **Ouvrir**.
4. *(Si Google Play Protect affiche un avertissement « Appli non reconnue »)* : taper sur **Plus de détails → Installer quand même** (normal pour toute appli distribuée hors Play Store).

---

## 7. Ajouter les 2 widgets sur l’écran d’accueil Android

1. Ouvrez **Eparnio** une première fois et connectez-vous (cela synchronise votre budget du jour avec le widget).
2. Revenez sur l’écran d’accueil du téléphone Android.
3. Faites un **appui long** sur un espace vide de l’écran d’accueil → tapez sur **Widgets**.
4. Faites défiler jusqu’à **Eparnio** : vous verrez les 2 widgets :
   * **Mon Budget du Jour (4×2)** : affiche votre budget quotidien (`Y € / jour`), votre reste à vivre et un bouton **`+`** d’ajout rapide.
   * **Saisie Express (4×1)** : barre compacte avec les 3 raccourcis **`+` Dépense**, **`🎤` Dictée vocale** et **`📷` Scanner un ticket**.
5. Maintenez le doigt sur le widget choisi et déposez-le sur votre écran d’accueil.

---

## 8. Comment gérer les mises à jour par la suite ?

* **95 % du temps (modifs React, nouvelles features UI, correctifs backend) :**
  * Vous poussez sur Git → **Vercel** et **Render** se déploient automatiquement.
  * **Aucune action requise côté APK !** Vos proches ont la nouvelle version dès la prochaine ouverture de l’appli.
* **Exceptionnellement (si vous modifiez le code Kotlin des widgets ou l’icône de l’appli) :**
  1. Incrémentez `versionCode` (+1) et `versionName` (ex. `"1.1"`) dans `frontend/android/app/build.gradle`.
  2. Lancez `npm run build && npx cap sync android && npx cap open android`.
  3. Regénérez l’APK signé avec **le même fichier `eparnio-release.jks`** et renvoyez-le : il mettra à jour l’appli existante sans perdre la session ni les widgets.

---

## 9. Sécuriser l’accès en production (Code d’invitation)

Pour empêcher toute personne extérieure de créer un compte sur votre serveur de production :
1. Sur **Render** (variables d’environnement du backend), ajoutez :
   ```env
   REGISTRATION_INVITE_CODE=VOTRE-CODE-SECRET-ICI
   ```
2. Redémarrez le service backend.
3. Communiquez ce code uniquement aux personnes à qui vous envoyez `Eparnio-v1.0.apk`.

---

## 10. Dépannage (FAQ)

* **Le widget affiche « Ouvrez Eparnio pour synchroniser » ou `0 €` :**
  Ouvrez simplement l’application Eparnio et attendez que l’onglet actif charge vos données (le pont `WidgetBridge` met immédiatement à jour le widget).
* **Le bouton `+` du widget ouvre le navigateur Chrome au lieu de l’appli Eparnio :**
  Vérifiez que l’`<intent-filter>` du schéma `eparnio://quick-add` est bien présent dans `frontend/android/app/src/main/AndroidManifest.xml` et que vous avez bien relancé `npx cap sync android` avant de compiler l’APK.
* **Erreur « App not installed » lors d’une mise à jour :**
  L’APK a probablement été signé avec une clé `.jks` différente de la première version, ou le `versionCode` dans `build.gradle` est inférieur à la version déjà installée.
* **Écran blanc au lancement de l’APK :**
  Vérifiez que votre téléphone a bien accès à internet au premier lancement et que `server.url` dans `frontend/capacitor.config.ts` pointe exactement vers votre URL Vercel active (`https://...`).
