import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PaymentSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Navigate to find-ride screen
    router.replace('/find-ride');
  }, [router]);

  return null;
}
