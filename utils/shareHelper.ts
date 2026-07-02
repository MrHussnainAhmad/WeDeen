import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export async function shareAsText(content: string, title?: string) {
  try {
    await Share.share({
      message: content,
      title: title || 'Muslim Deen: Quran & Prayer Share',
    });
  } catch (error) {
    console.warn('[Share] Text share failed:', error);
  }
}

export async function shareAsImage(viewRef: React.RefObject<any>) {
  try {
    if (!viewRef || !viewRef.current) {
      console.warn('[Share] Reference is empty or invalid.');
      return;
    }
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 0.9,
      result: 'tmpfile',
    });
    
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri);
    } else {
      console.warn('[Share] sharing not available');
    }
  } catch (error) {
    console.warn('[Share] Image capture/share failed:', error);
  }
}
