import { useState, useCallback } from 'react';
import {
  runCleanupOnDemand,
  cleanupRideRequestsOnly,
  cleanupInactiveDriversOnly,
} from '../lib/cleanupFunctions';

export const useCleanup = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runFullCleanup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runCleanupOnDemand();
      return result.data;
    } catch (err) {
      const errorMessage = err.message || 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runTripCleanup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await cleanupRideRequestsOnly();
      return result.data;
    } catch (err) {
      const errorMessage = err.message || 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runDriverCleanup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await cleanupInactiveDriversOnly();
      return result.data;
    } catch (err) {
      const errorMessage = err.message || 'Error desconocido';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    runFullCleanup,
    runTripCleanup,
    runDriverCleanup,
    loading,
    error,
  };
};
