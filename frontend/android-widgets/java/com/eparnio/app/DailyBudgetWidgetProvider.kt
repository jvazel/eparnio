package com.eparnio.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

class DailyBudgetWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_SWITCH_BUDGET) {
            switchToNextBudget(context)
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, DailyBudgetWidgetProvider::class.java))
            for (appWidgetId in ids) {
                updateAppWidget(context, manager, appWidgetId)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        const val ACTION_SWITCH_BUDGET = "com.eparnio.app.ACTION_SWITCH_WIDGET_BUDGET"

        private fun getBudgetsList(context: Context): List<JSONObject> {
            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE)
            val raw = prefs.getString(WidgetBridgePlugin.KEY_BUDGETS_JSON, null) ?: return emptyList()
            return try {
                val arr = JSONArray(raw)
                val list = mutableListOf<JSONObject>()
                for (i in 0 until arr.length()) {
                    arr.optJSONObject(i)?.let { list.add(it) }
                }
                list
            } catch (_: Exception) {
                emptyList()
            }
        }

        private fun switchToNextBudget(context: Context) {
            val budgets = getBudgetsList(context)
            if (budgets.size <= 1) return

            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE)
            val currentId = prefs.getString(WidgetBridgePlugin.KEY_SELECTED_BUDGET_ID, null)
            val currentIndex = budgets.indexOfFirst { it.optString("id") == currentId }
            val nextIndex = if (currentIndex == -1) 0 else (currentIndex + 1) % budgets.size
            val nextId = budgets[nextIndex].optString("id")

            prefs.edit().putString(WidgetBridgePlugin.KEY_SELECTED_BUDGET_ID, nextId).apply()
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE)
            val budgets = getBudgetsList(context)
            val selectedId = prefs.getString(WidgetBridgePlugin.KEY_SELECTED_BUDGET_ID, null)
            val activeEntry = budgets.firstOrNull { it.optString("id") == selectedId }
                ?: budgets.firstOrNull()

            val dailyBudget = activeEntry?.optString("dailyBudget")
                ?: prefs.getString(WidgetBridgePlugin.KEY_DAILY_BUDGET, null)
            val remainingToLive = activeEntry?.optString("remainingToLive")
                ?: prefs.getString(WidgetBridgePlugin.KEY_REMAINING_TO_LIVE, null)
            val daysRemaining = activeEntry?.optInt("daysRemaining", 0)
                ?: prefs.getInt(WidgetBridgePlugin.KEY_DAYS_REMAINING, 0)
            val budgetName = activeEntry?.optString("budgetName", "Eparnio")
                ?: (prefs.getString(WidgetBridgePlugin.KEY_BUDGET_NAME, "Eparnio") ?: "Eparnio")
            val isNegative = activeEntry?.optBoolean("isNegative", false)
                ?: prefs.getBoolean(WidgetBridgePlugin.KEY_IS_NEGATIVE, false)

            val views = RemoteViews(context.packageName, R.layout.widget_daily_budget)
            val badgeLabel = if (budgets.size > 1) "$budgetName  ⇄" else budgetName
            views.setTextViewText(R.id.widget_budget_name, badgeLabel)

            if (dailyBudget == null || remainingToLive == null) {
                views.setTextViewText(R.id.widget_daily_amount, "-- € / jour")
                views.setTextViewText(R.id.widget_remaining_info, "Ouvrez Eparnio pour synchroniser")
                views.setTextColor(R.id.widget_daily_amount, Color.parseColor("#0F172A"))
            } else {
                views.setTextViewText(R.id.widget_daily_amount, "$dailyBudget € / jour")
                val dayLabel = if (daysRemaining <= 1) "jour" else "jours"
                views.setTextViewText(
                    R.id.widget_remaining_info,
                    "Reste $remainingToLive € · $daysRemaining $dayLabel"
                )
                views.setTextColor(
                    R.id.widget_daily_amount,
                    Color.parseColor(if (isNegative) "#EF4444" else "#16A34A")
                )
            }

            // Tap sur la carte -> ouvrir Eparnio
            val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (openAppIntent != null) {
                val openPendingIntent = PendingIntent.getActivity(
                    context,
                    100,
                    openAppIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_daily_root, openPendingIntent)
            }

            // Tap sur le badge du budget -> switcher vers le budget suivant sans ouvrir l'app
            if (budgets.size > 1) {
                val switchIntent = Intent(context, DailyBudgetWidgetProvider::class.java).apply {
                    action = ACTION_SWITCH_BUDGET
                }
                val switchPendingIntent = PendingIntent.getBroadcast(
                    context,
                    102,
                    switchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_budget_name, switchPendingIntent)
            } else if (openAppIntent != null) {
                val openPendingIntent = PendingIntent.getActivity(
                    context,
                    100,
                    openAppIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_budget_name, openPendingIntent)
            }

            // Tap sur le bouton "+" -> Quick-Add direct
            val quickAddIntent = Intent(Intent.ACTION_VIEW, Uri.parse("eparnio://quick-add")).apply {
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val quickAddPendingIntent = PendingIntent.getActivity(
                context,
                101,
                quickAddIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_quick_add, quickAddPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
