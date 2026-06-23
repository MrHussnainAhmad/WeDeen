import { router } from 'expo-router';

/** Pop the stack when possible so the native slide-back animation plays. */
export function goBackOrReplace(fallback: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as any);
}
