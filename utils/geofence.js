// Define here all the regions where you operate
export const OPERATIONAL_ZONES = [
  /*
  {
    name: "Caracas, Venezuela",
    center: { latitude: 10.4806, longitude: -66.9036 },
    radiusKm: 50,
    countryCode: "ve"
  },
  {
    name: "Doraville, GA, USA (inc. Brookhaven, Chamblee, Dunwoody)",
    center: { latitude: 33.9037, longitude: -84.2818 },
    radiusKm: 16,
    countryCode: "us"
  },
  {
    name: "El Salvador",
    center: { latitude: 13.7942, longitude: -88.8965 }, // Roughly the center. For a whole country, 150-200km works.
    radiusKm: 150, 
    countryCode: "sv"
  }
  */
];

/**
 * Checks if a coordinate is within any of the operational zones.
 * Currently disabled (returns true) to allow service everywhere.
 */
export const isWithinOperationalZone = (latitude, longitude) => {
  // if (!latitude || !longitude) return false;

  // // Check if distance to at least one zone center is within its max radius
  // return OPERATIONAL_ZONES.some(zone => {
  //   const distance = calculateHaversineDistance(
  //     latitude, 
  //     longitude, 
  //     zone.center.latitude, 
  //     zone.center.longitude
  //   );
  //   return distance <= zone.radiusKm;
  // });
  
  return true; // Bypass all checks
};

/**
 * Returns country restrictions for Google Places API.
 * Currently returns empty string to allow searching in any country.
 */
export const getGooglePlacesCountryRestrictions = () => {
  // const codes = [...new Set(OPERATIONAL_ZONES.map(z => z.countryCode))];
  // return codes.map(c => `country:${c}`).join('|');
  
  return ""; // No restrictions
};

// Helper: Haversine distance formula to calculate absolute kilometers between 2 coordinates
const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRadian = (angle) => (Math.PI / 180) * angle;

  const R = 6371; // Earth radius in kilometers
  const dLat = toRadian(lat2 - lat1);
  const dLon = toRadian(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadian(lat1)) * Math.cos(toRadian(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};
