package com.eparnio.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews

class DailyBudgetWidgetProvider : AppWidgetProvider() {

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
        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE)
            val dailyBudget = prefs.getString(WidgetBridgePlugin.KEY_DAILY_BUDGET, null)
            val remainingToLive = prefs.getString(WidgetBridgePlugin.KEY_REMAINING_TO_LIVE, null)
            val daysRemaining = prefs.getInt(WidgetBridgePlugin.KEY_DAYS_REMAINING, 0)
            val budgetName = prefs.getString(WidgetBridgePlugin.KEY_BUDGET_NAME, "Eparnio") ?: "Eparnio"
            val isNegative = prefs.getBoolean(WidgetBridgePlugin.KEY_IS_NEGATIVE, false)

            val views = RemoteViews(context.packageName, R.layout.widget_daily_budget)
            views.setTextViewText(R.id.widget_budget_name, budgetName)

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
