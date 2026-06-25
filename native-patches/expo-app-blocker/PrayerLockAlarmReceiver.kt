package expo.modules.appblocker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

class PrayerLockAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    Log.d(TAG, "AlarmReceiver fired: $action")

    when (action) {
      ACTION_LOCK -> {
        val packages = intent.getStringArrayListExtra(EXTRA_PACKAGES) ?: arrayListOf()
        Log.d(TAG, "Starting lock for packages: $packages")
        AppBlockerService.setBlockedPackages(context, packages)
        AppBlockerService.start(context)
      }
      ACTION_UNLOCK -> {
        Log.d(TAG, "Stopping lock")
        AppBlockerService.setBlockedPackages(context, emptyList())
      }
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIMEZONE_CHANGED -> {
        Log.d(TAG, "Device booted or timezone changed. Natively recovering Prayer Lock alarms.")
        rescheduleFromData(context)
      }
    }
  }

  companion object {
    private const val TAG = "PrayerLockAlarm"
    const val ACTION_LOCK = "expo.modules.appblocker.ACTION_LOCK"
    const val ACTION_UNLOCK = "expo.modules.appblocker.ACTION_UNLOCK"
    const val EXTRA_PACKAGES = "packages"

    fun scheduleLock(context: Context, triggerAtMillis: Long, packages: List<String>) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(context, PrayerLockAlarmReceiver::class.java).apply {
        action = ACTION_LOCK
        putStringArrayListExtra(EXTRA_PACKAGES, ArrayList(packages))
      }
      val pendingIntent = PendingIntent.getBroadcast(
        context, 1001, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      try {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        Log.d(TAG, "Scheduled lock alarm at $triggerAtMillis")
      } catch (e: SecurityException) {
        // Fallback for Android 14+ if SCHEDULE_EXACT_ALARM is missing
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
      } catch (e: Exception) {
        Log.e(TAG, "Failed to schedule lock alarm", e)
      }
    }

    fun scheduleUnlock(context: Context, triggerAtMillis: Long) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(context, PrayerLockAlarmReceiver::class.java).apply {
        action = ACTION_UNLOCK
      }
      val pendingIntent = PendingIntent.getBroadcast(
        context, 1002, intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      try {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        Log.d(TAG, "Scheduled unlock alarm at $triggerAtMillis")
      } catch (e: SecurityException) {
        alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
      } catch (e: Exception) {
        Log.e(TAG, "Failed to schedule unlock alarm", e)
      }
    }
    
    fun cancelAll(context: Context) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      
      val lockIntent = Intent(context, PrayerLockAlarmReceiver::class.java).apply { action = ACTION_LOCK }
      val lockPendingIntent = PendingIntent.getBroadcast(
        context, 1001, lockIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      alarmManager.cancel(lockPendingIntent)
      
      val unlockIntent = Intent(context, PrayerLockAlarmReceiver::class.java).apply { action = ACTION_UNLOCK }
      val unlockPendingIntent = PendingIntent.getBroadcast(
        context, 1002, unlockIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      alarmManager.cancel(unlockPendingIntent)
    }

    fun rescheduleFromData(context: Context) {
      val basePackages = AppBlockerPrefs.getBaseBlockedPackages(context)
      if (basePackages.isEmpty()) {
        Log.d(TAG, "No base packages configured. Skipping boot recovery.")
        return
      }
      
      val windowMinutes = AppBlockerPrefs.getPrayerWindowMinutes(context)
      
      try {
        val file = File(context.filesDir, "widget_data.json")
        if (!file.exists()) return
        val content = file.readText()
        val timingsJson = JSONObject(content).optJSONObject("timings") ?: return
        
        val now = Calendar.getInstance()
        val dateFormat = SimpleDateFormat("dd-MM-yyyy", Locale.US)
        val timeFormat = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.US)
        
        val todayStr = dateFormat.format(now.time)
        val todayTimings = timingsJson.optJSONObject(todayStr) ?: return
        
        val obligatoryNames = arrayOf("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
        val prayerTimes = mutableListOf<Date>()
        
        for (name in obligatoryNames) {
          val rawTime = todayTimings.optString(name)
          if (rawTime.isNotEmpty()) {
            val cleanedTime = rawTime.substring(0, 5)
            val date = timeFormat.parse("$todayStr $cleanedTime")
            if (date != null) {
              prayerTimes.add(date)
            }
          }
        }
        
        val tomorrow = Calendar.getInstance()
        tomorrow.add(Calendar.DAY_OF_YEAR, 1)
        val tomorrowStr = dateFormat.format(tomorrow.time)
        val tomorrowTimings = timingsJson.optJSONObject(tomorrowStr)
        if (tomorrowTimings != null) {
          for (name in obligatoryNames) {
            val rawTime = tomorrowTimings.optString(name)
            if (rawTime.isNotEmpty()) {
              val cleanedTime = rawTime.substring(0, 5)
              val date = timeFormat.parse("$tomorrowStr $cleanedTime")
              if (date != null) {
                prayerTimes.add(date)
              }
            }
          }
        }
        
        val currentTimeMs = now.timeInMillis
        var activeWindowEndMs: Long? = null
        var nextWindowStartMs: Long? = null
        var nextWindowEndMs: Long? = null
        
        for (prayerDate in prayerTimes) {
          val startMs = prayerDate.time
          val endMs = startMs + (windowMinutes * 60_000L)
          
          if (currentTimeMs in startMs until endMs) {
            activeWindowEndMs = endMs
          } else if (startMs > currentTimeMs && nextWindowStartMs == null) {
            nextWindowStartMs = startMs
            nextWindowEndMs = endMs
          }
        }
        
        if (activeWindowEndMs != null) {
          Log.d(TAG, "Boot recovery: Currently inside a prayer window. Locking immediately.")
          AppBlockerService.setBlockedPackages(context, basePackages)
          AppBlockerService.start(context)
          scheduleUnlock(context, activeWindowEndMs)
        }
        
        if (nextWindowStartMs != null && nextWindowEndMs != null) {
          Log.d(TAG, "Boot recovery: Scheduling next lock at $nextWindowStartMs")
          scheduleLock(context, nextWindowStartMs, basePackages.toList())
          scheduleUnlock(context, nextWindowEndMs)
        }
        
      } catch (e: Exception) {
        Log.e(TAG, "Failed to natively recover prayer lock alarms", e)
      }
    }
  }
}
