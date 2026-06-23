import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/Anim';
import { OrnateCard, SectionHeader } from '@/components/ui';
import { colors, fonts, radius, shadow } from '@/theme/colors';
import { useResponsive } from '@/theme/responsive';
import { useAuthStore } from '@/store/authStore';
import {
  getCachedPlaces,
  getFavoritePlaces,
  restoreFavoritePlaces,
  searchNearbyPlaces,
  syncFavoritePlaces,
  toggleFavoritePlace,
  type PlaceSearchFilters,
  type WedeenPlace,
} from '@/services/placesService';

const DEFAULT_FILTERS: PlaceSearchFilters = {
  halalCertified: false,
  hasPrayerSpace: false,
  openNow: false,
};

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const token = useAuthStore((s) => s.token);
  const [city, setCity] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [places, setPlaces] = useState<WedeenPlace[]>([]);
  const [favorites, setFavorites] = useState<WedeenPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    getCachedPlaces(filters).then(setPlaces).catch(() => undefined);
    getFavoritePlaces().then(setFavorites).catch(() => undefined);
    if (token) {
      restoreFavoritePlaces(token).then(setFavorites).catch(() => undefined);
    }
  }, [token]);

  const favoriteIds = useMemo(() => new Set(favorites.map((p) => p.placeId)), [favorites]);

  const runSearch = async () => {
    setLoading(true);
    try {
      const results = await searchNearbyPlaces({ city, filters });
      setPlaces(results);
      if (!results.length) {
        Alert.alert('No places found', 'Try a wider city search or remove filters.');
      }
    } catch (error: any) {
      Alert.alert(
        'Search unavailable',
        error?.message === 'LOCATION_DENIED'
          ? 'Allow location or enter a city manually.'
          : 'Could not search right now. Showing cached results if available.'
      );
      const cached = await getCachedPlaces(filters);
      setPlaces(cached);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (place: WedeenPlace) => {
    const result = await toggleFavoritePlace(place, token);
    setFavorites(result.favorites);
    if (token) syncFavoritePlaces(token).catch(() => undefined);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 24) }, responsive.centerContent]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Halal & Mosque Finder</Text>
          <Text style={styles.headerText}>Find nearby halal restaurants, mosques, and prayer spaces.</Text>
        </View>
      </View>

      <OrnateCard>
        <SectionHeader
          title="Search"
          subtitle="Use current location or enter a city"
          icon={<Ionicons name="location-outline" size={18} color={colors.primary} />}
        />
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="Manual city search, e.g. Lahore"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
        <View style={styles.filterList}>
          <FilterRow
            label="Halal certified"
            value={filters.halalCertified}
            onValueChange={(value) => setFilters((f) => ({ ...f, halalCertified: value }))}
          />
          <FilterRow
            label="Has prayer space"
            value={filters.hasPrayerSpace}
            onValueChange={(value) => setFilters((f) => ({ ...f, hasPrayerSpace: value }))}
          />
          <FilterRow
            label="Open now"
            value={filters.openNow}
            onValueChange={(value) => setFilters((f) => ({ ...f, openNow: value }))}
          />
        </View>
        <View style={styles.searchActions}>
          <PressableScale onPress={runSearch} disabled={loading} style={styles.primaryButton}>
            {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={16} color="#fff" />}
            <Text style={styles.primaryButtonText}>{city.trim() ? 'Search City' : 'Search Near Me'}</Text>
          </PressableScale>
          <PressableScale
            onPress={() => setViewMode((mode) => (mode === 'list' ? 'map' : 'list'))}
            style={styles.viewButton}
          >
            <MaterialCommunityIcons
              name={viewMode === 'list' ? 'map-outline' : 'format-list-bulleted'}
              size={16}
              color={colors.primary}
            />
            <Text style={styles.viewButtonText}>{viewMode === 'list' ? 'Map' : 'List'}</Text>
          </PressableScale>
        </View>
      </OrnateCard>

      {viewMode === 'map' ? <MapPreview places={places.slice(0, 10)} /> : null}

      <OrnateCard>
        <SectionHeader
          title="Nearby Results"
          subtitle={`${places.length} cached or live result${places.length === 1 ? '' : 's'}`}
          icon={<MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={colors.primary} />}
        />
        {places.length ? (
          <View style={styles.placeList}>
            {places.map((place) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                favorite={favoriteIds.has(place.placeId)}
                onFavorite={() => toggleFavorite(place)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Search to find places. Last results are cached for offline use.</Text>
        )}
      </OrnateCard>

      <OrnateCard>
        <SectionHeader
          title="Favorites"
          subtitle="Saved locally and synced when logged in"
          icon={<Ionicons name="star-outline" size={18} color={colors.primary} />}
        />
        {favorites.length ? (
          <View style={styles.placeList}>
            {favorites.slice(0, 5).map((place) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                favorite
                onFavorite={() => toggleFavorite(place)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No favorite places yet.</Text>
        )}
      </OrnateCard>
    </ScrollView>
  );
}

function FilterRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#C9D7D1', true: colors.primary }}
        thumbColor={value ? colors.gold : '#fff'}
      />
    </View>
  );
}

function PlaceCard({ place, favorite, onFavorite }: { place: WedeenPlace; favorite: boolean; onFavorite: () => void }) {
  const icon = place.type === 'mosque' ? 'mosque' : place.type === 'prayer_space' ? 'human-handsup' : 'silverware-fork-knife';
  
  const openMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps.');
    });
  };

  return (
    <PressableScale onPress={openMaps} style={styles.placeCard}>
      <View style={styles.placeTop}>
        <View style={styles.placeIcon}>
          <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.placeName}>{place.name}</Text>
          <Text style={styles.placeMeta}>
            {place.distanceKm.toFixed(1)} km · {place.type.replace('_', ' ')}
          </Text>
        </View>
        <PressableScale onPress={onFavorite} style={styles.favoriteButton}>
          <Ionicons name={favorite ? 'star' : 'star-outline'} size={20} color={favorite ? colors.gold : colors.muted} />
        </PressableScale>
      </View>
      {place.address ? <Text style={styles.address}>{place.address}</Text> : null}
      <View style={styles.badges}>
        {place.halalCertified ? <Badge text="Halal certified" /> : null}
        {place.hasPrayerSpace ? <Badge text="Prayer space" /> : null}
        {place.openNow ? <Badge text="Open now" /> : null}
      </View>
    </PressableScale>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function MapPreview({ places }: { places: WedeenPlace[] }) {
  return (
    <View style={styles.mapBox}>
      <Text style={styles.mapTitle}>Map View</Text>
      <Text style={styles.mapHint}>Lightweight relative map preview. Use the list for exact details.</Text>
      {places.map((place, index) => (
        <View
          key={place.placeId}
          style={[
            styles.mapPin,
            {
              left: `${16 + ((index * 23) % 68)}%`,
              top: `${24 + ((index * 17) % 54)}%`,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={place.type === 'mosque' ? 'mosque' : 'map-marker'}
            size={15}
            color="#fff"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: {
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    ...shadow.raised,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: { color: '#fff', fontSize: 21, fontWeight: '900', fontFamily: fonts.serif },
  headerText: { color: colors.onDarkMuted, marginTop: 4, fontSize: 12.5, lineHeight: 18 },
  input: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  filterList: { marginTop: 12, gap: 6 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
  searchActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '900' },
  viewButton: {
    width: 86,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  viewButtonText: { color: colors.primary, fontWeight: '900' },
  placeList: { gap: 10 },
  placeCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
  },
  placeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeName: { color: colors.text, fontWeight: '900', fontSize: 14.5 },
  placeMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  favoriteButton: { padding: 8 },
  address: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  badgeText: { color: colors.goldDeep, fontSize: 11, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  mapBox: {
    height: 230,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryDeep,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    overflow: 'hidden',
    padding: 16,
    ...shadow.raised,
  },
  mapTitle: { color: '#fff', fontSize: 18, fontFamily: fonts.serif, fontWeight: '900' },
  mapHint: { color: colors.onDarkMuted, fontSize: 12, marginTop: 4 },
  mapPin: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
