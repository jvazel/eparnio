package com.eparnio.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class QuickActionsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_quick_actions)

            views.setOnClickPendingIntent(
                R.id.widget_action_add,
                buildDeepLinkPendingIntent(context, 201, "eparnio://quick-add")
            )
            views.setOnClickPendingIntent(
                R.id.widget_action_voice,
                buildDeepLinkPendingIntent(context, 202, "eparnio://quick-add?mode=voice")
            )
            views.setOnClickPendingIntent(
                R.id.widget_action_ocr,
                buildDeepLinkPendingIntent(context, 203, "eparnio://quick-add?mode=ocr")
            )

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    private fun buildDeepLinkPendingIntent(
        context: Context,
        requestCode: Int,
        uriString: String
    ): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriString)).apply {
            setPackage(context.packageName)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
