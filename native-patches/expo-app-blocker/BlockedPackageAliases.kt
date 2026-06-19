package expo.modules.appblocker

/**
 * Maps popular apps to every package name they ship under (Lite, regional,
 * sibling apps). Blocking one Instagram selection must catch com.instagram.lite too.
 */
object BlockedPackageAliases {
  private val GROUPS: Map<String, Set<String>> = mapOf(
    "com.instagram.android" to setOf(
      "com.instagram.lite",
      "com.instagram.barcelona",
    ),
    "com.facebook.katana" to setOf(
      "com.facebook.lite",
      "com.facebook.orca",
      "com.facebook.pages.app",
    ),
    "com.zhiliaoapp.musically" to setOf(
      "com.ss.android.ugc.trill",
      "com.ss.android.ugc.aweme",
    ),
    "com.google.android.youtube" to setOf(
      "com.google.android.apps.youtube.music",
      "com.google.android.youtube.go",
    ),
    "com.whatsapp" to setOf("com.whatsapp.w4b"),
    "com.twitter.android" to setOf("com.twitter.android.lite"),
    "com.snapchat.android" to setOf("com.snapchat.android.lite"),
  )

  private val packageToCanonical: Map<String, String> by lazy {
    val map = mutableMapOf<String, String>()
    for ((canonical, aliases) in GROUPS) {
      map[canonical] = canonical
      for (alias in aliases) map[alias] = canonical
    }
    map
  }

  fun expand(packages: Collection<String>): Set<String> {
    val out = mutableSetOf<String>()
    for (pkg in packages) {
      val trimmed = pkg.trim()
      if (trimmed.isEmpty()) continue
      out.add(trimmed)
      val canonical = packageToCanonical[trimmed] ?: trimmed
      out.add(canonical)
      GROUPS[canonical]?.let { out.addAll(it) }
      GROUPS[trimmed]?.let { out.addAll(it) }
    }
    return out
  }

  fun matches(foreground: String, blocked: Set<String>): Boolean {
    if (foreground in blocked) return true
    val fgCanonical = packageToCanonical[foreground] ?: foreground
    for (b in blocked) {
      if (b == foreground) return true
      val bCanonical = packageToCanonical[b] ?: b
      if (fgCanonical == bCanonical) return true
    }
    return false
  }
}
