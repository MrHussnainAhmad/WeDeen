package com.hussnainahmadsahi.wedeen

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.RemoteViews
import org.json.JSONObject
import org.json.JSONArray
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class PrayerWidget : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == "com.hussnainahmadsahi.wedeen.MARK_PRAYED") {
            val prayerName = intent.getStringExtra("prayerName")
            val dateStr = intent.getStringExtra("date")
            if (prayerName != null && dateStr != null) {
                try {
                    val file = File(context.filesDir, "pending_widget_actions.json")
                    val array = if (file.exists()) JSONArray(file.readText()) else JSONArray()
                    val obj = JSONObject()
                    obj.put("date", dateStr)
                    obj.put("prayer", prayerName)
                    obj.put("timestamp", System.currentTimeMillis())
                    array.put(obj)
                    file.writeText(array.toString())
                } catch (e: Exception) {
                    Log.e("PrayerWidget", "Error saving prayed action", e)
                }
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val thisWidget = ComponentName(context, PrayerWidget::class.java)
                for (widgetId in appWidgetManager.getAppWidgetIds(thisWidget)) {
                    updateWidget(context, appWidgetManager, widgetId)
                }
            }
            return
        }

        if (action == "com.hussnainahmadsahi.wedeen.UPDATE_WIDGET" || 
            action == AppWidgetManager.ACTION_APPWIDGET_UPDATE ||
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_TIME_CHANGED ||
            action == Intent.ACTION_TIMEZONE_CHANGED) {
            
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, PrayerWidget::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            for (widgetId in allWidgetIds) {
                updateWidget(context, appWidgetManager, widgetId)
            }
            if (allWidgetIds.isNotEmpty()) {
                scheduleNextUpdate(context)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (widgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId)
        }
        scheduleNextUpdate(context)
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        scheduleNextUpdate(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        val intent = Intent(context, PrayerWidget::class.java).apply {
            action = "com.hussnainahmadsahi.wedeen.UPDATE_WIDGET"
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, 0, intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        updateWidget(context, appWidgetManager, appWidgetId)
    }

    private data class PrayerTime(val name: String, val time: Date)

    companion object {
        private fun readWidgetData(context: Context): JSONObject? {
            return try {
                val file = File(context.filesDir, "widget_data.json")
                if (!file.exists()) return null
                val content = file.readText()
                JSONObject(content)
            } catch (e: Exception) {
                Log.e("PrayerWidget", "Error reading widget data", e)
                null
            }
        }

        private fun scheduleNextUpdate(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, PrayerWidget::class.java).apply {
                action = "com.hussnainahmadsahi.wedeen.UPDATE_WIDGET"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val now = System.currentTimeMillis()
            val nextTrigger = now + (60000 - (now % 60000))

            try {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger, pendingIntent)
            } catch (e: Exception) {
                try {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, nextTrigger, pendingIntent)
                } catch (e2: Exception) {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, nextTrigger, pendingIntent)
                }
            }
        }

        fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, widgetId: Int) {
            val widgetData = readWidgetData(context)
            val options = appWidgetManager.getAppWidgetOptions(widgetId)
            val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
            val isSmall = minWidth < 180
            val isLarge = minHeight >= 160 && minWidth >= 250

            val layoutId = when {
                isSmall -> R.layout.prayer_widget_layout_small
                isLarge -> R.layout.prayer_widget_layout_large
                else -> R.layout.prayer_widget_layout
            }
            val views = RemoteViews(context.packageName, layoutId)

            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (isSmall) {
                views.setOnClickPendingIntent(R.id.current_prayer_text_small, pendingIntent)
                views.setOnClickPendingIntent(R.id.next_prayer_name_small, pendingIntent)
            } else {
                if (!isLarge) {
                    views.setOnClickPendingIntent(R.id.current_prayer_text, pendingIntent)
                    views.setOnClickPendingIntent(R.id.next_prayer_name, pendingIntent)
                }
                views.setOnClickPendingIntent(R.id.widget_clock, pendingIntent)
                if (isLarge) {
                    views.setOnClickPendingIntent(R.id.mark_prayed_button_large, pendingIntent)
                }
            }

            // Read colors & theme
            val colorScheme = widgetData?.optString("colorScheme", "light") ?: "light"
            val isDark = colorScheme == "dark"
            val backgroundRes = if (isDark) R.drawable.widget_background else R.drawable.widget_background_light
            
            val primaryTextColor = if (isDark) android.graphics.Color.WHITE else android.graphics.Color.parseColor("#063528")
            val secondaryTextColor = if (isDark) android.graphics.Color.parseColor("#E8F0EB") else android.graphics.Color.parseColor("#063528")
            val mutedTextColor = if (isDark) android.graphics.Color.parseColor("#8FA396") else android.graphics.Color.parseColor("#3B584E")
            val goldColorStr = if (isDark) "#D4AD3A" else "#A8811F"
            val goldColor = android.graphics.Color.parseColor(goldColorStr)
            
            val unmarkedTextColor = if (isDark) android.graphics.Color.WHITE else android.graphics.Color.parseColor("#063528")
            val buttonBg = if (isDark) R.drawable.widget_button_bg_dark else R.drawable.widget_button_bg_light

            views.setInt(R.id.widget_root, "setBackgroundResource", backgroundRes)

            if (widgetData == null) {
                if (isSmall) {
                    views.setTextViewText(R.id.current_prayer_text_small, "WeDeen")
                    views.setTextColor(R.id.current_prayer_text_small, primaryTextColor)
                    views.setTextViewText(R.id.next_prayer_name_small, "Open WeDeen")
                    views.setTextColor(R.id.next_prayer_name_small, primaryTextColor)
                    views.setTextViewText(R.id.countdown_text_small, "to update location")
                    views.setTextColor(R.id.countdown_text_small, mutedTextColor)
                    views.setTextViewText(R.id.next_prayer_time_small, "--:--")
                    views.setTextColor(R.id.next_prayer_time_small, primaryTextColor)
                } else if (isLarge) {
                    views.setTextViewText(R.id.location_text, "Open WeDeen to update location")
                    views.setTextColor(R.id.location_text, mutedTextColor)
                    views.setTextViewText(R.id.metadata_text, "Method unavailable")
                    views.setTextColor(R.id.metadata_text, mutedTextColor)
                    views.setTextColor(R.id.widget_clock, primaryTextColor)
                } else {
                    views.setTextViewText(R.id.current_prayer_text, "No Data")
                    views.setTextColor(R.id.current_prayer_text, primaryTextColor)
                    views.setTextViewText(R.id.location_text, "Open WeDeen to update location")
                    views.setTextColor(R.id.location_text, mutedTextColor)
                    views.setTextViewText(R.id.next_prayer_name, "Prayer Timings")
                    views.setTextColor(R.id.next_prayer_name, primaryTextColor)
                    views.setTextViewText(R.id.countdown_text, "Not configured")
                    views.setTextColor(R.id.countdown_text, goldColor)
                    views.setTextViewText(R.id.metadata_text, "Method unavailable")
                    views.setTextColor(R.id.metadata_text, mutedTextColor)
                    views.setTextColor(R.id.widget_clock, primaryTextColor)
                }
                appWidgetManager.updateAppWidget(widgetId, views)
                return
            }

            try {
                val locationName = widgetData.optString("locationName", "Location Unavailable")
                val school = widgetData.optString("school", "Hanafi")
                val methodName = widgetData.optString("methodName", "ISNA")
                val timingsJson = widgetData.optJSONObject("timings")

                if (timingsJson == null) {
                    throw Exception("No timings object found")
                }

                val now = Calendar.getInstance()
                val dateFormat = SimpleDateFormat("dd-MM-yyyy", Locale.US)
                val todayStr = dateFormat.format(now.time)
                val todayTimings = timingsJson.optJSONObject(todayStr)

                if (todayTimings == null) {
                    if (isSmall) {
                        views.setTextViewText(R.id.current_prayer_text_small, "WeDeen")
                        views.setTextColor(R.id.current_prayer_text_small, primaryTextColor)
                        views.setTextViewText(R.id.next_prayer_name_small, "Open WeDeen")
                        views.setTextColor(R.id.next_prayer_name_small, primaryTextColor)
                        views.setTextViewText(R.id.countdown_text_small, "to sync calendar")
                        views.setTextColor(R.id.countdown_text_small, mutedTextColor)
                        views.setTextViewText(R.id.next_prayer_time_small, "--:--")
                        views.setTextColor(R.id.next_prayer_time_small, primaryTextColor)
                    } else if (isLarge) {
                        views.setTextViewText(R.id.location_text, locationName)
                        views.setTextColor(R.id.location_text, mutedTextColor)
                        views.setTextViewText(R.id.metadata_text, "$methodName - $school")
                        views.setTextColor(R.id.metadata_text, mutedTextColor)
                        views.setTextColor(R.id.widget_clock, primaryTextColor)
                    } else {
                        views.setTextViewText(R.id.current_prayer_text, "Open WeDeen")
                        views.setTextColor(R.id.current_prayer_text, primaryTextColor)
                        views.setTextViewText(R.id.location_text, locationName)
                        views.setTextColor(R.id.location_text, mutedTextColor)
                        views.setTextViewText(R.id.next_prayer_name, "Need sync")
                        views.setTextColor(R.id.next_prayer_name, primaryTextColor)
                        views.setTextViewText(R.id.countdown_text, "Calendar missing")
                        views.setTextColor(R.id.countdown_text, goldColor)
                        views.setTextViewText(R.id.metadata_text, "$methodName - $school")
                        views.setTextColor(R.id.metadata_text, mutedTextColor)
                        views.setTextColor(R.id.widget_clock, primaryTextColor)
                    }
                    appWidgetManager.updateAppWidget(widgetId, views)
                    return
                }

                val obligatoryNames = arrayOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
                val prayerTimes = mutableListOf<PrayerTime>()
                val timeFormat = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.US)

                for (name in obligatoryNames) {
                    val rawTime = todayTimings.optString(name)
                    if (rawTime.isNotEmpty()) {
                        val cleanedTime = rawTime.substring(0, 5)
                        val date = timeFormat.parse("$todayStr $cleanedTime")
                        if (date != null) {
                            prayerTimes.add(PrayerTime(name, date))
                        }
                    }
                }

                val tomorrow = Calendar.getInstance()
                tomorrow.add(Calendar.DAY_OF_YEAR, 1)
                val tomorrowStr = dateFormat.format(tomorrow.time)
                val tomorrowTimings = timingsJson.optJSONObject(tomorrowStr)
                var tomorrowFajrDate: Date? = null
                if (tomorrowTimings != null) {
                    val rawFajr = tomorrowTimings.optString("Fajr")
                    if (rawFajr.isNotEmpty()) {
                        tomorrowFajrDate = timeFormat.parse("$tomorrowStr ${rawFajr.substring(0, 5)}")
                    }
                }

                val currentTime = now.time
                var nextPrayer: PrayerTime? = null
                var currentPrayerName = "Isha"
                var currentPrayerStartTime: Date? = null

                for (p in prayerTimes) {
                    if (p.time.after(currentTime)) {
                        nextPrayer = p
                        break
                    }
                }

                if (nextPrayer != null) {
                    val nextIdx = prayerTimes.indexOf(nextPrayer)
                    if (nextIdx == 0) {
                        currentPrayerName = "Isha"
                        val yesterday = Calendar.getInstance()
                        yesterday.add(Calendar.DAY_OF_YEAR, -1)
                        val yesterdayStr = dateFormat.format(yesterday.time)
                        val yesterdayTimings = timingsJson.optJSONObject(yesterdayStr)
                        if (yesterdayTimings != null) {
                            val rawIsha = yesterdayTimings.optString("Isha")
                            if (rawIsha.isNotEmpty()) {
                                currentPrayerStartTime = timeFormat.parse("$yesterdayStr ${rawIsha.substring(0, 5)}")
                            }
                        }
                    } else {
                        currentPrayerName = prayerTimes[nextIdx - 1].name
                        currentPrayerStartTime = prayerTimes[nextIdx - 1].time
                    }
                } else {
                    if (tomorrowFajrDate != null) {
                        nextPrayer = PrayerTime("Fajr", tomorrowFajrDate)
                    }
                    currentPrayerName = "Isha"
                    currentPrayerStartTime = prayerTimes.lastOrNull()?.time
                }

                // Check pending actions to see if already marked prayed
                var isMarkedPrayed = false
                try {
                    val file = File(context.filesDir, "pending_widget_actions.json")
                    if (file.exists()) {
                        val array = JSONArray(file.readText())
                        for (i in 0 until array.length()) {
                            val obj = array.getJSONObject(i)
                            if (obj.optString("date") == todayStr && obj.optString("prayer") == currentPrayerName) {
                                isMarkedPrayed = true
                                break
                            }
                        }
                    }
                } catch (e: Exception) {}

                val buttonBgPrayed = if (isDark) R.drawable.widget_button_bg_prayed_dark else R.drawable.widget_button_bg_prayed_light
                if (isMarkedPrayed) {
                    if (isSmall) {
                        views.setTextViewText(R.id.mark_prayed_button_small, "✓ Done")
                        views.setTextColor(R.id.mark_prayed_button_small, if (isDark) android.graphics.Color.WHITE else android.graphics.Color.parseColor("#0B6B4F"))
                        views.setInt(R.id.mark_prayed_button_small, "setBackgroundResource", buttonBgPrayed)
                    } else if (isLarge) {
                        views.setTextViewText(R.id.mark_prayed_button_large, "✓ Prayed")
                        views.setTextColor(R.id.mark_prayed_button_large, if (isDark) android.graphics.Color.WHITE else android.graphics.Color.parseColor("#0B6B4F"))
                        views.setInt(R.id.mark_prayed_button_large, "setBackgroundResource", buttonBgPrayed)
                    } else {
                        views.setTextViewText(R.id.mark_prayed_button, "✓ Prayed")
                        views.setTextColor(R.id.mark_prayed_button, if (isDark) android.graphics.Color.WHITE else android.graphics.Color.parseColor("#0B6B4F"))
                        views.setInt(R.id.mark_prayed_button, "setBackgroundResource", buttonBgPrayed)
                    }
                } else {
                    if (isSmall) {
                        views.setTextViewText(R.id.mark_prayed_button_small, "Mark Prayed")
                        views.setTextColor(R.id.mark_prayed_button_small, unmarkedTextColor)
                        views.setInt(R.id.mark_prayed_button_small, "setBackgroundResource", buttonBg)
                    } else if (isLarge) {
                        views.setTextViewText(R.id.mark_prayed_button_large, "Mark Prayed")
                        views.setTextColor(R.id.mark_prayed_button_large, unmarkedTextColor)
                        views.setInt(R.id.mark_prayed_button_large, "setBackgroundResource", buttonBg)
                    } else {
                        views.setTextViewText(R.id.mark_prayed_button, "Mark Prayed")
                        views.setTextColor(R.id.mark_prayed_button, unmarkedTextColor)
                        views.setInt(R.id.mark_prayed_button, "setBackgroundResource", buttonBg)
                    }
                }

                val markPrayedIntent = Intent(context, PrayerWidget::class.java).apply {
                    action = "com.hussnainahmadsahi.wedeen.MARK_PRAYED"
                    putExtra("prayerName", currentPrayerName)
                    putExtra("date", todayStr)
                }
                val markPrayedPendingIntent = PendingIntent.getBroadcast(
                    context, 0, markPrayedIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                
                if (isSmall) {
                    views.setOnClickPendingIntent(R.id.mark_prayed_button_small, markPrayedPendingIntent)
                } else if (isLarge) {
                    views.setOnClickPendingIntent(R.id.mark_prayed_button_large, markPrayedPendingIntent)
                } else {
                    views.setOnClickPendingIntent(R.id.mark_prayed_button, markPrayedPendingIntent)
                }

                if (nextPrayer != null) {
                    val diffMs = nextPrayer.time.time - currentTime.time
                    val totalSec = diffMs / 1000
                    val hours = totalSec / 3600
                    val minutes = (totalSec % 3600) / 60

                    val countdownStr = if (hours > 0) {
                        String.format(Locale.US, "in %dh %02dm", hours, minutes)
                    } else {
                        String.format(Locale.US, "in %dm", minutes)
                    }

                    var progressValue = 0
                    if (currentPrayerStartTime != null) {
                        val totalDurationMs = nextPrayer.time.time - currentPrayerStartTime.time
                        val elapsedMs = currentTime.time - currentPrayerStartTime.time
                        if (totalDurationMs > 0) {
                            progressValue = ((elapsedMs.toFloat() / totalDurationMs.toFloat()) * 1000).toInt()
                        }
                    }
                    val formattedTime = timeFormat.format(nextPrayer.time).substring(11, 16)

                    if (isSmall) {
                        views.setTextViewText(R.id.current_prayer_text_small, currentPrayerName)
                        views.setTextColor(R.id.current_prayer_text_small, goldColor)
                        views.setTextViewText(R.id.next_prayer_name_small, "Next: ${nextPrayer.name}")
                        views.setTextColor(R.id.next_prayer_name_small, secondaryTextColor)
                        views.setTextViewText(R.id.countdown_text_small, countdownStr)
                        views.setTextColor(R.id.countdown_text_small, mutedTextColor)
                        views.setTextViewText(R.id.next_prayer_time_small, formattedTime)
                        views.setTextColor(R.id.next_prayer_time_small, primaryTextColor)
                    } else if (isLarge) {
                        views.setTextViewText(R.id.location_text, locationName)
                        views.setTextColor(R.id.location_text, mutedTextColor)
                        views.setTextViewText(R.id.metadata_text, "$methodName - $school")
                        views.setTextColor(R.id.metadata_text, mutedTextColor)
                        views.setTextColor(R.id.widget_clock, primaryTextColor)
                        
                        val nameIds = arrayOf(R.id.fajr_name, R.id.dhuhr_name, R.id.asr_name, R.id.maghrib_name, R.id.isha_name)
                        val timeIds = arrayOf(R.id.fajr_time, R.id.dhuhr_time, R.id.asr_time, R.id.maghrib_time, R.id.isha_time)
                        val statusIds = arrayOf(R.id.fajr_status, R.id.dhuhr_status, R.id.asr_status, R.id.maghrib_status, R.id.isha_status)
                        
                        for (i in obligatoryNames.indices) {
                            val name = obligatoryNames[i]
                            val rawTime = todayTimings.optString(name)
                            val formattedTime = if (rawTime.isNotEmpty()) rawTime.substring(0, 5) else "--:--"
                            
                            views.setTextViewText(nameIds[i], name)
                            views.setTextViewText(timeIds[i], formattedTime)
                            
                            var statusStr = "Upcoming"
                            var statusColor = if (isDark) "#8FA396" else "#3B584E"
                            
                            var isPrayerMarked = false
                            try {
                                val file = File(context.filesDir, "pending_widget_actions.json")
                                if (file.exists()) {
                                    val array = JSONArray(file.readText())
                                    for (j in 0 until array.length()) {
                                        val obj = array.getJSONObject(j)
                                        if (obj.optString("date") == todayStr && obj.optString("prayer") == name) {
                                            isPrayerMarked = true
                                            break
                                        }
                                    }
                                }
                            } catch (e: Exception) {}

                            if (isPrayerMarked) {
                                statusStr = "Prayed"
                                statusColor = "#0B6B4F"
                            } else {
                                val pTime = prayerTimes.find { it.name == name }
                                if (pTime != null && pTime.time.before(currentTime)) {
                                    statusStr = "Missed"
                                    statusColor = "#A8321F"
                                } else if (name == currentPrayerName) {
                                    statusStr = "Active"
                                    statusColor = goldColorStr
                                }
                            }
                            
                            views.setTextViewText(statusIds[i], statusStr)
                            views.setTextColor(statusIds[i], android.graphics.Color.parseColor(statusColor))
                            
                            if (name == currentPrayerName) {
                                views.setTextColor(nameIds[i], goldColor)
                                views.setTextColor(timeIds[i], goldColor)
                            } else {
                                views.setTextColor(nameIds[i], secondaryTextColor)
                                views.setTextColor(timeIds[i], primaryTextColor)
                            }
                        }
                    } else {
                        views.setTextViewText(R.id.current_prayer_text, "$currentPrayerName Time")
                        views.setTextColor(R.id.current_prayer_text, primaryTextColor)
                        views.setTextViewText(R.id.location_text, locationName)
                        views.setTextColor(R.id.location_text, mutedTextColor)
                        views.setTextViewText(R.id.next_prayer_name, nextPrayer.name)
                        views.setTextColor(R.id.next_prayer_name, primaryTextColor)
                        views.setTextViewText(R.id.countdown_text, countdownStr)
                        views.setTextColor(R.id.countdown_text, goldColor)
                        views.setTextViewText(R.id.metadata_text, "$methodName - $school")
                        views.setTextColor(R.id.metadata_text, mutedTextColor)
                        views.setTextColor(R.id.widget_clock, primaryTextColor)
                    }
                } else {
                    if (isSmall) {
                        views.setTextViewText(R.id.current_prayer_text_small, "Isha")
                        views.setTextColor(R.id.current_prayer_text_small, goldColor)
                        views.setTextViewText(R.id.next_prayer_name_small, "Next: Fajr")
                        views.setTextColor(R.id.next_prayer_name_small, secondaryTextColor)
                        views.setTextViewText(R.id.countdown_text_small, "Tomorrow")
                        views.setTextColor(R.id.countdown_text_small, mutedTextColor)
                        if (tomorrowFajrDate != null) {
                            views.setTextViewText(R.id.next_prayer_time_small, timeFormat.format(tomorrowFajrDate).substring(11, 16))
                        } else {
                            views.setTextViewText(R.id.next_prayer_time_small, "--:--")
                        }
                        views.setTextColor(R.id.next_prayer_time_small, primaryTextColor)
                    } else if (isLarge) {
                        views.setTextViewText(R.id.location_text, locationName)
                        views.setTextColor(R.id.location_text, mutedTextColor)
                        views.setTextViewText(R.id.metadata_text, "$methodName - $school")
                        views.setTextColor(R.id.metadata_text, mutedTextColor)
                        views.setTextColor(R.id.widget_clock, primaryTextColor)
                        
                        val nameIds = arrayOf(R.id.fajr_name, R.id.dhuhr_name, R.id.asr_name, R.id.maghrib_name, R.id.isha_name)
                        val timeIds = arrayOf(R.id.fajr_time, R.id.dhuhr_time, R.id.asr_time, R.id.maghrib_time, R.id.isha_time)
                        val statusIds = arrayOf(R.id.fajr_status, R.id.dhuhr_status, R.id.asr_status, R.id.maghrib_status, R.id.isha_status)
                        
                        for (i in obligatoryNames.indices) {
                            val name = obligatoryNames[i]
                            val rawTime = todayTimings.optString(name)
                            val formattedTime = if (rawTime.isNotEmpty()) rawTime.substring(0, 5) else "--:--"
                            
                            views.setTextViewText(nameIds[i], name)
                            views.setTextViewText(timeIds[i], formattedTime)
                            
                            var statusStr = "Upcoming"
                            var statusColor = if (isDark) "#8FA396" else "#3B584E"
                            
                            var isPrayerMarked = false
                            try {
                                val file = File(context.filesDir, "pending_widget_actions.json")
                                if (file.exists()) {
                                    val array = JSONArray(file.readText())
                                    for (j in 0 until array.length()) {
                                        val obj = array.getJSONObject(j)
                                        if (obj.optString("date") == todayStr && obj.optString("prayer") == name) {
                                            isPrayerMarked = true
                                            break
                                        }
                                    }
                                }
                            } catch (e: Exception) {}

                            if (isPrayerMarked) {
                                statusStr = "Prayed"
                                statusColor = "#0B6B4F"
                            } else {
                                val pTime = prayerTimes.find { it.name == name }
                                if (pTime != null && pTime.time.before(currentTime)) {
                                    statusStr = "Missed"
                                    statusColor = "#A8321F"
                                } else if (name == currentPrayerName) {
                                    statusStr = "Active"
                                    statusColor = goldColorStr
                                }
                            }
                            
                            views.setTextViewText(statusIds[i], statusStr)
                            views.setTextColor(statusIds[i], android.graphics.Color.parseColor(statusColor))
                            
                            if (name == currentPrayerName) {
                                views.setTextColor(nameIds[i], goldColor)
                                views.setTextColor(timeIds[i], goldColor)
                            } else {
                                views.setTextColor(nameIds[i], secondaryTextColor)
                                views.setTextColor(timeIds[i], primaryTextColor)
                            }
                        }
                    } else {
                        views.setTextViewText(R.id.current_prayer_text, "Isha Time")
                        views.setTextColor(R.id.current_prayer_text, primaryTextColor)
                        views.setTextViewText(R.id.location_text, locationName)
                        views.setTextColor(R.id.location_text, mutedTextColor)
                        views.setTextViewText(R.id.next_prayer_name, "Fajr")
                        views.setTextColor(R.id.next_prayer_name, primaryTextColor)
                        views.setTextViewText(R.id.countdown_text, "Tomorrow")
                        views.setTextColor(R.id.countdown_text, goldColor)
                        views.setTextViewText(R.id.metadata_text, "$methodName - $school")
                        views.setTextColor(R.id.metadata_text, mutedTextColor)
                        views.setTextColor(R.id.widget_clock, primaryTextColor)
                    }
                }

            } catch (e: Exception) {
                Log.e("PrayerWidget", "Error rendering widget", e)
                if (isSmall) {
                    views.setTextViewText(R.id.current_prayer_text_small, "Error")
                    views.setTextColor(R.id.current_prayer_text_small, primaryTextColor)
                    views.setTextViewText(R.id.next_prayer_name_small, "Open WeDeen")
                    views.setTextColor(R.id.next_prayer_name_small, primaryTextColor)
                    views.setTextViewText(R.id.countdown_text_small, "to reload")
                    views.setTextColor(R.id.countdown_text_small, mutedTextColor)
                    views.setTextViewText(R.id.next_prayer_time_small, "--:--")
                    views.setTextColor(R.id.next_prayer_time_small, primaryTextColor)
                } else if (isLarge) {
                    views.setTextViewText(R.id.location_text, "Render failed")
                    views.setTextColor(R.id.location_text, mutedTextColor)
                    views.setTextColor(R.id.widget_clock, primaryTextColor)
                } else {
                    views.setTextViewText(R.id.current_prayer_text, "Error")
                    views.setTextColor(R.id.current_prayer_text, primaryTextColor)
                    views.setTextViewText(R.id.location_text, "Render failed")
                    views.setTextColor(R.id.location_text, mutedTextColor)
                    views.setTextViewText(R.id.next_prayer_name, "Check app settings")
                    views.setTextColor(R.id.next_prayer_name, primaryTextColor)
                    views.setTextViewText(R.id.countdown_text, "")
                    views.setTextViewText(R.id.metadata_text, "")
                    views.setTextColor(R.id.widget_clock, primaryTextColor)
                }
            }

            try {
                appWidgetManager.updateAppWidget(widgetId, views)
            } catch (e: Exception) {
                Log.e("PrayerWidget", "Fatal error updating app widget", e)
            }
        }
    }
}
