import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function GET(request, { params }) {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing user ID" }), {
      status: 400,
    });
  }

  try {
    // 1. Obtener todos los viajes del usuario
    const tripsSnapshot = await db
      .collection("trips")
      .where("user_id", "==", id)
      .orderBy("created_at", "desc")
      .get();

    // 2. Si no hay viajes, retornar array vacío
    if (tripsSnapshot.empty) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }

    // 3. Obtener IDs de conductores únicos
    const driverIds = new Set();
    const trips = [];

    tripsSnapshot.forEach((doc) => {
      const tripData = doc.data();
      trips.push({
        ...tripData,
        ride_id: doc.id,
        created_at: tripData.created_at?.toDate
          ? tripData.created_at.toDate()
          : null,
        ride_time: tripData.ride_time?.toDate
          ? tripData.ride_time.toDate()
          : null,
      });
      driverIds.add(tripData.driver_id);
    });

    // 4. Obtener información de conductores
    const driversMap = new Map();
    const driversPromises = Array.from(driverIds).map(async (driverId) => {
      const driverDoc = await db.collection("drivers").doc(driverId).get();
      if (driverDoc.exists) {
        const driverData = driverDoc.data();
        driversMap.set(driverId, {
          driver_id: driverId,
          first_name: driverData?.first_name,
          last_name: driverData?.last_name,
          profile_image_url: driverData?.profile_image_url,
          car_image_url: driverData?.car_image_url,
          car_seats: driverData?.car_seats,
          rating: driverData?.rating,
        });
      }
    });

    await Promise.all(driversPromises);

    // 5. Combinar viajes con información de conductores
    const result = trips.map((trip) => ({
      ...trip,
      driver: driversMap.get(trip.driver_id) || null,
    }));

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching recent rides:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
    });
  }
}
