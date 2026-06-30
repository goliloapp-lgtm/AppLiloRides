import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase-config';

// Define the 3 callables
export const runCleanupOnDemand = httpsCallable(functions, 'runCleanupOnDemand');
export const cleanupRideRequestsOnly = httpsCallable(functions, 'cleanupRideRequestsOnly');
export const cleanupInactiveDriversOnly = httpsCallable(functions, 'cleanupInactiveDriversOnly');
