import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useThemeColors } from '@/theme/useThemeColors';
import { useAuthStore } from '@/store/authStore';
import { getSalahLogs, getWorshipInsights } from '@/services/prayerTrackerService';
import { GeometricDivider, OrnateCard, SectionHeader } from '@/components/ui';

type InsightsData = {
  consistencyScore: number;
  mostMissedPrayer: string;
  bestDayOfWeek: string;
  totalPrayedMonth: number;
  totalPrayedWeek: number;
};

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const themeColors = useThemeColors();
  const { user } = useAuthStore();
  
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    getSalahLogs().then(logs => {
      const data = getWorshipInsights(logs);
      setInsights(data);
    }).finally(() => {
      setLoading(false);
    });
  }, [user]);

  return (
    <View style={[styles.screen, { backgroundColor: themeColors.bg }]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.primaryDeep }]}>
          <PressableScale onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Worship Insights</Text>
            <Text style={styles.headerSubtitle}>Weekly & Monthly Reports</Text>
          </View>
        </View>

        {!user ? (
          <View style={[styles.guestCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Ionicons name="pie-chart-outline" size={48} color={themeColors.muted} style={{ marginBottom: 16 }} />
            <Text style={[styles.guestTitle, { color: themeColors.text }]}>Sign In to View Insights</Text>
            <Text style={[styles.guestDesc, { color: themeColors.muted }]}>
              Your progress and habits are strictly confidential. Sign in to view your Worship Consistency Score, most missed prayers, and personal trends.
            </Text>
            <PressableScale style={[styles.loginBtn, { backgroundColor: themeColors.primary }]} onPress={() => router.push('/settings')}>
              <Text style={styles.loginBtnText}>Sign In / Create Account</Text>
            </PressableScale>
          </View>
        ) : loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : insights ? (
          <>
            {/* Consistency Score Card */}
            <OrnateCard>
              <View style={styles.scoreContainer}>
                <View style={styles.scoreCircleWrapper}>
                  <View style={[styles.scoreCircle, { borderColor: themeColors.goldDeep }]}>
                    <Text style={[styles.scoreValue, { color: themeColors.primary }]}>{insights.consistencyScore}</Text>
                    <Text style={[styles.scoreLabel, { color: themeColors.muted }]}>/ 100</Text>
                  </View>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={[styles.scoreTitle, { color: themeColors.text }]}>Worship Consistency</Text>
                  <Text style={[styles.scoreDesc, { color: themeColors.muted }]}>
                    Based on your prayer habits over the last 30 days.
                  </Text>
                </View>
              </View>
            </OrnateCard>

            <View style={styles.gridRow}>
              {/* Most Missed */}
              <View style={[styles.gridItem, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <Ionicons name="warning-outline" size={24} color={themeColors.danger} style={{ marginBottom: 8 }} />
                <Text style={[styles.gridLabel, { color: themeColors.muted }]}>Needs Focus</Text>
                <Text style={[styles.gridValue, { color: themeColors.text }]}>{insights.mostMissedPrayer}</Text>
              </View>

              {/* Best Day */}
              <View style={[styles.gridItem, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <Ionicons name="star-outline" size={24} color={themeColors.goldDeep} style={{ marginBottom: 8 }} />
                <Text style={[styles.gridLabel, { color: themeColors.muted }]}>Best Day</Text>
                <Text style={[styles.gridValue, { color: themeColors.text }]}>{insights.bestDayOfWeek}</Text>
              </View>
            </View>

            {/* Monthly & Weekly Reports */}
            <OrnateCard>
              <SectionHeader
                title="Prayer Report"
                subtitle="Your performance over time"
                icon={<Ionicons name="bar-chart-outline" size={18} color={themeColors.primary} />}
              />
              
              <View style={styles.reportRow}>
                <View style={styles.reportCol}>
                  <Text style={[styles.reportValue, { color: themeColors.primary }]}>{insights.totalPrayedWeek}</Text>
                  <Text style={[styles.reportLabel, { color: themeColors.muted }]}>Prayed this Week</Text>
                  <Text style={[styles.reportSub, { color: themeColors.faint }]}>out of 35</Text>
                </View>
                
                <View style={[styles.reportDivider, { backgroundColor: themeColors.borderSoft }]} />
                
                <View style={styles.reportCol}>
                  <Text style={[styles.reportValue, { color: themeColors.primary }]}>{insights.totalPrayedMonth}</Text>
                  <Text style={[styles.reportLabel, { color: themeColors.muted }]}>Prayed last 30 Days</Text>
                  <Text style={[styles.reportSub, { color: themeColors.faint }]}>out of 150</Text>
                </View>
              </View>
            </OrnateCard>

            {/* Streak Note */}
            <View style={[styles.noteCard, { backgroundColor: themeColors.primarySoft }]}>
              <Ionicons name="information-circle-outline" size={20} color={themeColors.primary} />
              <Text style={[styles.noteText, { color: themeColors.primaryDeep }]}>
                Consistency is key. Even if you miss a prayer, returning to the path is what makes a habit stick. Keep going!
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: { borderRadius: radius.xl, padding: 20, flexDirection: 'row', gap: 14, alignItems: 'center', ...shadow.raised },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900', fontFamily: fonts.serif },
  headerSubtitle: { color: colors.onDarkMuted, marginTop: 4, fontSize: 13 },
  
  guestCard: { padding: 32, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 1, ...shadow.card },
  guestTitle: { fontSize: 22, fontWeight: 'bold', fontFamily: fonts.serif, marginBottom: 12, textAlign: 'center' },
  guestDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  loginBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: radius.md },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  scoreContainer: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 8 },
  scoreCircleWrapper: { alignItems: 'center', justifyContent: 'center' },
  scoreCircle: { width: 90, height: 90, borderRadius: 45, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { fontSize: 28, fontWeight: '900' },
  scoreLabel: { fontSize: 12, fontWeight: '600', marginTop: -4 },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 18, fontWeight: '800', fontFamily: fonts.serif, marginBottom: 6 },
  scoreDesc: { fontSize: 13, lineHeight: 18 },

  gridRow: { flexDirection: 'row', gap: 16 },
  gridItem: { flex: 1, padding: 20, borderRadius: radius.xl, borderWidth: 1, alignItems: 'center', ...shadow.card },
  gridLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  gridValue: { fontSize: 16, fontWeight: '800', fontFamily: fonts.serif, textAlign: 'center' },

  reportRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  reportCol: { flex: 1, alignItems: 'center' },
  reportDivider: { width: 1, height: '80%' },
  reportValue: { fontSize: 32, fontWeight: '900', fontFamily: fonts.serif },
  reportLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  reportSub: { fontSize: 11, marginTop: 2 },

  noteCard: { flexDirection: 'row', padding: 16, borderRadius: radius.lg, gap: 12, alignItems: 'center', ...shadow.card },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
