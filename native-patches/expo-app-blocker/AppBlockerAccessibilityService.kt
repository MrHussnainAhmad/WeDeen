package expo.modules.appblocker

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * Optional fast path: window-change events fire immediately when a blocked app
 * (or its built-in lock / biometric activity) comes to the foreground. The
 * foreground UsageStats poll can miss short transitions; this does not.
 *
 * User must enable in Settings → Accessibility. Prayer Lock still works via
 * polling + HOME redirect when this is off.
 */
class AppBlockerAccessibilityService : AccessibilityService() {

  override fun onServiceConnected() {
    super.onServiceConnected()
    Log.d(TAG, "Connected")
    AppBlockerService.setAccessibilityBridge(this)
  }

  override fun onDestroy() {
    AppBlockerService.setAccessibilityBridge(null)
    super.onDestroy()
  }

  override fun onInterrupt() {
    // no-op
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    when (event.eventType) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        val pkg = event.packageName?.toString() ?: return
        AppBlockerService.onAccessibilityForeground(applicationContext, pkg)
      }
    }
  }

  companion object {
    private const val TAG = "ExpoAppBlockerA11y"
  }
}
