import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  Polyline,
} from "react-native-maps";
import { useDriverStore, useLocationStore, useRouteStore } from "../store";
import {
  calculateRegion,
  generateMarkersFromData,
} from "../lib/Map";
import { icons } from "../constants";
import { ref, onValue } from "firebase/database";
import { rtdb } from "../firebase-config";
import { ActivityIndicator } from "react-native-paper";
import MapViewDirections from "react-native-maps-directions";
import { Driver, MarkerData } from "../types";

interface MemoizedMapViewProps {
  region: any;
  markers: MarkerData[];
  selectedDriver: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  driverOrigin: { latitude: number | null; longitude: number | null };
  origin: { latitude: number | null; longitude: number | null };
  destination: { latitude: number | null; longitude: number | null };
  isRiding: boolean;
  singleDriver: Driver | null;
  userLatitude: number;
  handleMarkerPress: (markerId: string) => void;
  routeInfo: any;
  setRouteInfo: (info: any) => void;
}

const MemoizedMapView = React.memo<MemoizedMapViewProps>(({
  region,
  markers,
  selectedDriver,
  destinationLatitude,
  destinationLongitude,
  driverOrigin,
  origin,
  destination,
  isRiding,
  singleDriver,
  userLatitude,
  handleMarkerPress,
  routeInfo,
  setRouteInfo,
}) => {
  const handleRouteReady = useCallback((result: any) => {
    setRouteInfo(result);
  }, [setRouteInfo]);
  
  // Freeze the driver's initial origin so the route API isn't called on every GPS update
  const [initialDriverOrigin, setInitialDriverOrigin] = useState<any>(null);
  const [initialUserOrigin, setInitialUserOrigin] = useState<any>(null);

  useEffect(() => {
    if (singleDriver && driverOrigin?.latitude && driverOrigin?.longitude && !initialDriverOrigin) {
      setInitialDriverOrigin(driverOrigin);
    }
  }, [singleDriver, driverOrigin]);

  useEffect(() => {
    if (origin?.latitude && origin?.longitude && !initialUserOrigin) {
      setInitialUserOrigin(origin);
    }
  }, [origin]);

  const routeOrigin = isRiding ? initialUserOrigin : (singleDriver ? initialDriverOrigin : initialUserOrigin);
  const routeDestination = isRiding ? destination : (singleDriver ? initialUserOrigin : destination);

  return (
    <MapView
      key="map-view"
      provider={PROVIDER_DEFAULT}
      style={{ width: "100%", height: "100%", borderRadius: 16 }}
      tintColor="black"
      showsPointsOfInterest={false}
      region={region}
      showsUserLocation={true}
      userInterfaceStyle="light"
    >
      {markers?.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{
            latitude: marker.latitude,
            longitude: marker.longitude,
          }}
          title={selectedDriver === marker.id ? marker.driverName : undefined}
          image={selectedDriver === marker.id ? icons.selectedMarker : icons.marker}
          onPress={() => handleMarkerPress(marker.id)}
        />
      ))}
      {destinationLatitude && destinationLongitude && (
        <Marker
          key="destination"
          coordinate={{
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          }}
          title="Destination"
          image={icons.pin}
        />
      )}

      {/* Real-time driver marker — reads live lat/lng directly from singleDriver
          so it moves as the driver moves, without triggering extra API calls */}
      {singleDriver?.lat && singleDriver?.lng && (
        <Marker
          key="active-driver"
          coordinate={{
            latitude: singleDriver.lat,
            longitude: singleDriver.lng,
          }}
          title={singleDriver.driverName || 'Your driver'}
          image={icons.selectedMarker}
        />
      )}

      {routeOrigin?.latitude && routeOrigin?.longitude && routeDestination?.latitude && routeDestination?.longitude && (
        <MapViewDirections
          origin={routeOrigin}
          destination={routeDestination}
          apikey={process.env.EXPO_PUBLIC_LILO_GOOGLE_PLACES_API_KEY!}
          strokeColor="#0286ff"
          strokeWidth={3}
          onReady={handleRouteReady}
        />
      )}
    </MapView>
  );
});

interface MapProps {
  driver: Driver | null;
  isRiding: boolean;
}

// Componente principal del mapa
export default function Map({ driver: singleDriver, isRiding }: MapProps) {
  const {
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const { selectedDriver, setSelectedDriver } = useDriverStore();
  const { routeInfo, setRouteInfo } = useRouteStore(); // Hook para la caché de la ruta

  const [driversArray, setDriversArray] = useState<Driver[]>([]);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const origin = useMemo(() => ({ latitude: userLatitude, longitude: userLongitude }), [userLatitude, userLongitude]);
  const destination = useMemo(() => ({ latitude: destinationLatitude, longitude: destinationLongitude }), [destinationLatitude, destinationLongitude]);
  const driverOrigin = useMemo(() => ({ latitude: singleDriver?.lat ?? null, longitude: singleDriver?.lng ?? null }), [singleDriver]);

  const region = useMemo(() => calculateRegion({
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationLongitude,
  }), [userLongitude, userLatitude, destinationLatitude, destinationLongitude]);

  const getDistanceInMiles = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance * 0.621371; // Convert to miles
  };

  useEffect(() => {
    if (singleDriver) return;

    const driversRef = ref(rtdb, "conductores_activos");
    const unsubscribe = onValue(
      driversRef,
      (snapshot) => {
        // If no drivers exist in RTDB at all, clear both local markers and global store
        if (!snapshot.exists()) {
          setDriversArray([]);
          useDriverStore.getState().setDrivers([]);
          return;
        }

        // If we don't have user location yet, skip
        if (!userLatitude || !userLongitude) {
          return;
        }

        const driversData = snapshot.val();

        // --- Update local map markers (raw RTDB data, used only for map pins) ---
        const driversList = Object.keys(driversData)
          .map((key) => ({
            id: key,
            ...driversData[key],
          } as Driver))
          .filter((driver) => {
            const distance = getDistanceInMiles(
              userLatitude,
              userLongitude,
              driver.lat,
              driver.lng
            );
            return distance <= 10; // Filter drivers within a 10-mile radius
          });
        setDriversArray(driversList);

        // Build the set of driver IDs currently active in RTDB and within 10 miles
        const activeDriverIds = new Set(driversList.map((d) => d.id));

        // --- Sync driver PRESENCE in the global store ---
        // Strategy: REMOVE drivers that went offline or moved outside the 10-mile radius, SIGNAL when new drivers appear.
        // Never overwrite price/ETA/pickupTime data for drivers already in the store.
        // ConfirmRideComponent owns the write of calculated data.
        const currentDrivers = useDriverStore.getState().drivers || [];
        const currentDriverIds = new Set(currentDrivers.map((d) => d.id));

        // Check if any new driver appeared in RTDB that isn't in the store yet
        const hasNewDriver = driversList.some((d) => !currentDriverIds.has(d.id));

        if (currentDrivers.length > 0) {
          const stillActiveDrivers = currentDrivers.filter((d) =>
            activeDriverIds.has(d.id)
          );
          // Only update if a driver actually went offline or moved outside 5 miles (avoid unnecessary re-renders)
          if (stillActiveDrivers.length !== currentDrivers.length) {
            useDriverStore.getState().setDrivers(stillActiveDrivers);
          }
        }

        // If a new driver came online, signal ConfirmRideComponent to re-fetch
        if (hasNewDriver) {
          useDriverStore.getState().triggerDriversFetch();
        }
      },
      (error) => {
        setError(error.message || "Error fetching drivers");
        console.error("Error fetching drivers:", error);
      }
    );

    return () => unsubscribe();
  }, [userLatitude, userLongitude, singleDriver]);

  useEffect(() => {
    if (singleDriver && singleDriver.lat && singleDriver.lng) {
      // When a single driver is provided, create a marker with their actual coordinates.
      const newMarker: MarkerData = {
        ...singleDriver,
        latitude: singleDriver.lat,
        longitude: singleDriver.lng,
        title: singleDriver.driverName || "",
      };
      setMarkers([newMarker]);
      setDriversArray([singleDriver]);
    }
  }, [singleDriver]);

  useEffect(() => {
    if (singleDriver) return; // Do not run this effect if we are in single driver mode

    // Si no hay drivers, limpiamos markers
    if (!Array.isArray(driversArray) || driversArray.length === 0) {
      setMarkers([]);
      return;
    }

    // Esperamos a tener la ubicación del usuario antes de generar markers
    if (typeof userLatitude !== "number" || typeof userLongitude !== "number") {
      return;
    }

    // Intentamos usar la función utilitaria; pasamos las coordenadas del usuario
    let newMarkers = generateMarkersFromData({
      data: driversArray,
    });

    // Normalizar la forma del marker por si la función devuelve lat/lng en vez de latitude/longitude
    const normalizedMarkers: MarkerData[] = newMarkers.map((m) => ({
      ...m,
      id: m.id ?? `${m.latitude}-${m.longitude}`,
      latitude: m.latitude ?? m.lat,
      longitude: m.longitude ?? m.lng,
      title: m.driverName ?? (m as any).name ?? "",
    }));

    setMarkers(normalizedMarkers);
  }, [driversArray, userLatitude, userLongitude, singleDriver]);

  const handleMarkerPress = useCallback((markerId: string) => {
    const driver = driversArray.find((d) => d.id === markerId);
    if (driver) setSelectedDriver(driver);
  }, [driversArray, setSelectedDriver]);

  if (!userLatitude || !userLongitude) {
    return (
      <View className="flex justify-between items-center w-full">
        <ActivityIndicator animating={true} color="#2B9DD9" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex justify-between items-center w-full">
        <Text>Error: {error}</Text>
      </View>
    );
  }

  return (
    <MemoizedMapView
      region={region}
      markers={markers}
      selectedDriver={selectedDriver?.id ?? null}
      destinationLatitude={destinationLatitude}
      destinationLongitude={destinationLongitude}
      driverOrigin={driverOrigin}
      origin={origin}
      destination={destination}
      isRiding={isRiding}
      singleDriver={singleDriver}
      userLatitude={userLatitude}
      handleMarkerPress={handleMarkerPress}
      routeInfo={routeInfo}
      setRouteInfo={setRouteInfo}
    />
  );
}
