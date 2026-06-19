import { Image, StyleProp, View, ViewStyle } from 'react-native';

/** Logo artwork is tall/narrow; widen slightly so it reads balanced on splash screens. */
const WIDTH_SCALE = 1.48;

type Props = {
  /** Visual height of the logo (width follows aspect + scale). */
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function AppLogo({ height = 140, style }: Props) {
  const baseWidth = height * 0.92;
  const layoutWidth = baseWidth * WIDTH_SCALE;

  return (
    <View
      style={[
        {
          width: layoutWidth,
          height,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Image
        source={require('@/assets/images/logo.png')}
        style={{
          width: baseWidth,
          height,
          transform: [{ scaleX: WIDTH_SCALE }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}
