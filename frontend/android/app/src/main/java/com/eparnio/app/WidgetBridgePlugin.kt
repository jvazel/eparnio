package com.eparnio.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    companion object {
        const val PREFS_NAME = "eparnio_widget_prefs"
        const val KEY_DAILY_BUDGET = "dailyBudget"
        const val KEY_REMAINING_TO_LIVE = "remainingToLive"
        const val KEY_DAYS_REMAINING = "daysRemaining"
        const val KEY_BUDGET_NAME = "budgetName"
        const val KEY_IS_NEGATIVE = "isNegative"
    }

    @PluginMethod
    fun updateWidgetData(call: PluginCall) {
        val dailyBudget = call.getDouble("dailyBudget") ?: 0.0
        val remainingToLive = call.getDouble("remainingToLive") ?: 0.0
        val daysRemaining = call.getInt("daysRemaining") ?: 0
        val budgetName = call.getString("budgetName") ?: "Eparnio"
        val isNegative = call.getBoolean("isNegative") ?: (remainingToLive < 0.0)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(KEY_DAILY_BUDGET, String.format(java.util.Locale.FRANCE, "%.2f", dailyBudget))
            .putString(KEY_REMAINING_TO_LIVE, String.format(java.util.Locale.FRANCE, "%.2f", remainingToLive))
            .putInt(KEY_DAYS_REMAINING, daysRemaining)
            .putString(KEY_BUDGET_NAME, budgetName)
            .putBoolean(KEY_IS_NEGATIVE, isNegative)
            .apply()

        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, DailyBudgetWidgetProvider::class.java))
        if (ids.isNotEmpty()) {
            val intent = Intent(context, DailyBudgetWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        call.resolve()
    }
}
