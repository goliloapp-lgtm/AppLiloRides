import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import AutocompleteInput from 'react-native-autocomplete-input';
import Ionicons from "@expo/vector-icons/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import { useLocationStore } from "../store";
import { useTranslation } from "../hooks/useTranslation";
import Toast from "react-native-toast-message";
import { isWithinOperationalZone, getGooglePlacesCountryRestrictions } from "../utils/geofence";

const googlePlacesApiKey = process.env.EXPO_PUBLIC_LILO_GOOGLE_PLACES_API_KEY;

export default function GoogleTextInput(props) {
  const { handlePress, initialLocation, icon, placeholder } = props;
  const [query, setQuery] = useState(initialLocation ?? "");
  const [results, setResults] = useState([]);
  const [placeSelected, setPlaceSelected] = useState(false);
  const debounceTimeout = useRef(null);
  const { userLatitude, userLongitude } = useLocationStore();
  const { t } = useTranslation("home");
  
  // Use provided placeholder or translation
  // Use provided placeholder or translation
  const inputPlaceholder = placeholder || initialLocation || t("destinationPlaceholder");

  const debouncedFetch = useCallback((text) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      if (text.length > 2 && !placeSelected) {
        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${googlePlacesApiKey}&input=${text}&language=en`;
        
        // Dynamic multi-country restrictions
        const countryRestrictions = getGooglePlacesCountryRestrictions();
        if (countryRestrictions) {
          url += `&components=${countryRestrictions}`;
        }

        if (userLatitude && userLongitude) {
          url += `&location=${userLatitude},${userLongitude}&radius=50`; // 50km bias
        }
        fetch(url)
          .then((res) => res.json())
          .then((json) => {
            if (json.predictions) {
              setResults(json.predictions);
            }
          })
          .catch((err) => console.error("Google Places Autocomplete fetch error:", err));
      } else {
        setResults([]);
      }
    }, 500); // 500ms debounce delay
  }, [placeSelected, userLatitude, userLongitude]);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
      debouncedFetch(query);
    } else {
      isMounted.current = true;
    }
  }, [query, debouncedFetch]);

  const onPlaceSelect = (place) => {
    setQuery(place.description);
    setResults([]);
    setPlaceSelected(true);

    // Llamada inmediata para permitir que la pantalla Home navegue incluso si el fetch de detalles falla o tarda.
    if (typeof handlePress === "function") {
      handlePress({
        latitude: null,
        longitude: null,
        address: place.description,
      });
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?key=${googlePlacesApiKey}&place_id=${place.place_id}&language=en`;
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.result && typeof handlePress === "function") {
          const lat = json.result.geometry.location.lat;
          const lng = json.result.geometry.location.lng;

          // Strict Geofencing check
          if (!isWithinOperationalZone(lat, lng)) {
            Toast.show({
              type: 'error',
              text1: t("messages.outOfZoneTitle") || "Out of Service Area",
              text2: t("messages.outOfZoneDetail") || "Lilo does not operate in the selected area yet."
            });
            setQuery("");
            setPlaceSelected(false);
            // Clear the parent's state
            handlePress({
              latitude: null,
              longitude: null,
              address: null,
            });
            return;
          }

          handlePress({
            latitude: lat,
            longitude: lng,
            address: place.description,
          });
        }
      })
      .catch((err) => console.error("Google Places Details fetch error:", err));
  };

  const onChangeText = (text) => {
    setQuery(text);
    setPlaceSelected(false);
  }

  const clearInput = () => {
    setQuery('');
    setResults([]);
  }

  return (
    <View className={`flex-row px-3 py-2 min-h-[50px] rounded-lg items-center z-10 ${props.containerStyle || 'bg-white'}`}>
        {icon && (
          <>
            {icon === "search" && (
              <Ionicons
                name="search-outline"
                size={24}
                color="black"
                className="mr-2"
              />
            )}
            {icon === "from" && (
              <Entypo
                name="location-pin"
                size={24}
                color="black"
                className="mr-2"
              />
            )}
            {icon === "to" && (
              <Feather name="map" size={24} color="black" className="mr-2" />
            )}
          </>
        )}
        <AutocompleteInput
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "black",
            backgroundColor: props.textInputBackgroundColor || "white",
            paddingRight: 30, // Make space for the clear button
          }}
          containerStyle={{
            flex: 1,
            zIndex: 1,
          }}
          inputContainerStyle={{
            borderWidth: 0,
            backgroundColor: "transparent",
          }}
          listContainerStyle={{ 
            zIndex: 2,
            position: 'absolute',
            top: 50,
            left: 0,
            right: 0
          }}
          data={results}
          value={query}
          onChangeText={onChangeText}
          placeholder={inputPlaceholder}
          placeholderTextColor="#9ca3af"
          flatListProps={{
            keyboardShouldPersistTaps: 'always',
            keyExtractor: (_, idx) => idx.toString(),
            renderItem: ({ item }) => (
              <TouchableOpacity onPress={() => onPlaceSelect(item)}>
                <Text className="text-base p-2.5">{item.description}</Text>
              </TouchableOpacity>
            ),
            style: {
              backgroundColor: "white",
              shadowColor: "#d4d4d4",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.8,
              shadowRadius: 2,
              elevation: 5,
              borderRadius: 8,
              marginTop: 8,
            }
          }}
        />
        {query.length > 0 && (
            <TouchableOpacity onPress={clearInput} className="absolute right-3 z-20">
                <Ionicons name="close-circle" size={24} color="#2B9DD9" />
            </TouchableOpacity>
        )}
    </View>
  );
}