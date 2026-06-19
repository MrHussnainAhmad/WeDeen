import { StyleSheet, View } from 'react-native';
import { Shimmer } from '@/components/home/Shimmer';
import { colors, radius } from '@/theme/colors';

type Props = {
  rows?: number;
  rowHeight?: number;
  paddingTop?: number;
};

/** Warm shimmer rows for list screens (Quran, Hadith, etc.). */
export function ListRowSkeleton({ rows = 5, rowHeight = 76, paddingTop = 14 }: Props) {
  return (
    <View style={[styles.wrap, { paddingTop }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} height={rowHeight} radius={radius.lg} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    gap: 12,
  },
});
