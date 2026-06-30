import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function PaymentCancel() {
  const router = useRouter();

  useEffect(() => {
    // Navigate back to Home
    router.replace('/(tabs)/home');
  }, [router]);

  return null;
}
