import { create } from "zustand";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Driver, LocationData, RouteInfo, RideRequest } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// useLocationStore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma del estado gestionado por {@link useLocationStore}.
 * @category Stores
 */
export interface LocationState {
  /** Latitud GPS actual del usuario. `null` mientras no se obtiene la ubicación. */
  userLatitude: number | null;
  /** Longitud GPS actual del usuario. `null` mientras no se obtiene la ubicación. */
  userLongitude: number | null;
  /** Dirección textual de la ubicación actual del usuario. */
  userAddress: string | null;
  /** Latitud del destino seleccionado por el usuario. */
  destinationLatitude: number | null;
  /** Longitud del destino seleccionado por el usuario. */
  destinationLongitude: number | null;
  /** Dirección textual del destino seleccionado. */
  destinationAddress: string | null;
  /** `true` mientras se está obteniendo la ubicación inicial del dispositivo. */
  loading: boolean;
  /**
   * Actualiza la ubicación actual del usuario y limpia la ruta calculada.
   * @param location - Coordenadas y dirección del usuario.
   */
  setUserLocation: (location: { latitude: number | null; longitude: number | null; address: string | null }) => void;
  /**
   * Actualiza el destino seleccionado y limpia la ruta calculada.
   * @param location - Coordenadas y dirección del destino.
   */
  setDestinationLocation: (location: { latitude: number | null; longitude: number | null; address: string | null }) => void;
  /** Limpia el destino seleccionado y la ruta calculada. */
  clearDestinationLocation: () => void;
  /** Limpia la ubicación del usuario, el destino y la ruta calculada. */
  clearAllLocations: () => void;
}

/**
 * Store global para la gestión de ubicaciones del usuario y del destino.
 *
 * @remarks
 * Este store es el punto central para todas las coordenadas GPS de la app.
 * Cada vez que se actualiza la ubicación del usuario o el destino, se dispara
 * automáticamente un `clearRouteInfo()` en {@link useRouteStore} para forzar
 * el recálculo de la ruta.
 *
 * @example
 * ```tsx
 * const { userLatitude, userLongitude, setUserLocation } = useLocationStore();
 * ```
 * @category Stores
 */
export const useLocationStore = create<LocationState>((set) => ({
  userLatitude: null,
  userLongitude: null,
  userAddress: null,
  destinationLatitude: null,
  destinationLongitude: null,
  destinationAddress: null,
  loading: true,

  setUserLocation: ({ latitude, longitude, address }) => {
    set(() => ({
      userLatitude: latitude,
      userLongitude: longitude,
      userAddress: address,
      loading: false, 
    }));

    useRouteStore.getState().clearRouteInfo();
  },

  setDestinationLocation: ({ latitude, longitude, address }) => {
    set(() => ({
      destinationLatitude: latitude,
      destinationLongitude: longitude,
      destinationAddress: address,
    }));

    useRouteStore.getState().clearRouteInfo();
  },

  clearDestinationLocation: () => {
    set(() => ({
      destinationLatitude: null,
      destinationLongitude: null,
      destinationAddress: null,
    }));
    useRouteStore.getState().clearRouteInfo();
  },

  clearAllLocations: () => {
    set(() => ({
      userLatitude: null,
      userLongitude: null,
      userAddress: null,
      destinationLatitude: null,
      destinationLongitude: null,
      destinationAddress: null,
    }));
    useRouteStore.getState().clearRouteInfo();
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// useDriverStore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma del estado gestionado por {@link useDriverStore}.
 * @category Stores
 */
export interface DriverState {
  /** Lista de conductores activos disponibles, filtrados por el radio de 5 millas. */
  drivers: Driver[];
  /** Conductor seleccionado por el pasajero para solicitar el viaje. */
  selectedDriver: Driver | null;
  /**
   * Último snapshot del conductor activo, recibido desde Firebase Realtime Database.
   * Contiene la posición GPS actualizada en tiempo real durante el viaje.
   */
  realtimeDriver: Driver | null;
  /**
   * Contador incremental que dispara un re-fetch de conductores disponibles
   * cuando su valor cambia. Usado con `useEffect` en los componentes de mapa.
   */
  driversFetchTrigger: number;
  /**
   * Actualiza el conductor en tiempo real (posición GPS del conductor activo).
   * @param driver - Datos actualizados del conductor, o `null` si ya no está disponible.
   */
  setRealtimeDriver: (driver: Driver | null) => void;
  /**
   * Registra el conductor elegido por el pasajero.
   * @param driver - Conductor seleccionado, o `null` para limpiar la selección.
   */
  setSelectedDriver: (driver: Driver | null) => void;
  /**
   * Reemplaza la lista completa de conductores disponibles.
   * @param drivers - Nueva lista de conductores activos dentro del radio de 5 millas.
   */
  setDrivers: (drivers: Driver[]) => void;
  /** Limpia el conductor seleccionado y el conductor en tiempo real. */
  clearSelectedDriver: () => void;
  /**
   * Incrementa `driversFetchTrigger` para forzar un re-fetch de conductores.
   *
   * @remarks
   * Se llama cuando el pasajero vuelve a la pantalla de búsqueda después
   * de un viaje rechazado o cancelado.
   */
  triggerDriversFetch: () => void;
}

/**
 * Store global para la gestión de conductores disponibles y del conductor activo.
 *
 * @remarks
 * Gestiona tres conceptos distintos de "conductor":
 * - `drivers`: la lista completa de candidatos disponibles (resultado del filtro por radio)
 * - `selectedDriver`: el que el pasajero eligió antes de confirmar el viaje
 * - `realtimeDriver`: la posición en tiempo real del conductor durante el viaje activo
 *
 * @example
 * ```tsx
 * const { drivers, selectedDriver, setSelectedDriver } = useDriverStore();
 * ```
 * @category Stores
 */
export const useDriverStore = create<DriverState>((set) => ({
  drivers: [],
  selectedDriver: null,
  realtimeDriver: null,
  driversFetchTrigger: 0,

  setRealtimeDriver: (driver) => set(() => ({ realtimeDriver: driver })),
  setSelectedDriver: (driver) => set(() => ({ selectedDriver: driver })),
  setDrivers: (drivers) => set(() => ({ drivers })),
  clearSelectedDriver: () => set(() => ({ selectedDriver: null, realtimeDriver: null })),
  triggerDriversFetch: () => set((state) => ({ driversFetchTrigger: state.driversFetchTrigger + 1 })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// useRideStore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma del estado gestionado por {@link useRideStore}.
 * @category Stores
 */
export interface RideState {
  /**
   * Viaje activo del pasajero. Persiste en `AsyncStorage` bajo la clave `ride-storage`.
   * `null` cuando no hay viaje en curso.
   */
  activeRide: RideRequest | null;
  /** ID del cliente en Stripe para reutilizar el PaymentSheet sin re-inicializar. */
  customerId: string | null;
  /**
   * Registra el viaje activo y lo persiste en disco.
   * @param ride - Datos completos del viaje, o `null` para limpiar.
   */
  setActiveRide: (ride: RideRequest | null) => void;
  /**
   * Registra el ID de cliente de Stripe.
   * @param id - Customer ID de Stripe, o `null` para limpiar.
   */
  setCustomerId: (id: string | null) => void;
  /** Limpia el viaje activo y el customer ID de Stripe del store y de AsyncStorage. */
  clearActiveRide: () => void;
}

/**
 * Store global para el viaje activo del pasajero. **Persiste en disco (AsyncStorage).**
 *
 * @remarks
 * Este es el único store con persistencia. El estado de `activeRide` sobrevive
 * al cierre y reapertura de la app, lo que permite al pasajero retomar un viaje
 * en curso sin perder el contexto.
 *
 * ### Regla crítica de limpieza:
 * `clearActiveRide()` solo debe llamarse cuando Firebase **confirma exitosamente**
 * que no existe un viaje activo. Nunca llamarlo desde un bloque `catch` de una
 * query fallida (ver `checkForActiveRide` en `_layout.tsx`).
 *
 * @example
 * ```tsx
 * const { activeRide, setActiveRide, clearActiveRide } = useRideStore();
 * ```
 * @category Stores
 */
export const useRideStore = create<RideState>()(
  persist(
    (set) => ({
      activeRide: null,
      customerId: null,
      setActiveRide: (ride) => set(() => ({ activeRide: ride })),
      setCustomerId: (id) => set(() => ({ customerId: id })),
      clearActiveRide: () => set(() => ({ activeRide: null, customerId: null })),
    }),
    {
      name: 'ride-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// usePaymentStore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma del estado gestionado por {@link usePaymentStore}.
 * @category Stores
 */
export interface PaymentState {
  /** Método de pago actualmente seleccionado. `null` si el usuario aún no ha elegido. */
  paymentMethod: 'card' | 'cash' | null;
  /**
   * Establece el método de pago seleccionado.
   * @param method - `'card'` para tarjeta (Stripe), `'cash'` para efectivo, `null` para limpiar.
   */
  setPaymentMethod: (method: 'card' | 'cash' | null) => void;
}

/**
 * Store global para el método de pago seleccionado en el flujo de reserva.
 *
 * @remarks
 * Los dos métodos disponibles tienen implicaciones distintas:
 * - `'card'`: Requiere inicializar el PaymentSheet de Stripe vía Cloud Function.
 *   La tarifa incluye una comisión del 3% (mínimo $9.27).
 * - `'cash'`: No requiere Stripe. La tarifa no incluye comisión (mínimo $8.99).
 *
 * @example
 * ```tsx
 * const { paymentMethod, setPaymentMethod } = usePaymentStore();
 * ```
 * @category Stores
 */
export const usePaymentStore = create<PaymentState>((set) => ({
  paymentMethod: null,
  setPaymentMethod: (method) => set(() => ({ paymentMethod: method })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// useRouteStore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forma del estado gestionado por {@link useRouteStore}.
 * @category Stores
 */
export interface RouteState {
  /**
   * Información de la ruta calculada por Google Directions API.
   * `null` cuando no hay ruta calculada o fue limpiada.
   */
  routeInfo: RouteInfo | null;
  /** `true` mientras se está realizando la petición a Google Directions API. */
  isFetchingRoute: boolean;
  /**
   * Almacena el resultado del cálculo de ruta y desactiva el indicador de carga.
   * @param info - Datos de la ruta calculada, o `null` para limpiar.
   */
  setRouteInfo: (info: RouteInfo | null) => void;
  /** Limpia la ruta calculada y el indicador de carga. */
  clearRouteInfo: () => void;
  /**
   * Controla el indicador de carga mientras se calcula la ruta.
   * @param isFetching - `true` para mostrar el indicador, `false` para ocultarlo.
   */
  setIsFetchingRoute: (isFetching: boolean) => void;
}

/**
 * Store global para la ruta calculada entre el origen y el destino.
 *
 * @remarks
 * La ruta se calcula en el componente `Map.tsx` llamando a Google Directions API
 * y se almacena aquí para que otros componentes puedan leer la distancia y duración
 * sin repetir la petición.
 *
 * Se limpia automáticamente cada vez que cambia la ubicación del usuario o el destino
 * (ver {@link useLocationStore}).
 *
 * @example
 * ```tsx
 * const { routeInfo, isFetchingRoute } = useRouteStore();
 * ```
 * @category Stores
 */
export const useRouteStore = create<RouteState>((set) => ({
  routeInfo: null,
  isFetchingRoute: false,
  setRouteInfo: (info) => set(() => ({ routeInfo: info, isFetchingRoute: false })),
  clearRouteInfo: () => set(() => ({ routeInfo: null, isFetchingRoute: false })),
  setIsFetchingRoute: (isFetching) => set(() => ({ isFetchingRoute: isFetching })),
}));
