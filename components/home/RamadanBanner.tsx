import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, radius, shadow } from '@/theme/colors';
import { getSuhoorIftarTimes } from '@/services/ramadanService';
import { PressableScale } from '@/components/Anim';

export function RamadanBanner({ location, nowTick }: { location: any; nowTick: number }) {
  const [now, setNow] = useState(new Date(nowTick));

  useEffect(() => {
    setNow(new Date(nowTick));
  }, [nowTick]);

  const timesQuery = useQuery({
    queryKey: ['suhoor-iftar-times', location],
    enabled: !!location,
    queryFn: () => getSuhoorIftarTimes(location, new Date(nowTick)),
  });

  const { isRamadan, target, mode } = useMemo(() => {
    if (!timesQuery.data) return { isRamadan: false, target: null, mode: null };
    
    // Check if it is Ramadan (Hijri month 9)
    // The API response from getSuhoorIftarTimes should include the hijri month, but since we just have the times:
    // Let's assume we show this if they have fasting times today
    if (!timesQuery.data.suhoorEndsAt || !timesQuery.data.iftarAt) {
        return { isRamadan: false, target: null, mode: null };
    }

    const suhoorTime = timesQuery.data.suhoorEndsAt.getTime();
    const iftarTime = timesQuery.data.iftarAt.getTime();
    const currentTime = now.getTime();

    // If before Suhoor, target is Suhoor
    if (currentTime < suhoorTime) {
      return { isRamadan: true, target: timesQuery.data.suhoorEndsAt, mode: 'Suhoor' };
    }
    // If between Suhoor and Iftar, target is Iftar
    if (currentTime < iftarTime) {
      return { isRamadan: true, target: timesQuery.data.iftarAt, mode: 'Iftar' };
    }
    // If after Iftar, target is Suhoor of NEXT day.
    // For simplicity, we just say "Fasting Completed for Today" until tomorrow's data loads.
    return { isRamadan: true, target: null, mode: 'Completed' };
  }, [timesQuery.data, nowTick]);

  let content = null;

  if (timesQuery.isLoading) {
    content = (
      <View style={styles.content}>
        <MaterialCommunityIcons name="moon-waning-crescent" size={24} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ramadan Fasting</Text>
          <Text style={styles.subtitle}>Loading today's fasting times...</Text>
        </View>
      </View>
    );
  } else if (!timesQuery.data) {
    content = (
      <View style={styles.content}>
        <MaterialCommunityIcons name="moon-waning-crescent" size={24} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ramadan Tracker</Text>
          <Text style={styles.subtitle}>Open tracker to view times & log fasts</Text>
        </View>
        <Link href="/ramadan" asChild>
          <PressableScale style={styles.button}>
            <Text style={styles.buttonText}>Open</Text>
          </PressableScale>
        </Link>
      </View>
    );
  } else if (mode === 'Completed') {
    content = (
      <View style={styles.content}>
        <MaterialCommunityIcons name="star-crescent" size={20} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Fast Completed</Text>
          <Text style={styles.subtitle}>May Allah accept your fast today.</Text>
        </View>
        <Link href="/ramadan" asChild>
          <PressableScale style={styles.button}>
            <Text style={styles.buttonText}>Log Fast</Text>
          </PressableScale>
        </Link>
      </View>
    );
  } else if (!target) {
    content = (
      <View style={styles.content}>
        <MaterialCommunityIcons name="moon-waning-crescent" size={24} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ramadan Tracker</Text>
          <Text style={styles.subtitle}>Log and monitor your Ramadan fasts.</Text>
        </View>
        <Link href="/ramadan" asChild>
          <PressableScale style={styles.button}>
            <Text style={styles.buttonText}>Open</Text>
          </PressableScale>
        </Link>
      </View>
    );
  } else {
    const diffMs = target.getTime() - now.getTime();
    const diffTotalMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffTotalMins / 60);
    const mins = diffTotalMins % 60;
    
    let countdownText = 'Now';
    if (diffMs > 0) {
      if (hours > 0) countdownText = `${hours}h ${mins}m left`;
      else countdownText = `${mins}m left`;
    }

    content = (
      <View style={styles.content}>
        <Ionicons name="time" size={24} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{mode} in {countdownText}</Text>
          <Text style={styles.subtitle}>Target: {target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <Link href="/ramadan" asChild>
          <PressableScale style={styles.button}>
            <Text style={styles.buttonText}>Tracker</Text>
          </PressableScale>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <View style={styles.connectingLineLeft} />
      <View style={styles.connectingLineRight} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    ...shadow.raised,
    overflow: 'visible',
  },
  connectingLineLeft: {
    position: 'absolute',
    bottom: -22,
    left: 40,
    width: 3,
    height: 24,
    backgroundColor: colors.primary,
    zIndex: -2,
  },
  connectingLineRight: {
    position: 'absolute',
    bottom: -22,
    right: 40,
    width: 3,
    height: 24,
    backgroundColor: colors.primary,
    zIndex: -2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.onDarkMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
