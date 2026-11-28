package com.eparnio.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    companion object {
        const val PREFS_NAME = "eparnio_widget_prefs"
        const val KEY_DAILY_BUDGET = "dailyBudget"
        const val KEY_REMAINING_TO_LIVE = "remainingToLive"
        const val KEY_DAYS_REMAINING = "daysRemaining"
        const val KEY_BUDGET_NAME = "budgetName"
        const val KEY_IS_NEGATIVE = "isNegative"
        const val KEY_BUDGETS_JSON = "budgetsJson"
        const val KEY_SELECTED_BUDGET_ID = "selectedBudgetId"
    }

    @PluginMethod
    fun updateWidgetData(call: PluginCall) {
        val budgetId = call.getString("budgetId")
        val dailyBudget = call.getDouble("dailyBudget") ?: 0.0
        val remainingToLive = call.getDouble("remainingToLive") ?: 0.0
        val daysRemaining = call.getInt("daysRemaining") ?: 0
        val budgetName = call.getString("budgetName") ?: "Eparnio"
        val isNegative = call.getBoolean("isNegative") ?: (remainingToLive < 0.0)
        val envelopesArray = call.getArray("envelopes") ?: JSONArray()

        val formattedDaily = String.format(java.util.Locale.FRANCE, "%.2f", dailyBudget)
        val formattedRemaining = String.format(java.util.Locale.FRANCE, "%.2f", remainingToLive)
        val entryId = if (!budgetId.isNullOrBlank()) budgetId else budgetName

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existingJson = prefs.getString(KEY_BUDGETS_JSON, "[]") ?: "[]"
        val budgetsArray = try {
            JSONArray(existingJson)
        } catch (_: Exception) {
            JSONArray()
        }

        val entry = JSONObject().apply {
            put("id", entryId)
            put("budgetName", budgetName)
            put("dailyBudget", formattedDaily)
            put("remainingToLive", formattedRemaining)
            put("daysRemaining", daysRemaining)
            put("isNegative", isNegative)
            put("envelopes", envelopesArray)
        }

        var replaced = false
        for (i in 0 until budgetsArray.length()) {
            val item = budgetsArray.optJSONObject(i)
            if (item != null && item.optString("id") == entryId) {
                budgetsArray.put(i, entry)
                replaced = true
                break
            }
        }
        if (!replaced) {
            budgetsArray.put(entry)
        }

        prefs.edit()
            .putString(KEY_DAILY_BUDGET, formattedDaily)
            .putString(KEY_REMAINING_TO_LIVE, formattedRemaining)
            .putInt(KEY_DAYS_REMAINING, daysRemaining)
            .putString(KEY_BUDGET_NAME, budgetName)
            .putBoolean(KEY_IS_NEGATIVE, isNegative)
            .putString(KEY_BUDGETS_JSON, budgetsArray.toString())
            .putString(KEY_SELECTED_BUDGET_ID, entryId)
            .apply()

        val manager = AppWidgetManager.getInstance(context)
        val dailyIds = manager.getAppWidgetIds(ComponentName(context, DailyBudgetWidgetProvider::class.java))
        if (dailyIds.isNotEmpty()) {
            val intent = Intent(context, DailyBudgetWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, dailyIds)
            }
            context.sendBroadcast(intent)
        }

        val envelopeIds = manager.getAppWidgetIds(ComponentName(context, EnvelopesWidgetProvider::class.java))
        if (envelopeIds.isNotEmpty()) {
            val intent = Intent(context, EnvelopesWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, envelopeIds)
            }
            context.sendBroadcast(intent)
        }

        call.resolve()
    }
}
