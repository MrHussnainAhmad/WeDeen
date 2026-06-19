import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';

type Props = {
  iconBase64?: string | null;
  size?: number;
};

export function AppListIcon({ iconBase64, size = 28 }: Props) {
  if (iconBase64) {
    return (
      <Image
        source={{ uri: `data:image/png;base64,${iconBase64}` }}
        style={{ width: size, height: size, borderRadius: Math.max(6, size * 0.22) }}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: Math.max(6, size * 0.22) }]}>
      <Ionicons name="apps-outline" size={Math.round(size * 0.52)} color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
});
