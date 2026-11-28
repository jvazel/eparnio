#!/usr/bin/env bash
set -euo pipefail

# Installe les 2 widgets Android Eparnio + le plugin WidgetBridge dans frontend/android/
# À exécuter sur Mac après `npx cap add android`.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_MAIN="$FRONTEND_DIR/android/app/src/main"
WIDGETS_SRC="$FRONTEND_DIR/android-widgets"

if [ ! -d "$ANDROID_MAIN" ]; then
  echo "❌ Dossier $ANDROID_MAIN introuvable. Lancez d'abord : cd frontend && npx cap add android"
  exit 1
fi

echo "📦 Copie des fichiers Kotlin et ressources XML des widgets..."
mkdir -p "$ANDROID_MAIN/java/com/eparnio/app"
mkdir -p "$ANDROID_MAIN/res/layout" "$ANDROID_MAIN/res/xml" "$ANDROID_MAIN/res/drawable"

cp "$WIDGETS_SRC/java/com/eparnio/app/"*.kt "$ANDROID_MAIN/java/com/eparnio/app/"
cp "$WIDGETS_SRC/res/layout/"*.xml "$ANDROID_MAIN/res/layout/"
cp "$WIDGETS_SRC/res/xml/"*.xml "$ANDROID_MAIN/res/xml/"
cp "$WIDGETS_SRC/res/drawable/"*.xml "$ANDROID_MAIN/res/drawable/"

echo "✅ Fichiers widgets copiés dans $ANDROID_MAIN"
echo ""
echo "ℹ️  Vérifiez ensuite 2 points dans Android Studio (une seule fois) :"
echo "   1. MainActivity.java / MainActivity.kt : enregistrez registerPlugin(WidgetBridgePlugin.class) dans onCreate()."
echo "   2. AndroidManifest.xml : ajoutez l'<intent-filter> eparnio://quick-add et les 3 <receiver> DailyBudgetWidgetProvider, QuickActionsWidgetProvider & EnvelopesWidgetProvider."
