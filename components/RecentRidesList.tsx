import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import RideCard, { Ride } from "./RideCard";
import { useAuth } from "../lib/context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { db } from "../firebase-config";
import { collection, query as fsQuery, where as fsWhere, getDocs, doc, getDoc } from "firebase/firestore";

export default function RecentRidesList() {
  const { user } = useAuth();
  const { t } = useTranslation("history");
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchRides = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const historyTripsRef = collection(db, "historyTrips");
        const ridesQuery = fsQuery(
          historyTripsRef,
          fsWhere("passengerId", "==", user.uid)
        );

        const querySnapshot = await getDocs(ridesQuery);
        
        if (!querySnapshot.empty) {
          const tripsDocs = querySnapshot.docs;
          
          // Get unique driver IDs to fetch their names from the users collection
          const driverNamesMap: { [key: string]: string } = {};
          const driverIds = Array.from(
            new Set(
              tripsDocs
                .map((doc) => doc.data().driverId)
                .filter(Boolean)
            )
          );

          await Promise.all(
            driverIds.map(async (driverId) => {
              try {
                const driverDocRef = doc(db, "users", driverId);
                const driverDoc = await getDoc(driverDocRef);
                if (driverDoc.exists()) {
                  const driverData = driverDoc.data();
                  driverNamesMap[driverId] = driverData.firstName || driverData.displayName || "Driver";
                }
              } catch (err) {
                console.error("Error fetching driver profile:", err);
              }
            })
          );

          const formattedRides: Ride[] = tripsDocs.map((doc) => {
            const r = doc.data();
            
            const safeCreatedAt = (() => {
              if (!r.createdAt) return new Date().toISOString();
              if (r.createdAt && typeof r.createdAt.toDate === "function") {
                try {
                  return r.createdAt.toDate().toISOString();
                } catch (e) {
                  // Ignore and fall through
                }
              }
              const d = new Date(r.createdAt);
              if (!isNaN(d.getTime())) return d.toISOString();
              const num = Number(r.createdAt);
              if (!isNaN(num)) {
                const dNum = new Date(num);
                if (!isNaN(dNum.getTime())) return dNum.toISOString();
              }
              return new Date().toISOString();
            })();

            return {
              ride_id: r.rideId || doc.id,
              destination_longitude: r.destination?.longitude || 0,
              destination_latitude: r.destination?.latitude || 0,
              origin_address: r.origin?.address || "Unknown Origin",
              destination_address: r.destination?.address || "Unknown Destination",
              created_at: safeCreatedAt,
              ride_time: r.etaMinutes || 0,
              payment_status: r.paid ? "paid" : "unpaid",
              status: r.status || "completed",
              driver: r.driverId ? {
                driver_id: r.driverId,
                first_name: driverNamesMap[r.driverId] || "Driver",
                last_name: "",
                car_seats: 4,
              } : null
            };
          });
          
          formattedRides.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
          setRides(formattedRides);
        } else {
          setRides([]);
        }
      } catch (err: any) {
        console.error("Error fetching recent rides:", err);
        setError(err.message || "Could not load rides");
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, [user?.uid]);

  if (loading) {
    return (
      <View className="py-10 items-center justify-center">
        <ActivityIndicator size="large" color="#2B9DD9" />
        <Text className="mt-4 text-gray-500">{t("loading") || "Loading rides..."}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="py-10 items-center justify-center">
        <Text className="text-red-500 font-bold text-center">Error: {error}</Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View className="py-10 items-center justify-center">
        <Text className="text-gray-500 font-semibold text-center">
          {t("noRides") || "No recent rides found"}
        </Text>
      </View>
    );
  }

  return (
    <View className="space-y-5">
      {rides.map((ride) => (
        <RideCard key={ride.ride_id} ride={ride} />
      ))}
    </View>
  );
}
