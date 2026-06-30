import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerTokenWithBackend } from './auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase-config';

/**
 * Callbacks que el consumidor puede registrar para reaccionar a eventos de FCM.
 *
 * @remarks
 * Todos los callbacks son opcionales. Los que no se implementen son ignorados silenciosamente.
 * Se pasan a {@link initializeFCM} para configurar los listeners de mensajes en foreground.
 *
 * @category FCM
 */
export interface FCMCallbacks {
  /** Llamado cuando el backend indica que la sesión fue terminada en otro dispositivo. */
  onSessionTerminated?: (data?: any) => void;
  /** Llamado cuando un conductor acepta la solicitud de viaje del pasajero. */
  onRideAccepted?: (data?: any) => void;
  /** Llamado cuando un conductor rechaza la solicitud de viaje. */
  onRideRejected?: (data?: any) => void;
  /** Llamado cuando el conductor inicia el viaje (`in_progress`). */
  onRideStarted?: (data?: any) => void;
  /** Llamado cuando el conductor cancela el viaje. */
  onRideCancelledByDriver?: (data?: any) => void;
  /** Llamado cuando el conductor llega al punto de recogida. */
  onDriverArrived?: (data?: any) => void;
  /**
   * Llamado cuando el token FCM del dispositivo es renovado por Firebase.
   * Se usa para re-registrar el nuevo token en el backend.
   * @param token - El nuevo token FCM.
   */
  onTokenRefresh?: (token: string) => void;
}

/**
 * Crea los canales de notificación de Android requeridos por el sistema operativo.
 *
 * @remarks
 * En Android 8.0+ (API 26), las notificaciones deben pertenecer a un canal.
 * Esta función crea dos canales:
 * - `ride-events`: Para eventos del viaje (alta importancia, con vibración).
 * - `session-alerts`: Para alertas de sesión (alta importancia).
 *
 * Es un no-op en iOS. Debe llamarse una vez, temprano en el ciclo de vida de la app.
 * Usa `@notifee/react-native` si está disponible; si no, omite la creación.
 *
 * @category FCM
 */
export const setupAndroidChannels = async () => {
  if (Platform.OS !== 'android') return;
  try {
    const { default: notifee, AndroidImportance } = await import('@notifee/react-native');

    await notifee.createChannel({
      id: 'ride-events',
      name: 'Ride Events',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });

    await notifee.createChannel({
      id: 'session-alerts',
      name: 'Session Alerts',
      importance: AndroidImportance.HIGH,
    });

    console.log('[FCM] Android notification channels created');
  } catch (e: any) {
    console.warn('[FCM] @notifee not available, skipping Android channel setup:', e.message);
  }
};

/**
 * Solicita permisos de notificaciones push al usuario del dispositivo.
 *
 * @remarks
 * El comportamiento varía por plataforma:
 * - **iOS**: Usa `messaging().requestPermission()` de Firebase. Acepta tanto
 *   `AUTHORIZED` como `PROVISIONAL` (notificaciones silenciosas).
 * - **Android 13+ (API 33+)**: Solicita el permiso `POST_NOTIFICATIONS` explícitamente.
 * - **Android < 13**: Los permisos son otorgados automáticamente; no se requiere solicitud.
 *
 * @returns `true` si los permisos fueron otorgados, `false` en caso contrario.
 *
 * @category FCM
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    console.log('[FCM] Requesting notification permissions...');

    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('[FCM] Notification permissions not granted on iOS');
        return false;
      }
      console.log('[FCM] iOS notification permissions granted');
    } else if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('[FCM] POST_NOTIFICATIONS permission denied on Android 13+');
          return false;
        }
        console.log('[FCM] Android POST_NOTIFICATIONS permission granted');
      }
    }

    return true;
  } catch (error) {
    console.error('[FCM] Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Obtiene el token FCM actual del dispositivo desde Firebase Cloud Messaging.
 *
 * @remarks
 * El token identifica de forma única al dispositivo en el sistema de notificaciones
 * de Firebase. Debe registrarse en el backend para que los Cloud Functions puedan
 * enviar notificaciones push a este dispositivo específico.
 *
 * El token puede cambiar en cualquier momento (rotación de tokens de Firebase).
 * Usa {@link setupTokenRefreshListener} para mantenerse actualizado.
 *
 * @returns El token FCM como string, o `null` si no se pudo obtener.
 *
 * @category FCM
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    console.log('[FCM] Getting FCM token...');
    const token = await messaging().getToken();

    if (token) {
      console.log('[FCM] FCM Token obtained:', token.substring(0, 30) + '...');
      return token;
    } else {
      console.warn('[FCM] No FCM token received');
      return null;
    }
  } catch (error) {
    console.error('[FCM] Error getting FCM token:', error);
    return null;
  }
};

/**
 * Enruta un mensaje de notificación FCM al callback correspondiente según su tipo.
 *
 * @remarks
 * Este es el dispatcher central de eventos FCM. Recibe los datos crudos de la
 * notificación y ejecuta el callback apropiado del objeto {@link FCMCallbacks}.
 *
 * ### Tipos de mensajes manejados:
 * | `type`                    | Callback               | Acción en la app |
 * |---------------------------|------------------------|------------------|
 * | `DRIVER_ARRIVED`          | `onDriverArrived`      | Toast de llegada |
 * | `SESSION_TERMINATED`      | `onSessionTerminated`  | Cierra sesión    |
 * | `RIDE_ACCEPTED`           | `onRideAccepted`       | Toast de éxito   |
 * | `RIDE_REJECTED`           | `onRideRejected`       | Toast de error   |
 * | `RIDE_STARTED`            | `onRideStarted`        | Toast de info    |
 * | `RIDE_CANCELLED_BY_DRIVER`| `onRideCancelledByDriver` | Toast de error |
 * | `RIDE_CANCELLED_BY_CLIENT`| *(ignorado)*           | Solo para driver |
 * | `NEW_RIDE_REQUEST`        | *(ignorado)*           | Solo para driver |
 *
 * @param data - Objeto `data` del mensaje FCM (no la notificación visible, sino el payload de datos).
 * @param callbacks - Implementaciones de los callbacks de eventos.
 *
 * @category FCM
 */
export const handleNotification = (data: any = {}, callbacks: FCMCallbacks = {}) => {
  const { type } = data;
  console.log('[FCM] Handling notification type:', type, data);

  switch (type) {
    case 'DRIVER_ARRIVED':
      console.log('[FCM] DRIVER_ARRIVED received');
      if (callbacks.onDriverArrived) callbacks.onDriverArrived(data);
      break;

    case 'SESSION_TERMINATED':
      console.log('[FCM] SESSION_TERMINATED received');
      if (callbacks.onSessionTerminated) callbacks.onSessionTerminated(data);
      break;

    case 'RIDE_ACCEPTED':
      console.log('[FCM] RIDE_ACCEPTED received');
      if (callbacks.onRideAccepted) callbacks.onRideAccepted(data);
      break;

    case 'RIDE_REJECTED':
      console.log('[FCM] RIDE_REJECTED received');
      if (callbacks.onRideRejected) callbacks.onRideRejected(data);
      break;

    case 'RIDE_STARTED':
      console.log('[FCM] RIDE_STARTED received');
      if (callbacks.onRideStarted) callbacks.onRideStarted(data);
      break;

    case 'RIDE_CANCELLED_BY_DRIVER':
      console.log('[FCM] RIDE_CANCELLED_BY_DRIVER received');
      if (callbacks.onRideCancelledByDriver) callbacks.onRideCancelledByDriver(data);
      break;

    case 'RIDE_CANCELLED_BY_CLIENT':
      // Enviado a conductores únicamente — la app del pasajero lo ignora
      console.log('[FCM] RIDE_CANCELLED_BY_CLIENT received (driver-only, ignoring)');
      break;

    case 'NEW_RIDE_REQUEST':
      // Enviado a conductores únicamente — la app del pasajero lo ignora
      console.log('[FCM] NEW_RIDE_REQUEST received (driver-only, ignoring)');
      break;

    default:
      console.log('[FCM] Unknown notification type, ignoring:', type);
  }
};

/**
 * Registra un listener para mensajes FCM recibidos mientras la app está en primer plano.
 *
 * @remarks
 * En foreground, Firebase **no muestra** la notificación automáticamente.
 * Este listener la recibe y delega el manejo a {@link handleNotification},
 * que a su vez ejecuta los callbacks registrados (ej. mostrar un Toast).
 *
 * La función retornada debe llamarse al desmontar para evitar listeners duplicados.
 *
 * @param callbacks - Callbacks de eventos FCM a ejecutar al recibir mensajes.
 * @returns Función de desuscripción del listener de foreground.
 *
 * @category FCM
 */
export const setupForegroundNotificationHandler = (callbacks: FCMCallbacks = {}) => {
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    console.log('[FCM] Foreground message received:', remoteMessage);
    handleNotification(remoteMessage.data, callbacks);
  });

  return unsubscribe;
};

/**
 * Registra un listener que detecta cuando el token FCM del dispositivo es renovado.
 *
 * @remarks
 * Firebase puede rotar los tokens FCM en cualquier momento. Cuando esto ocurre,
 * el nuevo token debe registrarse en el backend para continuar recibiendo notificaciones.
 *
 * @param onTokenRefresh - Callback llamado con el nuevo token cuando se renueva.
 * @returns Función de desuscripción del listener de renovación de token.
 *
 * @category FCM
 */
export const setupTokenRefreshListener = (onTokenRefresh?: (token: string) => void) => {
  const unsubscribe = messaging().onTokenRefresh(async (token) => {
    console.log('[FCM] FCM Token refreshed:', token.substring(0, 30) + '...');
    if (onTokenRefresh) {
      onTokenRefresh(token);
    }
  });

  return unsubscribe;
};

/**
 * Obtiene los datos de la notificación que causó la apertura de la app desde estado cerrado.
 *
 * @remarks
 * Cuando el usuario toca una notificación push con la app cerrada (`killed state`),
 * Firebase guarda los datos de esa notificación. Esta función los recupera al iniciar la app
 * y permite navegar a la pantalla correcta según el tipo de evento.
 *
 * Devuelve `null` si la app fue abierta normalmente (sin tocar una notificación).
 *
 * @returns Los datos del payload de la notificación, o `null` si no aplica.
 *
 * @category FCM
 */
export const getInitialNotification = async (): Promise<any | null> => {
  try {
    const remoteMessage = await messaging().getInitialNotification();
    if (remoteMessage) {
      console.log('[FCM] App opened from notification:', remoteMessage.data);
      return remoteMessage.data;
    }
    return null;
  } catch (error) {
    console.error('[FCM] Error getting initial notification:', error);
    return null;
  }
};

/**
 * Inicializa el sistema FCM completo de la app: permisos, canales, token y listeners.
 *
 * @remarks
 * Esta es la función de entrada principal para FCM. Se llama desde `_layout.tsx`
 * cuando el usuario está autenticado. Ejecuta en orden:
 * 1. Configura el handler de notificaciones en foreground (banners visibles).
 * 2. Crea canales de Android.
 * 3. Solicita permisos al usuario.
 * 4. Obtiene el token FCM actual y lo registra en el backend.
 * 5. Instala el listener de foreground con los callbacks proporcionados.
 * 6. Instala el listener de renovación de token.
 *
 * @param callbacks - Callbacks de eventos FCM a registrar en el listener de foreground.
 * @returns Función de cleanup que desuscribe todos los listeners activos.
 *          Debe llamarse cuando el componente raíz se desmonte (ej. en el `return` del `useEffect`).
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   let cleanup = () => {};
 *   if (user) {
 *     initializeFCM({ onRideAccepted: () => Toast.show({ type: 'success', ... }) })
 *       .then(fn => { cleanup = fn; });
 *   }
 *   return () => cleanup();
 * }, [user]);
 * ```
 *
 * @category FCM
 */
export const initializeFCM = async (callbacks: FCMCallbacks = {}): Promise<() => void> => {
  try {
    console.log('[FCM] Initializing FCM...');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
    });

    await setupAndroidChannels();

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('[FCM] Permissions not granted, FCM will not work properly');
      return () => {};
    }

    const currentToken = await getFCMToken();
    if (currentToken) {
      console.log('[FCM] Registering initial token during initialization...');
      registerTokenWithBackend(currentToken).catch(err => 
        console.warn('[FCM] Failed to register initial token with backend:', err.message)
      );
    }

    const unsubscribeForeground = setupForegroundNotificationHandler(callbacks);

    const unsubscribeTokenRefresh = setupTokenRefreshListener((newToken) => {
      console.log('[FCM] Token refreshed, calling backend registration...');
      registerTokenWithBackend(newToken).catch(err => 
        console.warn('[FCM] Failed to register refreshed token with backend:', err)
      );
      if (callbacks.onTokenRefresh) callbacks.onTokenRefresh(newToken);
    });

    console.log('[FCM] FCM initialized successfully');

    return () => {
      unsubscribeForeground();
      unsubscribeTokenRefresh();
      console.log('[FCM] FCM listeners cleaned up');
    };
  } catch (error) {
    console.error('[FCM] Error initializing FCM:', error);
    return () => {};
  }
};

/**
 * Desregistra el token FCM del backend invocando la Cloud Function `unregisterFCMToken`.
 *
 * @remarks
 * Debe llamarse durante el logout del usuario para que el backend deje de enviar
 * notificaciones push a este dispositivo. Si el token es vacío o falsy, retorna
 * inmediatamente sin hacer la petición.
 *
 * @param fcmToken - El token FCM a desregistrar.
 * @returns Promise con el resultado de la Cloud Function.
 *
 * @category FCM
 */
export const unregisterToken = async (fcmToken: string) => {
  if (!fcmToken) return { success: false };
  const fn = httpsCallable(functions, 'unregisterFCMToken');
  return fn({ fcmToken });
};
