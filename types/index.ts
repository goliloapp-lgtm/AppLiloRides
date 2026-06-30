import { TextInputProps, TouchableOpacityProps } from "react-native";

/**
 * Representa a un conductor activo registrado en el sistema Lilo.
 *
 * @remarks
 * Este tipo es utilizado tanto para renderizar marcadores en el mapa
 * como para mostrar la información del conductor en las tarjetas de selección.
 * Los campos opcionales pueden estar ausentes dependiendo de la fuente de datos
 * (Firestore vs. Realtime Database).
 *
 * @category Types
 */
export interface Driver {
  /** Identificador único del conductor en Firestore. */
  id: string;
  /** Nombre completo del conductor (campo legacy, puede venir de RTDB). */
  driverName?: string;
  /** Primer nombre del conductor. */
  first_name?: string;
  /** Apellido del conductor. */
  last_name?: string;
  /** URL de la foto de perfil del conductor. */
  profilePhoto?: string;
  /** URL alternativa de la foto de perfil (campo legacy). */
  profile_image_url?: string;
  /** URL de la imagen del vehículo del conductor. */
  car_image_url?: string;
  /** Modelo del vehículo del conductor (ej. "Toyota Corolla 2020"). */
  car_model?: string;
  /** Número total de asientos del vehículo. */
  car_seats?: number;
  /** Número de asientos disponibles actualmente. */
  seatsAvailable?: number;
  /** Calificación promedio del conductor (1–5 estrellas). */
  rating?: string | number;
  /** Número de teléfono del conductor. */
  phone?: string;
  /** Número de teléfono alternativo (campo legacy). */
  phoneNumber?: string;
  /** Latitud actual del conductor (coordenada GPS). */
  lat: number;
  /** Longitud actual del conductor (coordenada GPS). */
  lng: number;
}

/**
 * Extiende {@link Driver} con campos adicionales necesarios para
 * renderizar marcadores en el mapa y mostrar información de precio/tiempo.
 *
 * @remarks
 * `MarkerData` es el resultado de enriquecer un `Driver` con los datos
 * calculados por `calculateDriverTimes` (en `lib/Map.ts`). La distinción entre `lat/lng`
 * (del Driver original) y `latitude/longitude` (requerida por react-native-maps)
 * es intencional para mantener compatibilidad con ambos formatos.
 *
 * @category Types
 */
export interface MarkerData extends Driver {
  /** Latitud del marcador en el formato requerido por react-native-maps. */
  latitude: number;
  /** Longitud del marcador en el formato requerido por react-native-maps. */
  longitude: number;
  /** Etiqueta visible del marcador en el mapa (generalmente el nombre del conductor). */
  title: string;
  /** Tiempo total estimado del viaje en minutos (usuario → destino). */
  time?: number;
  /** Tarifa estimada en USD para pago en efectivo. */
  price?: number;
  /** Tarifa estimada en USD para pago con tarjeta (incluye comisión del 3%). */
  priceWithCard?: number;
  /** Tiempo estimado de llegada del conductor al punto de recogida, en minutos. */
  pickupTime?: number;
}

/**
 * Coordenadas geográficas y dirección textual de una ubicación.
 *
 * @remarks
 * Usado para representar el origen y destino de un viaje.
 * Los valores pueden ser `null` mientras la ubicación no ha sido determinada.
 *
 * @category Types
 */
export interface LocationData {
  /** Latitud de la ubicación en grados decimales. Null si no está disponible. */
  latitude: number | null;
  /** Longitud de la ubicación en grados decimales. Null si no está disponible. */
  longitude: number | null;
  /** Dirección textual legible por humanos (ej. "123 Main St, Miami, FL"). Null si no está disponible. */
  address: string | null;
}

/**
 * Información sobre la ruta calculada entre el origen y el destino.
 *
 * @remarks
 * Calculada mediante la Google Directions API. Se almacena en `useRouteStore` (en `store/index.ts`)
 * y es consumida por el componente `Map.tsx` para trazar la línea de ruta.
 *
 * @category Types
 */
export interface RouteInfo {
  /** Distancia total de la ruta en kilómetros. */
  distance: number;
  /** Duración estimada del viaje en minutos (considerando tráfico). */
  duration: number;
  /** Array de coordenadas que forman el polígono de la ruta en el mapa. */
  coordinates: { latitude: number; longitude: number }[];
}

/**
 * Representa una solicitud de viaje completa en el sistema Lilo.
 *
 * @remarks
 * Este es el tipo central de la aplicación. Los objetos de tipo `RideRequest`
 * se almacenan en Firebase Realtime Database bajo el nodo `/rideRequests/{rideId}`
 * y son compartidos en tiempo real entre la app del pasajero y la del conductor.
 *
 * ### Estados del ciclo de vida (`status`):
 * - `requested` → El pasajero creó el viaje, esperando respuesta del conductor
 * - `accepted` → El conductor aceptó el viaje y está en camino
 * - `driver_arrived` → El conductor llegó al punto de recogida
 * - `in_progress` → El viaje está en curso
 * - `arrived` → El conductor llegó al destino
 * - `completed` → El viaje fue completado exitosamente
 * - `cancelled` → El viaje fue cancelado (por pasajero o sistema)
 * - `rejected` → El conductor rechazó la solicitud
 *
 * @category Types
 */
export interface RideRequest {
  /** Identificador único del viaje en RTDB. Opcional en la creación (se genera automáticamente). */
  id?: string;
  /** UID del pasajero en Firebase Auth. */
  userId: string;
  /** UID del conductor en Firebase Auth. */
  driverId: string;
  /** Ubicación de recogida del pasajero. */
  origin: LocationData;
  /** Destino del viaje. */
  destination: LocationData;
  /**
   * Tarifa del viaje en centavos de dólar (USD).
   * @example 899 // representa $8.99
   */
  farePriceCents: number;
  /** Tiempo estimado de llegada al destino en minutos. */
  etaMinutes: number;
  /** Método de pago seleccionado por el pasajero. */
  paymentMethod: 'card' | 'cash';
  /** ID del PaymentIntent de Stripe. Null para pagos en efectivo. */
  paymentIntentId?: string | null;
  /** Estado del pago en Stripe (ej. "pending", "succeeded"). */
  paymentStatus: string;
  /** Tipo de servicio solicitado (por defecto "Ride"). */
  serviceType: string;
  /** Nombre del pasajero (para mostrar al conductor). */
  customerName: string;
  /** Apellido del pasajero. */
  customerLastName: string;
  /** Número de teléfono del pasajero. */
  customerPhoneNumber: string;
  /** Distancia total del viaje en millas (calculada por Google Directions API). */
  distanceMiles?: number;
  /** Estado actual del viaje en el ciclo de vida. */
  status: 'requested' | 'accepted' | 'driver_arrived' | 'in_progress' | 'arrived' | 'completed' | 'cancelled' | 'rejected';
  /** Timestamp de creación (ServerTimestamp de Firebase). */
  createdAt?: any;
  /** Timestamp de la última actualización (ServerTimestamp de Firebase). */
  updatedAt?: any;
}

/**
 * Perfil de usuario almacenado en Firestore bajo `/users/{uid}`.
 *
 * @remarks
 * Creado automáticamente en el primer inicio de sesión.
 * El campo `isActive` es controlado por el administrador del sistema —
 * si es `false`, el usuario ve la pantalla de cuenta desactivada.
 *
 * @category Types
 */
export interface UserProfile {
  /** Correo electrónico del usuario. */
  email: string;
  /** Nombre completo (usado como fallback si firstName/lastName no están disponibles). */
  displayName: string;
  /** Primer nombre del usuario. */
  firstName: string;
  /** Apellido del usuario. */
  lastName: string;
  /** Número de teléfono del usuario. */
  phone: string;
  /**
   * Indica si la cuenta del usuario está activa.
   * Si es `false`, se muestra la pantalla de cuenta desactivada
   * y se bloquea el acceso a la app.
   */
  isActive: boolean;
  /** Campo legacy para el nombre completo. */
  name?: string;
  /** Campo legacy para el nombre completo alternativo. */
  fullName?: string;
  /** ISO 8601 — fecha de creación del perfil. */
  createdAt?: string;
  /** ISO 8601 — fecha de la última actualización del perfil. */
  updatedAt?: string;
  /** URL de la foto de perfil almacenada en Firebase Storage. */
  profilePhoto?: string;
  /** URL de foto de perfil proveniente de Google/Apple Auth. */
  photoURL?: string;
}

/**
 * Props para el componente `CustomButton`.
 * @category Types
 */
export interface ButtonProps extends TouchableOpacityProps {
  /** Texto que muestra el botón. */
  title: string;
  /** Variante de color del fondo del botón. */
  bgVariant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'success';
  /** Variante de color del texto del botón. */
  textVariant?: 'default' | 'primary' | 'secondary' | 'danger' | 'success';
  /** Componente de icono a renderizar a la izquierda del texto. */
  IconLeft?: React.ComponentType<any> | null;
  /** Componente de icono a renderizar a la derecha del texto. */
  IconRight?: React.ComponentType<any> | null;
}

/**
 * Props para el componente `GoogleTextInput` de búsqueda de direcciones.
 * @category Types
 */
export interface GoogleInputProps {
  /** Variante del icono del campo de búsqueda. */
  icon?: 'search' | 'from' | 'to';
  /** Texto inicial del campo (usado para mostrar la ubicación actual o anterior). */
  initialLocation?: string;
  /** Texto placeholder del campo. */
  placeholder?: string;
  /**
   * Callback ejecutado cuando el usuario selecciona una ubicación de la lista de sugerencias.
   * @param location - Datos de la ubicación seleccionada incluyendo coordenadas y dirección.
   */
  handlePress: (location: LocationData) => void;
}

/**
 * Props para campos de entrada de texto con label e icono.
 * @category Types
 */
export interface InputFieldProps extends TextInputProps {
  /** Etiqueta visible sobre el campo de texto. */
  label: string;
  /** Icono decorativo a la izquierda del campo. */
  icon?: any;
  /** Si es `true`, oculta el texto ingresado (para contraseñas). */
  secureTextEntry?: boolean;
  /** Clase CSS adicional para el contenedor del label. */
  labelStyle?: string;
  /** Clase CSS adicional para el contenedor externo. */
  containerStyle?: string;
  /** Clase CSS adicional para el campo de texto. */
  inputStyle?: string;
  /** Clase CSS adicional para el icono. */
  iconStyle?: string;
}
