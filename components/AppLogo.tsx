import { Image, StyleProp, View, ViewStyle } from 'react-native';

const LOGO = require('@/assets/images/logo-mark.png');

// Resolve the asset's real pixel size once so the logo always renders at its
// true aspect ratio — never stretched — and stays identical on every screen.
const source = Image.resolveAssetSource(LOGO);
const ASPECT = source && source.height ? source.width / source.height : 0.516;

type Props = {
  /** Visual height of the logo; width follows the artwork's true aspect ratio. */
  height?: number;
  /** Optional cap so the logo never overflows on small/large screens. */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function AppLogo({ height = 140, maxWidth, style }: Props) {
  let h = height;
  let w = h * ASPECT;
  if (maxWidth && w > maxWidth) {
    w = maxWidth;
    h = w / ASPECT;
  }

  return (
    <View style={[{ width: w, height: h }, style]}>
      <Image source={LOGO} style={{ width: w, height: h }} resizeMode="contain" />
    </View>
  );
}
