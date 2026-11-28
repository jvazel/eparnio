package com.eparnio.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

class EnvelopesWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_SWITCH_ENVELOPES_BUDGET) {
            switchToNextBudget(context)
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, EnvelopesWidgetProvider::class.java))
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
        const val ACTION_SWITCH_ENVELOPES_BUDGET = "com.eparnio.app.ACTION_SWITCH_ENVELOPES_BUDGET"

        private val ROW_IDS = intArrayOf(
            R.id.widget_env_row_1,
            R.id.widget_env_row_2,
            R.id.widget_env_row_3,
            R.id.widget_env_row_4
        )
        private val LABEL_IDS = intArrayOf(
            R.id.widget_env_label_1,
            R.id.widget_env_label_2,
            R.id.widget_env_label_3,
            R.id.widget_env_label_4
        )
        private val AMOUNT_IDS = intArrayOf(
            R.id.widget_env_amount_1,
            R.id.widget_env_amount_2,
            R.id.widget_env_amount_3,
            R.id.widget_env_amount_4
        )
        private val PROGRESS_IDS = intArrayOf(
            R.id.widget_env_progress_1,
            R.id.widget_env_progress_2,
            R.id.widget_env_progress_3,
            R.id.widget_env_progress_4
        )

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

            val budgetId = activeEntry?.optString("id", "") ?: ""
            val budgetName = activeEntry?.optString("budgetName", "Eparnio")
                ?: (prefs.getString(WidgetBridgePlugin.KEY_BUDGET_NAME, "Eparnio") ?: "Eparnio")
            val envelopesArr = activeEntry?.optJSONArray("envelopes") ?: JSONArray()

            val views = RemoteViews(context.packageName, R.layout.widget_envelopes)
            val badgeLabel = if (budgets.size > 1) "$budgetName  ⇄" else budgetName
            views.setTextViewText(R.id.widget_env_budget_name, badgeLabel)

            // Tap sur le fond -> ouvrir Eparnio
            val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (openAppIntent != null) {
                val openPendingIntent = PendingIntent.getActivity(
                    context,
                    300,
                    openAppIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_envelopes_root, openPendingIntent)
            }

            // Tap sur le badge -> switcher de budget sans ouvrir l'app
            if (budgets.size > 1) {
                val switchIntent = Intent(context, EnvelopesWidgetProvider::class.java).apply {
                    action = ACTION_SWITCH_ENVELOPES_BUDGET
                }
                val switchPendingIntent = PendingIntent.getBroadcast(
                    context,
                    301,
                    switchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_env_budget_name, switchPendingIntent)
            }

            val count = minOf(envelopesArr.length(), 4)
            if (count == 0) {
                views.setViewVisibility(R.id.widget_env_empty, View.VISIBLE)
                views.setTextViewText(R.id.widget_env_total, "")
                for (i in 0 until 4) {
                    views.setViewVisibility(ROW_IDS[i], View.GONE)
                }
            } else {
                views.setViewVisibility(R.id.widget_env_empty, View.GONE)
                var totalRemaining = 0.0
                for (i in 0 until 4) {
                    if (i < count) {
                        val env = envelopesArr.optJSONObject(i)
                        if (env != null) {
                            val envId = env.optString("id", "")
                            val icon = env.optString("icon", "💳")
                            val name = env.optString("name", "Enveloppe")
                            val remaining = env.optDouble("remaining", 0.0)
                            val percentUsed = env.optInt("percentUsed", 0).coerceIn(0, 100)
                            totalRemaining += remaining

                            val formattedRem = String.format(java.util.Locale.FRANCE, "%.0f €", remaining)
                            views.setViewVisibility(ROW_IDS[i], View.VISIBLE)
                            views.setTextViewText(LABEL_IDS[i], "$icon $name")
                            views.setTextViewText(AMOUNT_IDS[i], formattedRem)
                            views.setProgressBar(PROGRESS_IDS[i], 100, percentUsed, false)

                            val amountColor = when {
                                remaining < 0.0 || percentUsed >= 100 -> "#EF4444"
                                percentUsed >= 80 -> "#D97706"
                                else -> "#16A34A"
                            }
                            views.setTextColor(AMOUNT_IDS[i], Color.parseColor(amountColor))

                            // Tap sur la ligne -> ajout rapide pré-affecté à cette enveloppe
                            val uriBuilder = Uri.parse("eparnio://quick-add").buildUpon()
                            if (envId.isNotBlank()) uriBuilder.appendQueryParameter("envelopeId", envId)
                            if (budgetId.isNotBlank()) uriBuilder.appendQueryParameter("budgetId", budgetId)
                            val envIntent = Intent(Intent.ACTION_VIEW, uriBuilder.build()).apply {
                                setPackage(context.packageName)
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                            }
                            val envPendingIntent = PendingIntent.getActivity(
                                context,
                                310 + i,
                                envIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                            )
                            views.setOnClickPendingIntent(ROW_IDS[i], envPendingIntent)
                        }
                    } else {
                        views.setViewVisibility(ROW_IDS[i], View.GONE)
                    }
                }
                val formattedTotal = String.format(java.util.Locale.FRANCE, "Reste %.0f €", totalRemaining)
                views.setTextViewText(R.id.widget_env_total, formattedTotal)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
