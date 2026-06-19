package expo.modules.appblocker

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class OverlayManager(private val context: Context) {
  private val windowManager: WindowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  private var overlayView: View? = null
  private var currentBlockedPackage: String? = null

  fun show(blockedPackageName: String? = null, reason: BlockReason = BlockReason.OPENED) {
    if (overlayView != null) {
      if (blockedPackageName != null && blockedPackageName == currentBlockedPackage) {
        return
      }
      hide()
    }

    currentBlockedPackage = blockedPackageName
    val appName = blockedPackageName?.let { resolveAppName(it) } ?: ""
    val view = buildOverlayView(appName, blockedPackageName)
    try {
      windowManager.addView(view, buildLayoutParams())
      overlayView = view
      Log.d(TAG, "Overlay shown for $blockedPackageName")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to add overlay view", e)
      currentBlockedPackage = null
    }
  }

  fun hide() {
    val view = overlayView ?: return
    try {
      windowManager.removeView(view)
      Log.d(TAG, "Overlay hidden")
    } catch (e: Exception) {
      Log.e(TAG, "Failed to remove overlay view", e)
    }
    overlayView = null
    currentBlockedPackage = null
  }

  private fun resolveAppName(packageName: String): String = try {
    val pm = context.packageManager
    val appInfo = pm.getApplicationInfo(packageName, 0)
    pm.getApplicationLabel(appInfo).toString()
  } catch (e: Exception) {
    packageName
  }

  private fun openDeepLink(blockedPackageName: String, action: String, reason: BlockReason) {
    hide()
    AppBlockerService.temporaryUnlock(context, 3)

    val appName = resolveAppName(blockedPackageName)
    val scheme = getAppScheme()
    val deepLinkIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse(
        "${scheme}://blocked?app=${Uri.encode(appName)}" +
          "&package=${Uri.encode(blockedPackageName)}" +
          "&reason=${reason.slug}&action=${Uri.encode(action)}"
      )
    ).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    try {
      context.startActivity(deepLinkIntent)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to deep link for $action", e)
    }
  }

  private fun getAppScheme(): String {
    val resId = context.resources.getIdentifier("expo_app_blocker_scheme", "string", context.packageName)
    if (resId != 0) return context.getString(resId)
    return context.packageName.replace(".", "-")
  }

  private fun buildOverlayView(appName: String, blockedPackageName: String?): View {
    val density = context.resources.displayMetrics.density
    fun dp(value: Float) = (value * density).toInt()

    val overlayTitle = AppBlockerPrefs.getOverlayTitle(context)
      .replace("{appName}", appName)
    val overlayText = AppBlockerPrefs.getOverlayText(context)
      .replace("{appName}", appName)
    val backgroundColor = parseColorOrDefault(
      AppBlockerPrefs.getOverlayBackgroundColor(context),
      Color.parseColor("#0F3D2E"),
    )
    val titleColor = parseColorOrDefault(
      AppBlockerPrefs.getOverlayTitleColor(context),
      Color.WHITE,
    )
    val textColor = parseColorOrDefault(
      AppBlockerPrefs.getOverlayTextColor(context),
      Color.parseColor("#E0E0E0"),
    )
    val titleFontSize = AppBlockerPrefs.getOverlayTitleFontSize(context)
    val textFontSize = AppBlockerPrefs.getOverlayTextFontSize(context)
    val titleBold = AppBlockerPrefs.getOverlayTitleBold(context)
    val padding = AppBlockerPrefs.getOverlayPadding(context)
    val iconSize = AppBlockerPrefs.getOverlayIconSize(context)
    val iconGap = AppBlockerPrefs.getOverlayIconBottomMargin(context)
    val titleGap = AppBlockerPrefs.getOverlayTitleBottomMargin(context)

    return LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(backgroundColor)
      setPadding(dp(padding), dp(padding), dp(padding), dp(padding))

      val iconResId = context.resources.getIdentifier(
        "expo_app_blocker_overlay_icon",
        "drawable",
        context.packageName,
      )
      if (iconResId != 0) {
        addView(ImageView(context).apply {
          val bitmap = BitmapFactory.decodeResource(context.resources, iconResId)
          if (bitmap != null) setImageBitmap(bitmap)
          val size = dp(iconSize)
          layoutParams = LinearLayout.LayoutParams(size, size).apply {
            bottomMargin = dp(iconGap)
          }
        })
      }

      addView(TextView(context).apply {
        text = overlayTitle
        setTextColor(titleColor)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, titleFontSize)
        if (titleBold) setTypeface(typeface, Typeface.BOLD)
        gravity = Gravity.CENTER
        setPadding(0, 0, 0, dp(titleGap))
      })

      addView(TextView(context).apply {
        text = overlayText
        setTextColor(textColor)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, textFontSize)
        gravity = Gravity.CENTER
        setPadding(dp(8f), 0, dp(8f), dp(28f))
      })

      if (blockedPackageName != null) {
        addView(buildActionButton(
          label = "I have prayed",
          background = Color.parseColor("#C59B27"),
          textColor = Color.parseColor("#063528"),
          bottomMargin = dp(12f),
        ) {
          openDeepLink(blockedPackageName, "prayed", BlockReason.OPENED)
        })

        addView(buildActionButton(
          label = "Emergency unlock",
          background = Color.parseColor("#1A4D3C"),
          textColor = Color.WHITE,
          bottomMargin = 0,
        ) {
          openDeepLink(blockedPackageName, "emergency", BlockReason.OPENED)
        })
      }
    }
  }

  private fun buildActionButton(
    label: String,
    background: Int,
    textColor: Int,
    bottomMargin: Int,
    onClick: () -> Unit,
  ): TextView {
    val density = context.resources.displayMetrics.density
    fun dp(value: Float) = (value * density).toInt()

    return TextView(context).apply {
      text = label
      setTextColor(textColor)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      val drawable = GradientDrawable().apply {
        setColor(background)
        cornerRadius = dp(14f).toFloat()
      }
      background = drawable
      setPadding(dp(20f), dp(14f), dp(20f), dp(14f))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply {
        leftMargin = dp(24f)
        rightMargin = dp(24f)
        this.bottomMargin = bottomMargin
      }
      setOnClickListener { onClick() }
    }
  }

  private fun parseColorOrDefault(hex: String, fallback: Int): Int = try {
    Color.parseColor(hex)
  } catch (_: IllegalArgumentException) {
    fallback
  }

  private fun buildLayoutParams(): WindowManager.LayoutParams {
    @Suppress("DEPRECATION")
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      WindowManager.LayoutParams.TYPE_PHONE
    }

    return WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_FULLSCREEN or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.OPAQUE
    ).apply {
      gravity = Gravity.TOP or Gravity.START
    }
  }

  companion object {
    private const val TAG = "ExpoAppBlocker"
  }
}
