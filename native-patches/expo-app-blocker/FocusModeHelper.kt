package expo.modules.appblocker

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Build
import android.provider.Settings

/**
 * Saves and restores system DND + ringer mode for Quran Focus Mode.
 * Requires notification policy access on Android 6+ for full DND.
 */
object FocusModeHelper {
  private var savedInterruptionFilter: Int? = null
  private var savedRingerMode: Int? = null

  fun hasDndPermission(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return nm.isNotificationPolicyAccessGranted
  }

  fun openDndSettings(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  fun enableFocus(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (!nm.isNotificationPolicyAccessGranted) return false
      if (savedInterruptionFilter == null) {
        savedInterruptionFilter = nm.currentInterruptionFilter
      }
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
    }

    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (savedRingerMode == null) {
      savedRingerMode = am.ringerMode
    }
    try {
      am.ringerMode = AudioManager.RINGER_MODE_SILENT
    } catch (_: Exception) {
      // Some devices restrict programmatic ringer changes.
    }
    return true
  }

  fun disableFocus(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val saved = savedInterruptionFilter
      if (nm.isNotificationPolicyAccessGranted && saved != null) {
        try {
          nm.setInterruptionFilter(saved)
        } catch (_: Exception) {
          nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
        }
      }
    }
    savedInterruptionFilter = null

    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val savedRinger = savedRingerMode
    if (savedRinger != null) {
      try {
        am.ringerMode = savedRinger
      } catch (_: Exception) {
        // Ignore restore failures.
      }
    }
    savedRingerMode = null
  }

  fun isFocusActive(): Boolean = savedInterruptionFilter != null || savedRingerMode != null
}
