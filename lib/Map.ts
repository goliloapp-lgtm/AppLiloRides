import { Driver, MarkerData } from "../types";

/**
 * Clave de API de Google Directions utilizada para calcular rutas y tiempos de viaje.
 * Se obtiene de las variables de entorno del proyecto Expo.
 *
 * @internal
 */
const directionsAPI = process.env.EXPO_PUBLIC_LILO_GOOGLE_PLACES_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// generateMarkersFromData
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerateMarkersParams {
  /** Array de conductores activos obtenidos desde Firestore o RTDB. */
  data: Driver[];
}

/**
 * Convierte un array de objetos `Driver` en marcadores compatibles con `react-native-maps`.
 *
 * @remarks
 * La distinción entre `lat`/`lng` (formato Firestore) y `latitude`/`longitude`
 * (formato requerido por react-native-maps) es intencional. Esta función
 * normaliza el formato para el componente `Map.tsx`.
 *
 * @param params - Objeto con el array de conductores a convertir.
 * @returns Array de {@link MarkerData} listos para renderizar en el mapa.
 *
 * @example
 * ```ts
 * const markers = generateMarkersFromData({ data: drivers });
 * ```
 *
 * @category Map Utilities
 */
export const generateMarkersFromData = ({ data }: GenerateMarkersParams): MarkerData[] => {
  return data.map((driver) => {
    return {
      ...driver,
      latitude: driver.lat,
      longitude: driver.lng,
      title: driver.driverName || "",
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateRegion
// ─────────────────────────────────────────────────────────────────────────────

export interface CalculateRegionParams {
  /** Latitud actual del usuario. */
  userLatitude: number | null;
  /** Longitud actual del usuario. */
  userLongitude: number | null;
  /** Latitud del destino seleccionado. */
  destinationLatitude: number | null;
  /** Longitud del destino seleccionado. */
  destinationLongitude: number | null;
}

/**
 * Calcula la región del mapa que enmarca al usuario y al destino.
 *
 * @remarks
 * La región se calcula para que ambos puntos (usuario y destino) queden
 * visibles en el mapa con un margen de padding del 30% (`× 1.3`).
 *
 * Comportamiento por casos:
 * - Sin ubicación de usuario → región por defecto centrada en San Francisco.
 * - Solo usuario (sin destino) → región centrada en el usuario con zoom cercano.
 * - Usuario + destino → región que enmarca ambos puntos.
 *
 * @param params - Coordenadas del usuario y del destino.
 * @returns Objeto de región compatible con el prop `region` de `MapView`.
 *
 * @category Map Utilities
 */
export const calculateRegion = ({
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
}: CalculateRegionParams) => {
  if (!userLatitude || !userLongitude) {
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  if (!destinationLatitude || !destinationLongitude) {
    return {
      latitude: userLatitude,
      longitude: userLongitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  }

  const minLat = Math.min(userLatitude, destinationLatitude);
  const maxLat = Math.max(userLatitude, destinationLatitude);
  const minLng = Math.min(userLongitude, destinationLongitude);
  const maxLng = Math.max(userLongitude, destinationLongitude);

  const latitudeDelta = (maxLat - minLat) * 1.3;
  const longitudeDelta = (maxLng - minLng) * 1.3;

  const latitude = (userLatitude + destinationLatitude) / 2;
  const longitude = (userLongitude + destinationLongitude) / 2;

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateDriverTimes
// ─────────────────────────────────────────────────────────────────────────────

export interface CalculateDriverTimesParams {
  /** Lista de conductores disponibles como marcadores del mapa. */
  markers: MarkerData[];
  /** Latitud actual del usuario (punto de recogida). */
  userLatitude: number | null;
  /** Longitud actual del usuario (punto de recogida). */
  userLongitude: number | null;
  /** Latitud del destino del viaje. */
  destinationLatitude: number | null;
  /** Longitud del destino del viaje. */
  destinationLongitude: number | null;
}

/**
 * Calcula el ETA de recogida y la tarifa estimada para cada conductor disponible.
 *
 * @remarks
 * Realiza las siguientes llamadas a la Google Directions API:
 * 1. **Una sola vez**: Ruta del usuario al destino (para calcular la tarifa base).
 * 2. **Por cada conductor**: Ruta del conductor al usuario (para calcular el ETA de recogida).
 *
 * ### Fórmula de tarifa:
 * ```
 * baseFare     = $2.50
 * perMileRate  = $1.05 / milla
 * perMinRate   = $0.23 / minuto
 * adminFee     = $0.88
 * insurance    = $0.53 × (rideMiles + min(deadheadMiles, 5))
 * cardCommission = fareBase × 0.03
 *
 * price         = baseFare + (rideMiles × perMileRate) + (minutes × perMinRate) + adminFee + insurance
 * priceWithCard = price + cardCommission
 * ```
 *
 * ### Tarifas mínimas:
 * - Efectivo (cash): **$8.99**
 * - Tarjeta (card): **$9.27**
 *
 * @param params - Marcadores de conductores y coordenadas de origen/destino.
 * @returns Array de {@link MarkerData} enriquecido con `price`, `priceWithCard`,
 *          `time` y `pickupTime`. Retorna `undefined` si faltan coordenadas;
 *          retorna el array original sin enriquecer si la API principal falla.
 *
 * @category Map Utilities
 */
export const calculateDriverTimes = async ({
  markers,
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
}: CalculateDriverTimesParams): Promise<MarkerData[] | undefined> => {
  if (
    !userLatitude ||
    !userLongitude ||
    !destinationLatitude ||
    !destinationLongitude
  )
    return;

  if (!directionsAPI) {
    console.warn("Google Directions API key is missing. Skipping time calculations.");
    return markers;
  }

  try {
    const responseToDestination = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${userLatitude},${userLongitude}&destination=${destinationLatitude},${destinationLongitude}&mode=driving&units=metric&departure_time=now&traffic_model=best_guess&key=${directionsAPI}`
    );
    const dataToDestination = await responseToDestination.json();

    const hasDestRoute =
      dataToDestination &&
      dataToDestination.status === "OK" &&
      Array.isArray(dataToDestination.routes) &&
      dataToDestination.routes.length > 0 &&
      dataToDestination.routes[0].legs &&
      dataToDestination.routes[0].legs.length > 0;

    if (!hasDestRoute) {
      console.warn("Could not calculate the main user-to-destination route.");
      return markers;
    }

    const legDest = dataToDestination.routes[0].legs[0];
    const timeToDestination = legDest.duration_in_traffic?.value ?? legDest.duration.value;
    const distanceToDestination = legDest.distance.value;
    const rideMiles = distanceToDestination / 1609.34;
    const totalTimeInMinutes = timeToDestination / 60;

    const timesPromises = markers.map(async (marker) => {
      try {
        const responseToUser = await fetch(
          `https://maps.googleapis.com/maps/api/directions/json?origin=${marker.latitude},${marker.longitude}&destination=${userLatitude},${userLongitude}&mode=driving&units=metric&departure_time=now&traffic_model=best_guess&key=${directionsAPI}`
        );
        const dataToUser = await responseToUser.json();

        const hasUserRoute =
          dataToUser &&
          dataToUser.status === "OK" &&
          Array.isArray(dataToUser.routes) &&
          dataToUser.routes.length > 0 &&
          dataToUser.routes[0].legs &&
          dataToUser.routes[0].legs.length > 0;

        if (!hasUserRoute) {
          console.warn("No route from driver to user", { status: dataToUser?.status });
          return null;
        }

        const legUser = dataToUser.routes[0].legs[0];
        const timeToUser = legUser.duration_in_traffic?.value ?? legUser.duration.value;
        const distanceToUser = legUser.distance.value;
        const deadheadMiles = distanceToUser / 1609.34;
        const pickupTimeInMinutes = timeToUser / 60;

        const baseFare = 2.50;
        const perMileRate = 1.05;
        const perMinuteRate = 0.23;
        const adminFee = 0.88;
        const insuranceRate = 0.53;

        const fareBase = baseFare + rideMiles * perMileRate + (timeToDestination / 60) * perMinuteRate;
        const insurance = insuranceRate * (rideMiles + Math.min(deadheadMiles, 5));
        const cardCommission = fareBase * 0.03;

        let price = fareBase + adminFee + insurance;
        let priceWithCard = price + cardCommission;

        const MIN_CASH_FARE = 8.99;
        const MIN_CARD_FARE = 9.27;

        if (price < MIN_CASH_FARE) price = MIN_CASH_FARE;
        if (priceWithCard < MIN_CARD_FARE) priceWithCard = MIN_CARD_FARE;

        return {
          ...marker,
          time: totalTimeInMinutes,
          price: price,
          priceWithCard: priceWithCard,
          pickupTime: pickupTimeInMinutes,
        } as MarkerData;
      } catch (innerError) {
        console.warn("Failed to calculate time for marker", marker?.id, innerError);
        return null;
      }
    });

    const results = await Promise.all(timesPromises);
    return results.filter((r): r is MarkerData => r !== null);
  } catch (error) {
    console.error("Error calculating driver times:", error);
    return markers;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// calculatePickupETA
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationCoordinate {
  /** Latitud de la coordenada en grados decimales. */
  latitude: number;
  /** Longitud de la coordenada en grados decimales. */
  longitude: number;
}

export interface CalculatePickupETAParams {
  /** Ubicación GPS actual del conductor. */
  driverLocation: LocationCoordinate;
  /** Ubicación GPS actual del pasajero (punto de recogida). */
  userLocation: LocationCoordinate;
}

/**
 * Calcula el tiempo estimado de llegada del conductor al punto de recogida del pasajero.
 *
 * @remarks
 * A diferencia de {@link calculateDriverTimes} (que calcula el ETA para múltiples conductores
 * de forma paralela), esta función calcula el ETA para **un único conductor** y se llama
 * de forma periódica durante la fase de recogida (`PickUpRideComponent`) cada vez que
 * la posición del conductor se actualiza via RTDB.
 *
 * Usa `duration_in_traffic` cuando está disponible; cae a `duration` base como fallback.
 *
 * @param params - Ubicación del conductor y del pasajero.
 * @returns ETA en minutos (redondeado al entero más cercano), o `null` si el cálculo falla.
 *
 * @example
 * ```ts
 * const eta = await calculatePickupETA({
 *   driverLocation: { latitude: activeDriver.lat, longitude: activeDriver.lng },
 *   userLocation: { latitude: userLatitude, longitude: userLongitude },
 * });
 * ```
 *
 * @category Map Utilities
 */
export const calculatePickupETA = async ({ driverLocation, userLocation }: CalculatePickupETAParams): Promise<number | null> => {
  if (!driverLocation?.latitude || !driverLocation?.longitude || !userLocation?.latitude || !userLocation?.longitude) {
    console.warn("Missing location data for ETA calculation.");
    return null;
  }

  if (!directionsAPI) {
    console.warn("Google Directions API key is missing. Skipping ETA calculation.");
    return null;
  }

  try {
    console.log("--- DIRECTIONS API REQUEST: Calculate Pickup ETA ---");
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLocation.latitude},${driverLocation.longitude}&destination=${userLocation.latitude},${userLocation.longitude}&mode=driving&departure_time=now&traffic_model=best_guess&key=${directionsAPI}`
    );
    const data = await response.json();

    const hasRoute =
      data &&
      data.status === "OK" &&
      Array.isArray(data.routes) &&
      data.routes.length > 0 &&
      data.routes[0].legs &&
      data.routes[0].legs.length > 0;

    if (!hasRoute) {
      console.warn("Could not calculate pickup ETA:", { status: data?.status });
      return null;
    }

    const leg = data.routes[0].legs[0];
    const timeInSeconds = leg.duration_in_traffic?.value ?? leg.duration.value;
    const timeInMinutes = Math.round(timeInSeconds / 60);
    
    return timeInMinutes;
  } catch (error) {
    console.error("Error calculating pickup ETA:", error);
    return null;
  }
};