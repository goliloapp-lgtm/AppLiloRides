import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

export async function POST(request) {
  try {
    const body = await request.json();
    const {
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
    } = body;

    // Validación de campos (igual que antes)
    if (
      !origin_address ||
      !destination_address ||
      !origin_latitude ||
      !origin_longitude ||
      !destination_latitude ||
      !destination_longitude ||
      !ride_time ||
      !fare_price ||
      !payment_status ||
      !driver_id ||
      !user_id
    ) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Crear documento en Firestore
    const tripRef = await db.collection("trips").add({
      origin_address,
      destination_address,
      origin_latitude: Number(origin_latitude),
      origin_longitude: Number(origin_longitude),
      destination_latitude: Number(destination_latitude),
      destination_longitude: Number(destination_longitude),
      ride_time: new Date(ride_time), // Convertir a fecha si es necesario
      fare_price: Number(fare_price),
      payment_status,
      driver_id,
      user_id,
      created_at: new Date(), // Campo adicional para timestamp
    });

    // Obtener el documento recién creado
    const tripSnapshot = await tripRef.get();
    const tripData = tripSnapshot.data();

    return Response.json(
      {
        id: tripRef.id,
        ...tripData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inserting trip into Firebase:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
