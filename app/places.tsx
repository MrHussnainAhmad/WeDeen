import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View, Pressable, LayoutAnimation } from 'react-native';
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
        <View style={[styles.filterList, responsive.isTablet && styles.filterListTablet]}>
          <FilterRow
            label="Halal certified"
            value={filters.halalCertified}
            onValueChange={(value) => setFilters((f) => ({ ...f, halalCertified: value }))}
            isTablet={responsive.isTablet}
          />
          <FilterRow
            label="Has prayer space"
            value={filters.hasPrayerSpace}
            onValueChange={(value) => setFilters((f) => ({ ...f, hasPrayerSpace: value }))}
            isTablet={responsive.isTablet}
          />
          <FilterRow
            label="Open now"
            value={filters.openNow}
            onValueChange={(value) => setFilters((f) => ({ ...f, openNow: value }))}
            isTablet={responsive.isTablet}
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

      {viewMode === 'map' ? (
        <MapPreview
          places={places.slice(0, 20)}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}

      <OrnateCard>
        <SectionHeader
          title="Nearby Results"
          subtitle={`${places.length} cached or live result${places.length === 1 ? '' : 's'}`}
          icon={<MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={colors.primary} />}
        />
        {places.length ? (
          <View style={[styles.placeList, responsive.isTablet && styles.placeListTablet]}>
            {places.map((place) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                favorite={favoriteIds.has(place.placeId)}
                onFavorite={() => toggleFavorite(place)}
                isTablet={responsive.isTablet}
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
          <View style={[styles.placeList, responsive.isTablet && styles.placeListTablet]}>
            {favorites.slice(0, 5).map((place) => (
              <PlaceCard
                key={place.placeId}
                place={place}
                favorite
                onFavorite={() => toggleFavorite(place)}
                isTablet={responsive.isTablet}
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

function FilterRow({ label, value, onValueChange, isTablet = false }: { label: string; value: boolean; onValueChange: (value: boolean) => void; isTablet?: boolean }) {
  return (
    <View style={[styles.filterRow, isTablet && { width: '31%', minWidth: 100 }]}>
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

function PlaceCard({ place, favorite, onFavorite, isTablet = false }: { place: WedeenPlace; favorite: boolean; onFavorite: () => void; isTablet?: boolean }) {
  const icon = place.type === 'mosque' ? 'mosque' : place.type === 'prayer_space' ? 'human-handsup' : 'silverware-fork-knife';
  
  const openMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps.');
    });
  };

  return (
    <PressableScale onPress={openMaps} style={[styles.placeCard, isTablet && { width: '48.5%' }]}>
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

function MapPreview({
  places,
  favoriteIds,
  onToggleFavorite,
}: {
  places: WedeenPlace[];
  favoriteIds: Set<string>;
  onToggleFavorite: (place: WedeenPlace) => void;
}) {
  const [selectedPlace, setSelectedPlace] = useState<WedeenPlace | null>(null);

  const handleSelectPlace = (place: WedeenPlace | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedPlace(place);
  };

  const parsedData = useMemo(() => {
    if (!places || places.length === 0) return null;

    const validPlaces = places.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (validPlaces.length === 0) return null;

    // Calculate center of returned coordinates
    const centerLat = validPlaces.reduce((sum, p) => sum + p.latitude, 0) / validPlaces.length;
    const centerLon = validPlaces.reduce((sum, p) => sum + p.longitude, 0) / validPlaces.length;

    // Projection
    const mapped = validPlaces.map((p) => {
      const dy = p.latitude - centerLat;
      const dx = (p.longitude - centerLon) * Math.cos((centerLat * Math.PI) / 180);
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { place: p, dx, dy, dist };
    });

    const maxDist = Math.max(...mapped.map((m) => m.dist), 0.0001);
    const maxRealDistKm = Math.max(...validPlaces.map((p) => p.distanceKm), 1);

    return { mapped, maxDist, maxRealDistKm };
  }, [places]);

  if (!parsedData) {
    return (
      <View style={[styles.mapBox, { justifyContent: 'center', alignItems: 'center' }]}>
        <MaterialCommunityIcons name="map-marker-off-outline" size={32} color={colors.gold} />
        <Text style={[styles.mapTitle, { marginTop: 8 }]}>No Map Data</Text>
        <Text style={styles.mapHint}>Search a location first to display map.</Text>
      </View>
    );
  }

  const { mapped, maxDist, maxRealDistKm } = parsedData;

  const containerHeight = 280;
  const radarRadius = 100;

  const openSelectedMaps = (place: WedeenPlace) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps.');
    });
  };

  return (
    <View style={[styles.mapBox, { height: containerHeight + (selectedPlace ? 155 : 0) }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => handleSelectPlace(null)}>
        {/* Radar concentric rings */}
        <View style={styles.radarCenterAnchor}>
          {/* Ring 1 (100%) */}
          <View style={[styles.radarRing, { width: radarRadius * 2, height: radarRadius * 2, borderRadius: radarRadius }]} />
          <Text style={[styles.radarRingLabel, { top: -radarRadius - 12 }]}>{maxRealDistKm.toFixed(1)} km</Text>
          
          {/* Ring 2 (66%) */}
          <View style={[styles.radarRing, { width: radarRadius * 2 * 0.66, height: radarRadius * 2 * 0.66, borderRadius: radarRadius * 0.66 }]} />
          <Text style={[styles.radarRingLabel, { top: -radarRadius * 0.66 - 12 }]}>{(maxRealDistKm * 0.66).toFixed(1)} km</Text>
          
          {/* Ring 3 (33%) */}
          <View style={[styles.radarRing, { width: radarRadius * 2 * 0.33, height: radarRadius * 2 * 0.33, borderRadius: radarRadius * 0.33 }]} />
          <Text style={[styles.radarRingLabel, { top: -radarRadius * 0.33 - 12 }]}>{(maxRealDistKm * 0.33).toFixed(1)} km</Text>

          {/* User Location Beacon */}
          <View style={styles.userBeaconOuter}>
            <View style={styles.userBeaconInner} />
          </View>

          {/* Plot pins */}
          {mapped.map(({ place, dx, dy }) => {
            const scale = radarRadius / maxDist;
            const px = dx * scale;
            const py = -dy * scale; // invert y for latitude direction
            
            const isSelected = selectedPlace?.placeId === place.placeId;
            const isFav = favoriteIds.has(place.placeId);
            
            const iconName = place.type === 'mosque' ? 'mosque' : place.type === 'prayer_space' ? 'human-handsup' : 'silverware-fork-knife';
            
            return (
              <PressableScale
                key={place.placeId}
                style={[
                  styles.radarPin,
                  {
                    transform: [{ translateX: px }, { translateY: py }],
                  },
                  isSelected && styles.radarPinSelected,
                ]}
                onPress={() => handleSelectPlace(place)}
              >
                <MaterialCommunityIcons
                  name={iconName as any}
                  size={13}
                  color={isSelected ? colors.primaryDeep : isFav ? colors.gold : '#FFFFFF'}
                />
              </PressableScale>
            );
          })}
        </View>

        {/* Header Overlay */}
        <View style={styles.radarHeader}>
          <Text style={styles.radarTitle}>Interactive Radar Map</Text>
          <Text style={styles.radarSubtitle}>Tap pins relative to center to view details</Text>
        </View>

        {/* selectedPlace bottom card */}
        {selectedPlace ? (
          <View style={styles.selectedPlaceCard}>
            <View style={styles.selectedPlaceTop}>
              <View style={styles.selectedIconWrap}>
                <MaterialCommunityIcons
                  name={selectedPlace.type === 'mosque' ? 'mosque' : selectedPlace.type === 'prayer_space' ? 'human-handsup' : 'silverware-fork-knife' as any}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.selectedPlaceName} numberOfLines={1}>
                  {selectedPlace.name}
                </Text>
                <Text style={styles.selectedPlaceMeta}>
                  {selectedPlace.distanceKm.toFixed(1)} km · {selectedPlace.type.replace('_', ' ')}
                </Text>
              </View>
              <PressableScale
                style={[styles.selectedActionBtn, { borderColor: 'transparent', backgroundColor: colors.primarySoft }]}
                onPress={() => handleSelectPlace(null)}
              >
                <Ionicons name="close" size={16} color={colors.primary} />
              </PressableScale>
            </View>
            
            {selectedPlace.address ? (
              <Text style={styles.selectedPlaceAddress} numberOfLines={1}>
                {selectedPlace.address}
              </Text>
            ) : null}

            <View style={styles.badges}>
              {selectedPlace.halalCertified ? <Badge text="Halal certified" /> : null}
              {selectedPlace.hasPrayerSpace ? <Badge text="Prayer space" /> : null}
              {selectedPlace.openNow ? <Badge text="Open now" /> : null}
            </View>

            <View style={styles.selectedPlaceActionsRow}>
              <PressableScale 
                style={[styles.selectedTextActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => openSelectedMaps(selectedPlace)}
              >
                <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
                <Text style={styles.selectedTextActionBtnText}>Get Directions</Text>
              </PressableScale>
              
              <PressableScale 
                style={[
                  styles.selectedTextActionBtn, 
                  { 
                    backgroundColor: favoriteIds.has(selectedPlace.placeId) ? 'rgba(168, 50, 31, 0.1)' : colors.goldSoft,
                    borderColor: favoriteIds.has(selectedPlace.placeId) ? 'rgba(168, 50, 31, 0.2)' : colors.goldBorder,
                  }
                ]}
                onPress={() => onToggleFavorite(selectedPlace)}
              >
                <Ionicons 
                  name={favoriteIds.has(selectedPlace.placeId) ? 'trash-outline' : 'star'} 
                  size={14} 
                  color={favoriteIds.has(selectedPlace.placeId) ? '#A8321F' : colors.goldDeep} 
                />
                <Text style={[
                  styles.selectedTextActionBtnText, 
                  { color: favoriteIds.has(selectedPlace.placeId) ? '#A8321F' : colors.goldDeep }
                ]}>
                  {favoriteIds.has(selectedPlace.placeId) ? 'Remove Favorite' : 'Add Favorite'}
                </Text>
              </PressableScale>
            </View>
          </View>
        ) : null}
      </Pressable>
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
  filterListTablet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
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
  placeListTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
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
  radarCenterAnchor: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
  },
  radarRingLabel: {
    position: 'absolute',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontWeight: 'bold',
    width: 60,
    textAlign: 'center',
  },
  userBeaconOuter: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(212, 173, 58, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBeaconInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  radarPin: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  radarPinSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.primaryDeep,
    transform: [{ scale: 1.25 }],
  },
  radarHeader: {
    position: 'absolute',
    top: 14,
    left: 14,
  },
  radarTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: fonts.serif,
  },
  radarSubtitle: {
    color: colors.onDarkMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  selectedPlaceCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedPlaceTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  selectedPlaceName: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: colors.text,
  },
  selectedPlaceMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1.5,
    textTransform: 'capitalize',
  },
  selectedActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectedPlaceAddress: {
    fontSize: 11.5,
    color: colors.muted,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: 6,
  },
  selectedPlaceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: 8,
  },
  selectedTextActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedTextActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11.5,
  },
});

