const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withWedeenPrayerWidgetAndroid(config) {
  // 1. AndroidManifest.xml changes
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    if (!app.receiver) app.receiver = [];
    
    // Check if PrayerWidget is already registered
    const fqdnReceiverName = 'com.hussnainahmadsahi.wedeen.PrayerWidget';
    let receiver = app.receiver.find(
      (entry) =>
        entry.$?.['android:name'] === fqdnReceiverName ||
        entry.$?.['android:name'] === '.PrayerWidget'
    );
    
    const widgetReceiver = {
      $: {
        'android:name': fqdnReceiverName,
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
            { $: { 'android:name': 'com.hussnainahmadsahi.wedeen.UPDATE_WIDGET' } },
            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
            { $: { 'android:name': 'android.intent.action.TIME_SET' } },
            { $: { 'android:name': 'android.intent.action.TIMEZONE_CHANGED' } },
          ],
        },
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/prayer_widget_info',
          },
        },
      ],
    };

    if (!receiver) {
      app.receiver.push(widgetReceiver);
    } else {
      // Overwrite intent-filter and meta-data to ensure they are up to date
      receiver['intent-filter'] = widgetReceiver['intent-filter'];
      receiver['meta-data'] = widgetReceiver['meta-data'];
      receiver.$['android:exported'] = 'true';
    }

    return config;
  });

  // 2. Copy source files in dangerous mod phase
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      
      const patchDir = path.join(projectRoot, 'native-patches', 'prayer-widget');
      
      // Destination directories
      const javaDir = path.join(platformRoot, 'app', 'src', 'main', 'java', 'com', 'hussnainahmadsahi', 'wedeen');
      const xmlDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'xml');
      const layoutDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'layout');
      const drawableDir = path.join(platformRoot, 'app', 'src', 'main', 'res', 'drawable');
      
      // Ensure target folders exist
      if (!fs.existsSync(javaDir)) fs.mkdirSync(javaDir, { recursive: true });
      if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir, { recursive: true });
      if (!fs.existsSync(layoutDir)) fs.mkdirSync(layoutDir, { recursive: true });
      if (!fs.existsSync(drawableDir)) fs.mkdirSync(drawableDir, { recursive: true });
      
      // List of widget files and their copy destinations
      const copies = [
        { file: 'PrayerWidget.kt', dest: path.join(javaDir, 'PrayerWidget.kt') },
        { file: 'prayer_widget_info.xml', dest: path.join(xmlDir, 'prayer_widget_info.xml') },
        { file: 'prayer_widget_layout.xml', dest: path.join(layoutDir, 'prayer_widget_layout.xml') },
        { file: 'prayer_widget_layout_small.xml', dest: path.join(layoutDir, 'prayer_widget_layout_small.xml') },
        { file: 'prayer_widget_layout_large.xml', dest: path.join(layoutDir, 'prayer_widget_layout_large.xml') },
        { file: 'widget_background.xml', dest: path.join(drawableDir, 'widget_background.xml') },
        { file: 'widget_background_light.xml', dest: path.join(drawableDir, 'widget_background_light.xml') },
        { file: 'widget_button_bg_dark.xml', dest: path.join(drawableDir, 'widget_button_bg_dark.xml') },
        { file: 'widget_button_bg_light.xml', dest: path.join(drawableDir, 'widget_button_bg_light.xml') },
        { file: 'widget_button_bg_prayed_dark.xml', dest: path.join(drawableDir, 'widget_button_bg_prayed_dark.xml') },
        { file: 'widget_button_bg_prayed_light.xml', dest: path.join(drawableDir, 'widget_button_bg_prayed_light.xml') },
      ];
      
      copies.forEach((c) => {
        const srcPath = path.join(patchDir, c.file);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, c.dest);
          console.log(`[withWedeenPrayerWidgetAndroid] Copied ${c.file} to native android folder.`);
        } else {
          console.warn(`[withWedeenPrayerWidgetAndroid] Source file not found: ${srcPath}`);
        }
      });
      
      return config;
    },
  ]);

  return config;
}

module.exports = withWedeenPrayerWidgetAndroid;
