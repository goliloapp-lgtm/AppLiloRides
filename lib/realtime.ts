import { ref, push, set, serverTimestamp, onValue, update } from 'firebase/database';
import { rtdb } from '../firebase-config';
import { generateId } from './utils';
import { useRideStore } from '../store';
import { LocationData, RideRequest } from '../types';

/**
 * Parámetros requeridos para crear una nueva solicitud de viaje en Firebase RTDB.
 * @category Realtime Database
 */
export interface CreateRideRequestParams {
  /** UID del pasajero en Firebase Auth. */
  userId: string;
  /** UID del conductor seleccionado en Firebase Auth. */
  driverId: string;
  /** Ubicación de recogida del pasajero. */
  origin: LocationData;
  /** Destino del viaje. */
  destination: LocationData;
  /**
   * Tarifa en centavos de dólar (USD).
   * @example 1099 // $10.99
   */
  farePriceCents: number;
  /** Tiempo estimado de llegada al destino en minutos. */
  etaMinutes: number;
  /** Método de pago seleccionado. */
  paymentMethod: 'card' | 'cash';
  /** ID del PaymentIntent de Stripe. Requerido para pagos con tarjeta; `null` para efectivo. */
  paymentIntentId?: string | null;
  /**
   * Estado inicial del pago.
   * @defaultValue `'requested'`
   */
  paymentStatus?: string;
  /**
   * Tipo de servicio.
   * @defaultValue `'Ride'`
   */
  serviceType?: string;
  /** Nombre del pasajero (para mostrar al conductor). */
  customerName: string;
  /** Apellido del pasajero. */
  customerLastName: string;
  /** Teléfono del pasajero. */
  customerPhoneNumber: string;
  /** Distancia total del viaje en millas (calculada por Google Directions API). */
  distanceMiles?: number;
}

/**
 * Crea una nueva solicitud de viaje en Firebase Realtime Database y notifica al conductor.
 *
 * @remarks
 * Este es el punto de entrada del flujo de viaje. Al llamar esta función:
 * 1. Se genera un ID único para el viaje (`rideKey`).
 * 2. Se escribe el nodo completo en `/rideRequests/{rideKey}` con `status: "requested"`.
 * 3. Se actualiza el store de Zustand con el viaje activo.
 * 4. Se escribe una notificación en `/driverNotifications/{driverId}` para alertar
 *    al conductor de la nueva solicitud.
 *
 * @param params - Todos los datos necesarios para crear el viaje.
 * @returns El ID único del viaje creado (`rideKey`).
 * @throws Error si la escritura en RTDB falla.
 *
 * @example
 * ```ts
 * const rideId = await createRideRequest({
 *   userId: user.uid,
 *   driverId: selectedDriver.id,
 *   origin: { latitude: 25.77, longitude: -80.19, address: "Miami, FL" },
 *   destination: { latitude: 25.80, longitude: -80.13, address: "Wynwood, FL" },
 *   farePriceCents: 1099,
 *   etaMinutes: 12,
 *   paymentMethod: 'cash',
 *   customerName: 'John',
 *   customerLastName: 'Doe',
 *   customerPhoneNumber: '+13051234567',
 * });
 * ```
 *
 * @category Realtime Database
 */
export async function createRideRequest({
  userId,
  driverId,
  origin,
  destination,
  farePriceCents,
  etaMinutes,
  paymentMethod,
  paymentIntentId,
  paymentStatus = 'requested',
  serviceType = 'Ride',
  customerName,
  customerLastName,
  customerPhoneNumber,
  distanceMiles,
}: CreateRideRequestParams): Promise<string> {
  const rideKey = generateId('ride');
  const rideRef = ref(rtdb, `rideRequests/${rideKey}`);
 
  const payload: RideRequest = {
    id: rideKey,
    userId,
    driverId,
    origin,
    destination,
    farePriceCents,
    etaMinutes,
    paymentMethod,
    paymentIntentId: paymentIntentId || null,
    paymentStatus,
    serviceType,
    status: 'requested',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    customerName,
    customerLastName,
    customerPhoneNumber,
    ...(distanceMiles !== undefined && { distanceMiles }),
  };
  console.log('Creating ride request:', payload);

  await set(rideRef, payload);
  
  // Registrar en Zustand inmediatamente para que la UI reaccione antes
  // de que llegue el primer snapshot de RTDB
  useRideStore.getState().setActiveRide(payload);
  
  if (driverId) {
    const notificationRef = push(ref(rtdb, `driverNotifications/${driverId}`));
    await set(notificationRef, {
      type: 'NEW_RIDE_REQUEST',
      rideId: rideKey,
      createdAt: serverTimestamp(),
      read: false,
    });
  }

  return rideKey;
}

/**
 * Suscribe a cambios en tiempo real de una solicitud de viaje específica.
 *
 * @remarks
 * Escucha el nodo `/rideRequests/{rideId}` en RTDB. Cualquier cambio de campo
 * (especialmente `status`) es entregado inmediatamente via el callback.
 *
 * La función retornada debe llamarse cuando el componente se desmonte para
 * cancelar la suscripción y evitar memory leaks.
 *
 * @param rideId - ID único del viaje a escuchar.
 * @param callback - Función llamada con los datos actualizados, o `null` si el nodo fue eliminado.
 * @returns Función de desuscripción que cancela el listener de RTDB.
 *
 * @example
 * ```ts
 * const unsubscribe = subscribeRideRequest(rideId, (data) => {
 *   if (data?.status === 'completed') router.push('/ride-completed');
 * });
 * // En el cleanup del useEffect:
 * return () => unsubscribe();
 * ```
 *
 * @category Realtime Database
 */
export function subscribeRideRequest(rideId: string, callback: (data: RideRequest | null) => void) {
  const rideRef = ref(rtdb, `rideRequests/${rideId}`);
  return onValue(rideRef, (snapshot) => {
    callback(snapshot.val());
  });
}

/**
 * Suscribe a las notificaciones entrantes del conductor en RTDB.
 *
 * @remarks
 * Escucha el nodo `/driverNotifications/{driverId}`. Usado principalmente
 * por la aplicación del conductor para detectar nuevas solicitudes de viaje.
 * En la app del pasajero, se usa de forma secundaria para confirmar el estado.
 *
 * @param driverId - UID del conductor a escuchar.
 * @param callback - Función llamada cuando llegan nuevas notificaciones.
 * @returns Función de desuscripción.
 *
 * @category Realtime Database
 */
export function subscribeDriverNotifications(driverId: string, callback: (data: any) => void) {
  const driverRef = ref(rtdb, `driverNotifications/${driverId}`);
  return onValue(driverRef, (snapshot) => {
    callback(snapshot.val());
  });
}

/**
 * Actualiza el campo `status` de un viaje en Firebase Realtime Database.
 *
 * @remarks
 * Siempre actualiza también el campo `updatedAt` con `serverTimestamp()`
 * para mantener la trazabilidad del historial de cambios.
 *
 * ### Transiciones de estado válidas:
 * ```
 * requested → accepted | rejected
 * accepted  → driver_arrived | cancelled
 * driver_arrived → in_progress | cancelled
 * in_progress → arrived | cancelled
 * arrived → completed
 * ```
 *
 * @param rideId - ID del viaje a actualizar.
 * @param status - Nuevo estado del viaje.
 * @returns Promise que resuelve cuando la actualización es confirmada por Firebase.
 *
 * @category Realtime Database
 */
export function updateRideStatus(rideId: string, status: RideRequest['status']) {
  const rideRef = ref(rtdb, `rideRequests/${rideId}`);
  return update(rideRef, { 
    status: status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Actualiza campos arbitrarios de un viaje en Firebase Realtime Database.
 *
 * @remarks
 * Versión más flexible de {@link updateRideStatus} que permite actualizar
 * cualquier campo del {@link RideRequest}. Siempre incluye `updatedAt` automáticamente.
 *
 * @param rideId - ID del viaje a actualizar.
 * @param data - Objeto con los campos parciales a actualizar (merge parcial).
 * @returns Promise que resuelve cuando la actualización es confirmada por Firebase.
 *
 * @example
 * ```ts
 * // Actualizar el paymentStatus después de capturar el PaymentIntent
 * await updateRideData(rideId, { paymentStatus: 'succeeded' });
 * ```
 *
 * @category Realtime Database
 */
export function updateRideData(rideId: string, data: Partial<RideRequest>) {
  const rideRef = ref(rtdb, `rideRequests/${rideId}`);
  return update(rideRef, { 
    ...data,
    updatedAt: serverTimestamp(),
  });
}
