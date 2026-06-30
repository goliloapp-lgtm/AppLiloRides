import { addDoc, collection, serverTimestamp as fsServerTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';

export async function createTripClient({
  origin_address,
  destination_address,
  origin_latitude,
  origin_longitude,
  destination_latitude,
  destination_longitude,
  ride_time,
  fare_price,
  payment_status,
  driver_id,
  user_id,
}) {
  return await addDoc(collection(db, 'trips'), {
    origin_address,
    destination_address,
    origin_latitude: Number(origin_latitude),
    origin_longitude: Number(origin_longitude),
    destination_latitude: Number(destination_latitude),
    destination_longitude: Number(destination_longitude),
    ride_time: String(ride_time),
    fare_price: Number(fare_price),
    payment_status,
    driver_id,
    user_id,
    created_at: fsServerTimestamp(),
  });
}


