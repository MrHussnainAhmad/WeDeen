package expo.modules.appblocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

class AppBlockerService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastForegroundPackage: String? = null
  private var currentForeground: String? = null
  private lateinit var overlayManager: OverlayManager
  private val unlockController by lazy { TemporaryUnlockController(this) }
  private var consumingSinceMs = 0L
  private var blocking = false
  private var lastBlockedNotifyAt = 0L

  private val pollRunnable = object : Runnable {
    override fun run() {
      tick()
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  private fun tick() {
    getCurrentForegroundPackage()?.let { currentForeground = it }
    val foreground = currentForeground

    if (foreground != null && isBlocked(foreground) && unlockController.hasTimeLeft) {
      val now = System.currentTimeMillis()
      if (consumingSinceMs > 0L) unlockController.consume(now - consumingSinceMs)
      consumingSinceMs = now
      if (unlockController.hasTimeLeft) {
        clearBlock()
      } else {
        Log.d(TAG, "Earned time exhausted in foreground app: $foreground")
        enforceBlock(foreground, BlockReason.EXPIRED)
      }
      lastForegroundPackage = foreground
      return
    }

    if (foreground != null && isBlocked(foreground)) {
      consumingSinceMs = 0L
      if (!blocking || foreground != lastForegroundPackage) {
        Log.d(TAG, "Blocked app in foreground: $foreground")
        enforceBlock(foreground, BlockReason.OPENED)
      }
      lastForegroundPackage = foreground
      return
    }

    consumingSinceMs = 0L
    if (blocking) {
      if (foreground != null && !isBlocked(foreground)) {
        clearBlock()
      }
    }
    lastForegroundPackage = foreground
  }

  private fun clearBlock() {
    if (blocking) {
      overlayManager.hide()
      blocking = false
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "AppBlockerService onCreate")
    overlayManager = OverlayManager(this)
    createChannelsIfNeeded()
    startForeground(NOTIFICATION_ID, buildNotification())
    handler.post(pollRunnable)
  }

  private fun isBlocked(packageName: String): Boolean =
    packageName in AppBlockerPrefs.getBlockedPackages(this)

  private fun enforceBlock(packageName: String, reason: BlockReason) {
    overlayManager.show(packageName, reason)
    maybeShowBlockedNotification(packageName, reason)
    recordIntercept(packageName)
    blocking = true
    consumingSinceMs = 0L
  }

  private fun recordIntercept(packageName: String) {
    val appName = try {
      val pm = this.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
    } catch (e: Exception) {
      packageName
    }
    AppBlockerPrefs.appendIntercept(this, appName, System.currentTimeMillis())
  }

  private fun maybeShowBlockedNotification(packageName: String, reason: BlockReason) {
    val titleTemplate = AppBlockerPrefs.getNotificationTitle(this)
    if (titleTemplate.isBlank()) return

    val now = System.currentTimeMillis()
    if (now - lastBlockedNotifyAt < BLOCKED_NOTIFY_DEBOUNCE_MS) return
    lastBlockedNotifyAt = now

    val appName = try {
      val pm = this.packageManager
      val appInfo = pm.getApplicationInfo(packageName, 0)
      pm.getApplicationLabel(appInfo).toString()
    } catch (e: Exception) {
      packageName
    }

    val title = titleTemplate.replace("{appName}", appName)
    val text = AppBlockerPrefs.getNotificationText(this).replace("{appName}", appName)

    val scheme = getAppScheme()
    val deepLinkIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse(
        "${scheme}://blocked?app=${Uri.encode(appName)}" +
          "&package=${Uri.encode(packageName)}&reason=${reason.slug}"
      )
    ).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    val launchIntent = packageManager.getLaunchIntentForPackage(this.packageName)
      ?.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP) }

    val resolvedIntent = try {
      deepLinkIntent.resolveActivity(packageManager)?.let { deepLinkIntent } ?: launchIntent
    } catch (e: Exception) {
      launchIntent
    } ?: deepLinkIntent

    val pendingIntent = PendingIntent.getActivity(
      this, packageName.hashCode(), resolvedIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification = NotificationCompat.Builder(this, BLOCKED_CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(applicationInfo.icon)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pendingIntent)
      .build()

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(BLOCKED_NOTIFICATION_ID, notification)
  }

  private fun getAppScheme(): String {
    val resId = resources.getIdentifier("expo_app_blocker_scheme", "string", packageName)
    if (resId != 0) return getString(resId)
    return try {
      packageManager.getLaunchIntentForPackage(packageName)?.data?.scheme
        ?: packageName.replace(".", "-")
    } catch (e: Exception) {
      packageName.replace(".", "-")
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_TEMPORARY_UNLOCK -> {
        val minutes = intent.getIntExtra(EXTRA_DURATION_MINUTES, 0)
        Log.d(TAG, "Granting $minutes minutes of earned time")
        unlockController.grant(minutes)
        consumingSinceMs = 0L
        clearBlock()
      }
      ACTION_RELOCK -> {
        Log.d(TAG, "Relock: dropping earned time")
        unlockController.clear()
        consumingSinceMs = 0L
        lastForegroundPackage = null
        currentForeground = null
        clearBlock()
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    Log.d(TAG, "AppBlockerService onDestroy")
    handler.removeCallbacks(pollRunnable)
    overlayManager.hide()
    super.onDestroy()
  }

  private fun getCurrentForegroundPackage(): String? {
    val usageStatsManager =
      getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val endTime = System.currentTimeMillis()
    val beginTime = endTime - LOOKBACK_WINDOW_MS
    val events = usageStatsManager.queryEvents(beginTime, endTime)
    val event = UsageEvents.Event()
    var latestForeground: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED,
        UsageEvents.Event.MOVE_TO_FOREGROUND -> {
          latestForeground = event.packageName
        }
      }
    }
    return latestForeground
  }

  private fun createChannelsIfNeeded() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      val serviceChannel = NotificationChannel(
        CHANNEL_ID,
        "Prayer Lock",
        NotificationManager.IMPORTANCE_MIN,
      ).apply {
        description = "Required while Prayer Lock is active during a prayer window"
        setShowBadge(false)
        setSound(null, null)
        enableLights(false)
        enableVibration(false)
      }
      manager.createNotificationChannel(serviceChannel)

      val blockedChannel = NotificationChannel(
        BLOCKED_CHANNEL_ID, "Blocked App Alerts", NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Notifications when a blocked app is detected"
      }
      manager.createNotificationChannel(blockedChannel)
    }
  }

  private fun buildNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(" ")
      .setContentText(" ")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()

  companion object {
    private const val TAG = "ExpoAppBlocker"
    private const val CHANNEL_ID = "expo_app_blocker_channel_silent"
    private const val BLOCKED_CHANNEL_ID = "expo_app_blocker_blocked"
    private const val NOTIFICATION_ID = 9001
    private const val BLOCKED_NOTIFICATION_ID = 9002
    private const val POLL_INTERVAL_MS = 400L
    private const val LOOKBACK_WINDOW_MS = 15_000L
    private const val BLOCKED_NOTIFY_DEBOUNCE_MS = 60_000L
    private const val ACTION_TEMPORARY_UNLOCK = "expo.modules.appblocker.TEMPORARY_UNLOCK"
    private const val ACTION_RELOCK = "expo.modules.appblocker.RELOCK"
    private const val EXTRA_DURATION_MINUTES = "duration_minutes"

    fun start(context: Context) {
      startCommand(context, Intent(context, AppBlockerService::class.java))
    }

    fun stop(context: Context) {
      val intent = Intent(context, AppBlockerService::class.java)
      context.stopService(intent)
    }

    fun temporaryUnlock(context: Context, durationMinutes: Int) {
      val intent = Intent(context, AppBlockerService::class.java).apply {
        action = ACTION_TEMPORARY_UNLOCK
        putExtra(EXTRA_DURATION_MINUTES, durationMinutes)
      }
      startCommand(context, intent)
    }

    fun relock(context: Context) {
      val intent = Intent(context, AppBlockerService::class.java).apply {
        action = ACTION_RELOCK
      }
      startCommand(context, intent)
    }

    private fun startCommand(context: Context, intent: Intent) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }
  }
}
