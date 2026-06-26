package expo.modules.appblocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
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
import java.lang.ref.WeakReference

class AppBlockerService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var lastForegroundPackage: String? = null
  private var currentForeground: String? = null
  private lateinit var overlayManager: OverlayManager
  private val unlockController by lazy { TemporaryUnlockController(this) }
  private var consumingSinceMs = 0L
  private var blocking = false
  private var blockedTargetPackage: String? = null
  private var lastBlockedNotifyAt = 0L
  private var lastHomeSentAt = 0L
  private var allowWeDeenForegroundUntilMs = 0L
  private var blockActivatedAtMs = 0L
  private var homeFallbackRunnable: Runnable? = null

  private var audioFocusHeld = false
  private var audioFocusRequestObj: android.media.AudioFocusRequest? = null
  private val audioFocusListener =
    android.media.AudioManager.OnAudioFocusChangeListener { focusChange ->
      logDiag("audioFocus", "change=$focusChange held=$audioFocusHeld blocking=$blocking")
      if (focusChange == android.media.AudioManager.AUDIOFOCUS_LOSS &&
        audioFocusHeld && blocking
      ) {
        handler.postDelayed({ if (blocking) requestAudioFocusForBlock() }, AUDIO_REFOCUS_DELAY_MS)
      }
    }

  private fun requestAudioFocusForBlock() {
    if (audioFocusHeld) return
    try {
      val am = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
      val result: Int
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val attrs = android.media.AudioAttributes.Builder()
          .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
          .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MOVIE)
          .build()
        val req =
          android.media.AudioFocusRequest.Builder(android.media.AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(attrs)
            .setAcceptsDelayedFocusGain(false)
            .setOnAudioFocusChangeListener(audioFocusListener, handler)
            .build()
        result = am.requestAudioFocus(req)
        if (result == android.media.AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
          audioFocusRequestObj = req
        }
      } else {
        @Suppress("DEPRECATION")
        result = am.requestAudioFocus(
          audioFocusListener,
          android.media.AudioManager.STREAM_MUSIC,
          android.media.AudioManager.AUDIOFOCUS_GAIN,
        )
      }
      audioFocusHeld = (result == android.media.AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
      logDiag("audioFocus", "requested result=$result held=$audioFocusHeld")
    } catch (e: Exception) {
      Log.w(TAG, "diag audioFocus: request failed", e)
    }
  }

  private fun releaseAudioFocusForBlock() {
    if (!audioFocusHeld) {
      audioFocusRequestObj = null
      return
    }
    try {
      val am = getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        audioFocusRequestObj?.let { am.abandonAudioFocusRequest(it) }
        audioFocusRequestObj = null
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(audioFocusListener)
      }
      audioFocusHeld = false
      logDiag("audioFocus", "released")
    } catch (e: Exception) {
      Log.w(TAG, "diag audioFocus: release failed", e)
      audioFocusHeld = false
      audioFocusRequestObj = null
    }
  }

  private val pollRunnable = object : Runnable {
    override fun run() {
      tick()
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  private fun tick() {
    val foreground = resolveForegroundPackage()
    currentForeground = foreground
    logTickState(foreground)

    if (foreground != null && isBlocked(foreground) && unlockController.hasTimeLeft) {
      val now = System.currentTimeMillis()
      if (consumingSinceMs > 0L) unlockController.consume(now - consumingSinceMs)
      consumingSinceMs = now
      cancelHomeFallback()
      if (unlockController.hasTimeLeft) {
        logDiag("clearBlock", "earned-time active in blocked app $foreground")
        clearBlock()
      } else {
        Log.d(TAG, "Earned time exhausted in foreground app: $foreground")
        enforceBlock(foreground, BlockReason.EXPIRED)
      }
      lastForegroundPackage = foreground
      return
    }

    consumingSinceMs = 0L

    if (foreground != null && isBlocked(foreground)) {
      enforceBlock(foreground, BlockReason.OPENED)
      lastForegroundPackage = foreground
      return
    }

    if (blocking) {
      val target = blockedTargetPackage
      if (target != null) {
        maintainActiveBlock(target, foreground)
        lastForegroundPackage = foreground
        return
      }
    }

    lastForegroundPackage = foreground
  }

  /**
   * Keep the Prayer Lock overlay up while [blocking] is true. Usage stats often
   * report launcher/system/middleware (or go stale/null) while the blocked app
   * is still visible under the overlay — never clear the block for that alone.
   */
  private fun maintainActiveBlock(target: String, foreground: String?) {
    cancelHomeFallback()

    if (foreground == packageName) {
      logDiag("hide", "WeDeen foreground")
      overlayManager.hide()
      return
    }

    if (foreground != null && isLikelyHomeScreen(foreground)) {
      logDiag("hide", "home/launcher foreground=$foreground")
      overlayManager.hide()
      return
    }

    if (foreground != null &&
      (isTransientOverlayPackage(foreground) || isAppPrivacyGatePackage(foreground))
    ) {
      logDiag("ensureShown", "transient/privacy gate foreground=$foreground target=$target")
      overlayManager.ensureShown(target, BlockReason.OPENED)
      return
    }

    val reason = when {
      foreground == null -> "usage stats stale/null"
      !isBlocked(foreground) -> "foreground=$foreground not blocked"
      else -> "maintain overlay"
    }
    logDiag("ensureShown", "$reason — keep blocking $target")
    overlayManager.ensureShown(target, BlockReason.OPENED)
  }

  private fun isLikelyHomeScreen(packageName: String): Boolean =
    packageName.contains("launcher", ignoreCase = true) ||
      packageName in HOME_SCREEN_PACKAGES

  private fun resolveForegroundPackage(): String? {
    val hint = consumeAccessibilityHint()
    if (hint != null) return hint
    val fromUsage = getCurrentForegroundPackageFromUsageStats()
    if (fromUsage != null) return fromUsage
    if (blocking) {
      blockedTargetPackage?.let { target ->
        if (isPackageRecentlyVisible(target)) {
          logDiag("resolveForeground", "usage stale — assuming blocked target $target")
          return target
        }
      }
    }
    return null
  }

  private fun isPackageRecentlyVisible(packageName: String): Boolean {
    val usageStatsManager =
      getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val endTime = System.currentTimeMillis()
    val beginTime = endTime - ACTIVE_BLOCK_LOOKBACK_MS
    return isPackageVisibleInWindow(usageStatsManager, packageName, beginTime, endTime)
  }

  private fun clearBlock(reason: String = "unspecified") {
    cancelHomeFallback()
    if (blocking) {
      logDiag("clearBlock", reason)
      overlayManager.hide()
      releaseAudioFocusForBlock()
      blocking = false
      blockedTargetPackage = null
      blockActivatedAtMs = 0L
    }
  }

  private fun logTickState(foreground: String?) {
    if (!DIAG_ENABLED) return
    val fgBlocked = foreground?.let { isBlocked(it) } ?: false
    Log.d(
      TAG,
      "diag tick fg=$foreground fgBlocked=$fgBlocked blocking=$blocking " +
        "target=$blockedTargetPackage overlay=${overlayManager.isAttached()} " +
        "lastFg=$lastForegroundPackage",
    )
  }

  private fun logDiag(action: String, detail: String) {
    if (!DIAG_ENABLED) return
    Log.d(TAG, "diag $action: $detail")
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "AppBlockerService onCreate")
    instanceRef = WeakReference(this)
    overlayManager = OverlayManager(this)
    createChannelsIfNeeded()
    startForeground(NOTIFICATION_ID, buildNotification())
    handler.post(pollRunnable)
  }

  override fun onDestroy() {
    Log.d(TAG, "AppBlockerService onDestroy")
    handler.removeCallbacks(pollRunnable)
    cancelHomeFallback()
    overlayManager.hide()
    releaseAudioFocusForBlock()
    if (instanceRef?.get() === this) instanceRef = null
    super.onDestroy()
  }

  private fun isBlocked(packageName: String): Boolean {
    val blocked = AppBlockerPrefs.getBlockedPackages(this)
    if (blocked.isEmpty()) return false
    return BlockedPackageAliases.matches(packageName, blocked)
  }

  /**
   * Overlay-first block: keep the selected app covered, and request audio focus
   * so media apps pause/duck while blocked. This avoids Accessibility and
   * app-kill APIs.
   */
  private fun enforceBlock(
    packageName: String,
    reason: BlockReason,
    skipHomeFallback: Boolean = false,
  ) {
    val firstIntercept = !blocking || blockedTargetPackage != packageName

    overlayManager.ensureShown(packageName, reason)

    if (firstIntercept) {
      maybeShowBlockedNotification(packageName, reason)
      recordIntercept(packageName)
      blockActivatedAtMs = System.currentTimeMillis()
      requestAudioFocusForBlock()
    }

    blocking = true
    blockedTargetPackage = packageName
    consumingSinceMs = 0L

    // Keep Prayer Lock as a stable overlay, not an app-kill/home-bounce flow.
    // Sending HOME here made some devices reopen/close the blocked app in a loop.
  }

  private fun scheduleHomeFallbackIfNeeded(packageName: String) {
    cancelHomeFallback()
    val runnable = Runnable {
      homeFallbackRunnable = null
      if (!blocking || blockedTargetPackage != packageName) return@Runnable
      if (unlockController.hasTimeLeft) return@Runnable

      val fg = resolveForegroundPackage()
      if (fg != null && isBlocked(fg)) {
        Log.d(TAG, "Blocked app still foreground after overlay — HOME fallback for $fg")
        sendUserToHomeIfNeeded()
        overlayManager.ensureShown(packageName, BlockReason.OPENED)
      }
    }
    homeFallbackRunnable = runnable
    handler.postDelayed(runnable, HOME_FALLBACK_DELAY_MS)
  }

  private fun cancelHomeFallback() {
    homeFallbackRunnable?.let { handler.removeCallbacks(it) }
    homeFallbackRunnable = null
  }

  private fun sendUserToHomeIfNeeded() {
    val now = System.currentTimeMillis()
    if (now - lastHomeSentAt < HOME_COOLDOWN_MS) return
    lastHomeSentAt = now
    try {
      val home = Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      startActivity(home)
      Log.d(TAG, "HOME fallback — blocked app had internal lock")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to send user HOME", e)
    }
  }

  private fun isTransientOverlayPackage(packageName: String): Boolean =
    packageName in TRANSIENT_OVERLAY_PACKAGES

  private fun isAppPrivacyGatePackage(packageName: String): Boolean {
    if (packageName in VENDOR_APPLOCK_PACKAGES) return true
    val lower = packageName.lowercase()
    return lower.contains("applock") ||
      lower.contains("privacy") ||
      lower.contains("security") ||
      lower.contains("biometric") ||
      lower.contains("keyguard") ||
      lower.contains("fingerpri") ||
      lower.contains("faceunlock") ||
      lower.contains("locksetting")
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
        clearBlock("temporary-unlock")
      }
      ACTION_RELOCK -> {
        Log.d(TAG, "Relock: dropping earned time")
        unlockController.clear()
        consumingSinceMs = 0L
        allowWeDeenForegroundUntilMs = 0L
        lastForegroundPackage = null
        currentForeground = null
        clearBlock("relock")
      }
      ACTION_ALLOW_WEDEEN_FOREGROUND -> {
        allowWeDeenForegroundUntilMs = System.currentTimeMillis() + WEDEEN_CONFIRMATION_GRACE_MS
      }
      ACTION_FOREGROUND_HINT -> {
        val pkg = intent.getStringExtra(EXTRA_FOREGROUND_PACKAGE)
        if (!pkg.isNullOrBlank()) {
          latestAccessibilityPackage = pkg
          latestAccessibilityAtMs = System.currentTimeMillis()
          handler.post { tick() }
        }
      }
      ACTION_SET_BLOCKED -> {
        val list = intent.getStringArrayListExtra(EXTRA_BLOCKED_PACKAGES)
        if (list != null) {
          val expanded = BlockedPackageAliases.expand(list)
          AppBlockerPrefs.setBlockedPackages(this, expanded)
          Log.d(TAG, "Blocked packages (${expanded.size}): $expanded")
        }
      }
    }
    return START_STICKY
  }

  /**
   * Two-layer foreground detection for Meta / TikTok / Instagram reliability:
   * 1) UsageEvents (ACTIVITY_RESUMED / MOVE_TO_FOREGROUND) — fastest transitions
   * 2) lastTimeVisible stats fallback — catches apps UsageEvents sometimes miss
   */
  private fun getCurrentForegroundPackageFromUsageStats(): String? {
    val usageStatsManager =
      getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val endTime = System.currentTimeMillis()
    val beginTime = endTime - if (blocking) ACTIVE_BLOCK_LOOKBACK_MS else LOOKBACK_WINDOW_MS

    var fromEvents: String? = null
    var latestEventTime = 0L
    var latestBlockedPackage: String? = null
    var latestBlockedTime = 0L
    try {
      val events = usageStatsManager.queryEvents(beginTime, endTime)
      val event = UsageEvents.Event()
      while (events.hasNextEvent()) {
        events.getNextEvent(event)
        when (event.eventType) {
          UsageEvents.Event.ACTIVITY_RESUMED,
          UsageEvents.Event.MOVE_TO_FOREGROUND -> {
            if (event.timeStamp >= latestEventTime) {
              latestEventTime = event.timeStamp
              fromEvents = event.packageName
            }
            if (isBlocked(event.packageName) && event.timeStamp >= latestBlockedTime) {
              latestBlockedTime = event.timeStamp
              latestBlockedPackage = event.packageName
            }
          }
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "queryEvents failed", e)
    }

    if (fromEvents != null) {
      if (isBlocked(fromEvents)) return fromEvents

      val recentBlocked = latestBlockedPackage
      if (recentBlocked != null &&
        latestBlockedTime >= endTime - BLOCKED_EVENT_GRACE_MS &&
        (isTransientOverlayPackage(fromEvents) ||
          isAppPrivacyGatePackage(fromEvents) ||
          isLikelyHomeScreen(fromEvents))
      ) {
        logDiag(
          "resolveForeground",
          "latest=$fromEvents after blocked event $recentBlocked; treating as blocked"
        )
        return recentBlocked
      }

      if (blocking) {
        blockedTargetPackage?.let { target ->
          // Do not include home/launcher here. If the user presses Home, the
          // launcher must reach maintainActiveBlock(), which hides the overlay.
          // The earlier grace check still handles app-lock biometric transitions.
          if ((fromEvents == packageName ||
              isTransientOverlayPackage(fromEvents) ||
              isAppPrivacyGatePackage(fromEvents)) &&
            isPackageVisibleInWindow(
              usageStatsManager,
              target,
              beginTime,
              endTime,
              ACTIVE_BLOCK_FALLBACK_TTL_MS
            )
          ) {
            logDiag("resolveForeground", "latest=$fromEvents while $target still visible")
            return target
          }
        }
      }

      return fromEvents
    }

    val fallback = getMostRecentlyVisiblePackage(usageStatsManager, beginTime, endTime)
    if (fallback != null) return fallback

    if (blocking) {
      blockedTargetPackage?.let { target ->
        if (isPackageVisibleInWindow(usageStatsManager, target, beginTime, endTime)) {
          logDiag("resolveForeground", "events expired — blocked target $target still visible")
          return target
        }
      }
    }
    return null
  }

  private fun getMostRecentlyVisiblePackage(
    usageStatsManager: UsageStatsManager,
    beginTime: Long,
    endTime: Long,
  ): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return null
    try {
      val stats: List<UsageStats> =
        usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, beginTime, endTime)
          ?: return null
      val ttlMs = if (blocking) ACTIVE_BLOCK_FALLBACK_TTL_MS else USAGE_STATS_FALLBACK_TTL_MS
      var bestPkg: String? = null
      var bestVisible = 0L
      for (stat in stats) {
        if (stat.lastTimeVisible > bestVisible) {
          bestVisible = stat.lastTimeVisible
          bestPkg = stat.packageName
        }
      }
      if (bestPkg != null && bestVisible >= endTime - ttlMs) {
        return bestPkg
      }
    } catch (e: Exception) {
      Log.w(TAG, "queryUsageStats fallback failed", e)
    }
    return null
  }

  private fun isPackageVisibleInWindow(
    usageStatsManager: UsageStatsManager,
    packageName: String,
    beginTime: Long,
    endTime: Long,
    ttlMs: Long = if (blocking) ACTIVE_BLOCK_FALLBACK_TTL_MS else USAGE_STATS_FALLBACK_TTL_MS,
  ): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
    try {
      val stats: List<UsageStats> =
        usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, beginTime, endTime)
          ?: return false
      for (stat in stats) {
        if (stat.packageName == packageName &&
          stat.lastTimeVisible >= endTime - ttlMs
        ) {
          return true
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "queryUsageStats visibility check failed", e)
    }
    return false
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
    /** Set false after field diagnosis; logs are scoped to Prayer Lock tick/overlay. */
    private const val DIAG_ENABLED = true
    private const val CHANNEL_ID = "expo_app_blocker_channel_silent"
    private const val BLOCKED_CHANNEL_ID = "expo_app_blocker_blocked"
    private const val NOTIFICATION_ID = 9001
    private const val BLOCKED_NOTIFICATION_ID = 9002
    private const val POLL_INTERVAL_MS = 250L
    private const val LOOKBACK_WINDOW_MS = 8_000L
    private const val ACTIVE_BLOCK_LOOKBACK_MS = 30_000L
    private const val USAGE_STATS_FALLBACK_TTL_MS = 1_200L
    private const val ACTIVE_BLOCK_FALLBACK_TTL_MS = 30_000L
    private const val BLOCKED_EVENT_GRACE_MS = 15_000L
    private const val AUDIO_REFOCUS_DELAY_MS = 800L
    private const val BLOCKED_NOTIFY_DEBOUNCE_MS = 60_000L
    private const val HOME_COOLDOWN_MS = 2_500L
    private const val HOME_FALLBACK_DELAY_MS = 450L
    private const val ACCESSIBILITY_HINT_TTL_MS = 1_200L
    private const val WEDEEN_CONFIRMATION_GRACE_MS = 12_000L
    private const val ACTION_TEMPORARY_UNLOCK = "expo.modules.appblocker.TEMPORARY_UNLOCK"
    private const val ACTION_RELOCK = "expo.modules.appblocker.RELOCK"
    private const val ACTION_ALLOW_WEDEEN_FOREGROUND = "expo.modules.appblocker.ALLOW_WEDEEN_FOREGROUND"
    private const val ACTION_FOREGROUND_HINT = "expo.modules.appblocker.FOREGROUND_HINT"
    private const val ACTION_SET_BLOCKED = "expo.modules.appblocker.SET_BLOCKED"
    private const val EXTRA_DURATION_MINUTES = "duration_minutes"
    private const val EXTRA_FOREGROUND_PACKAGE = "foreground_package"
    private const val EXTRA_BLOCKED_PACKAGES = "blocked_packages"

    @Volatile
    private var latestAccessibilityPackage: String? = null

    @Volatile
    private var latestAccessibilityAtMs = 0L

    @Volatile
    private var instanceRef: WeakReference<AppBlockerService>? = null

    private val TRANSIENT_OVERLAY_PACKAGES = setOf(
      "android",
      "com.android.systemui",
      "com.android.settings",
      "com.android.keyguard",
      "com.android.biometrics",
      "com.android.server.biometrics",
      "com.google.android.permissioncontroller",
      "com.google.android.gms",
      "com.samsung.android.biometrics.app",
      "com.samsung.android.authfw",
      "com.samsung.android.biometrics",
      "com.miui.securitycenter",
      "com.coloros.safecenter",
      "com.huawei.systemmanager",
    )

    private val HOME_SCREEN_PACKAGES = setOf(
      "com.google.android.apps.nexuslauncher",
      "com.android.launcher3",
      "com.miui.home",
      "com.sec.android.app.launcher",
      "com.huawei.android.launcher",
      "com.oppo.launcher",
      "com.oneplus.launcher",
      "com.teslacoilsw.launcher",
      "com.microsoft.launcher",
      "com.google.android.apps.wellbeing",
    )

    private val VENDOR_APPLOCK_PACKAGES = setOf(
      "com.samsung.android.privateshare",
      "com.sec.android.app.securefolder",
      "com.samsung.android.knox.containeragent",
      "com.miui.privacycomputing",
      "com.miui.permcenter",
      "com.coloros.privacypermission",
      "com.oppo.permissionmanager",
      "com.vivo.permissionmanager",
      "com.oneplus.security",
      "net.dinglisch.android.applock",
      "com.domobile.applock",
      "com.domobile.applockwatcher",
      "com.sp.protector.free",
      "com.litetools.applock",
    )

    fun setAccessibilityBridge(@Suppress("UNUSED_PARAMETER") service: Any?) {
      // Accessibility is optional and not registered by default — no-op unless enabled later.
    }

    fun onAccessibilityForeground(context: Context, packageName: String) {
      latestAccessibilityPackage = packageName
      latestAccessibilityAtMs = System.currentTimeMillis()
      instanceRef?.get()?.handler?.post { instanceRef?.get()?.tick() }
        ?: run {
          val intent = Intent(context, AppBlockerService::class.java).apply {
            action = ACTION_FOREGROUND_HINT
            putExtra(EXTRA_FOREGROUND_PACKAGE, packageName)
          }
          startCommand(context, intent)
        }
    }

    private fun consumeAccessibilityHint(): String? {
      val pkg = latestAccessibilityPackage ?: return null
      val age = System.currentTimeMillis() - latestAccessibilityAtMs
      if (age > ACCESSIBILITY_HINT_TTL_MS) return null
      return pkg
    }

    /** Apply blocked packages with alias expansion on the service thread. */
    fun setBlockedPackages(context: Context, packages: Collection<String>) {
      val expanded = BlockedPackageAliases.expand(packages)
      val intent = Intent(context, AppBlockerService::class.java).apply {
        action = ACTION_SET_BLOCKED
        putStringArrayListExtra(EXTRA_BLOCKED_PACKAGES, ArrayList(expanded))
      }
      startCommand(context, intent)
    }

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

    fun allowWeDeenForeground(context: Context) {
      val intent = Intent(context, AppBlockerService::class.java).apply {
        action = ACTION_ALLOW_WEDEEN_FOREGROUND
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
