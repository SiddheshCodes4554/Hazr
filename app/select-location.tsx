import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import WebView from "react-native-webview";
import * as Location from "expo-location";
import { useTheme } from "../src/components/ThemeProvider";
import { Button } from "../src/components/Button";
import { Card } from "../src/components/Card";
import {
  ArrowLeft,
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Brain,
} from "lucide-react-native";
import { Coordinates } from "../src/features/location/types";

export default function SelectLocationScreen() {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const webViewRef = useRef<WebView>(null);

  // Read prefilled report parameters passed along from camera or report screens
  const params = useLocalSearchParams<{
    photoUrl?: string;
    preTitle?: string;
    preDesc?: string;
    preCategory?: string;
    preSeverity?: string;
  }>();

  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [hazardLocation, setHazardLocation] = useState<Coordinates | null>(null);

  const [reporterAddress, setReporterAddress] = useState("Resolving reporter address...");
  const [hazardAddress, setHazardAddress] = useState("Resolving hazard address...");
  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard");

  // Helper to reverse geocode coordinate on device (free)
  const getAddress = async (coords: Coordinates): Promise<string> => {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (result && result.length > 0) {
        const addr = result[0];
        const street = addr.street || addr.name || "";
        const city = addr.city || "";
        const region = addr.region || "";
        return `${street}, ${city}, ${region}`.trim().replace(/^,|,$/, "");
      }
      return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    } catch {
      return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    }
  };

  // Get current user location and request permission on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location Permission Required",
            "Hazr requires location access to initialize your hazard pin coordinates. Falling back to default region."
          );
          const fallback = { latitude: 37.7749, longitude: -122.4194 }; // SOMA
          setUserLocation(fallback);
          setHazardLocation(fallback);
          setIsLoadingLocation(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        setUserLocation(coords);
        setHazardLocation(coords);
        setIsLoadingLocation(false);
      } catch (err) {
        console.error("Error getting location:", err);
        const fallback = { latitude: 37.7749, longitude: -122.4194 };
        setUserLocation(fallback);
        setHazardLocation(fallback);
        setIsLoadingLocation(false);
      }
    })();
  }, []);

  // Update geocode address when coordinates change
  useEffect(() => {
    if (userLocation) {
      getAddress(userLocation).then(setReporterAddress);
    }
  }, [userLocation]);

  useEffect(() => {
    if (hazardLocation) {
      getAddress(hazardLocation).then(setHazardAddress);
    }
  }, [hazardLocation]);

  // Leaflet map source matching light/dark mode and enabling interactive events
  const leafletHTML = useMemo(() => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; background-color: ${isDark ? "#09090b" : "#ffffff"}; }
        html, body, #map { height: 100%; width: 100vw; }
        .leaflet-control-zoom { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([37.7749, -122.4194], 16);
        
        const standardTile = L.tileLayer('${
          isDark
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }', { maxZoom: 20 });
        
        const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19
        });
        
        standardTile.addTo(map);
        
        let userMarker = null;
        let hazardMarker = null;
        
        window.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'init') {
            const userLoc = data.userLocation;
            const hazardLoc = data.hazardLocation;
            
            map.setView([hazardLoc.latitude, hazardLoc.longitude], 16);
            
            // Draw Blue User Pin
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.circle([userLoc.latitude, userLoc.longitude], {
              radius: 12,
              fillColor: '#3b82f6',
              color: '#ffffff',
              weight: 2,
              fillOpacity: 0.85
            }).addTo(map);
            
            // Draw Red Draggable Hazard Marker
            if (hazardMarker) map.removeLayer(hazardMarker);
            hazardMarker = L.marker([hazardLoc.latitude, hazardLoc.longitude], {
              draggable: true
            }).addTo(map);
            
            hazardMarker.on('dragend', function(e) {
              const position = hazardMarker.getLatLng();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_changed',
                latitude: position.lat,
                longitude: position.lng
              }));
            });
          }
          
          if (data.type === 'toggle_map_mode') {
            if (data.mode === 'satellite') {
              map.removeLayer(standardTile);
              satelliteTile.addTo(map);
            } else {
              map.removeLayer(satelliteTile);
              standardTile.addTo(map);
            }
          }
          
          if (data.type === 'zoom_in') {
            map.zoomIn();
          }
          
          if (data.type === 'zoom_out') {
            map.zoomOut();
          }
          
          if (data.type === 'recenter') {
            const userLoc = data.userLocation;
            map.setView([userLoc.latitude, userLoc.longitude], 16);
            if (hazardMarker) {
              hazardMarker.setLatLng([userLoc.latitude, userLoc.longitude]);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'location_changed',
                latitude: userLoc.latitude,
                longitude: userLoc.longitude
              }));
            }
          }
        });
        
        // Tap anywhere on the map to reposition pin
        map.on('click', function(e) {
          if (hazardMarker) {
            hazardMarker.setLatLng(e.latlng);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'location_changed',
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            }));
          }
        });
      </script>
    </body>
    </html>
    `;
  }, [isDark]);

  // Handle messages dispatched from the Leaflet WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "location_changed") {
        setHazardLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    } catch (err) {
      console.warn("WebView message parse failed:", err);
    }
  };

  // Push coordinates payload into the WebView once loaded
  const initializeWebViewMap = () => {
    if (webViewRef.current && userLocation && hazardLocation) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "init",
          userLocation,
          hazardLocation,
        })
      );
    }
  };

  // Floating map control functions
  const toggleMapMode = () => {
    const nextMode = mapMode === "standard" ? "satellite" : "standard";
    setMapMode(nextMode);
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "toggle_map_mode",
          mode: nextMode,
        })
      );
    }
  };

  const handleZoomIn = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: "zoom_in" }));
    }
  };

  const handleZoomOut = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: "zoom_out" }));
    }
  };

  const handleRecenter = () => {
    if (webViewRef.current && userLocation) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "recenter",
          userLocation,
        })
      );
    }
  };

  // Navigates back to report view compiling both locations
  const handleConfirmLocation = () => {
    if (!userLocation || !hazardLocation) return;

    router.replace({
      pathname: "/(tabs)/report",
      params: {
        photoUrl: params.photoUrl || "",
        preTitle: params.preTitle || "",
        preDesc: params.preDesc || "",
        preCategory: params.preCategory || "other",
        preSeverity: params.preSeverity || "medium",
        reporterLat: userLocation.latitude.toString(),
        reporterLng: userLocation.longitude.toString(),
        hazardLat: hazardLocation.latitude.toString(),
        hazardLng: hazardLocation.longitude.toString(),
        reporterAddress,
        hazardAddress,
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      {/* Instructional Top Header */}
      <View className="px-6 py-4 border-b border-border/40 bg-card/30 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 pr-3">
          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/report",
                params: {
                  photoUrl: params.photoUrl || "",
                  preTitle: params.preTitle || "",
                  preDesc: params.preDesc || "",
                  preCategory: params.preCategory || "other",
                  preSeverity: params.preSeverity || "medium",
                },
              })
            }
            className="w-9 h-9 bg-muted/20 border border-border/30 rounded-xl justify-center items-center mr-3 active:bg-muted/30"
          >
            <ArrowLeft size={16} color="hsl(var(--foreground))" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-foreground text-sm font-black tracking-tight select-none">
              Precise Pin Placement
            </Text>
            <Text className="text-muted-foreground text-[10px] font-semibold select-none leading-relaxed">
              Move the pin to the exact location of the hazard.
            </Text>
          </View>
        </View>
      </View>

      {/* Map view section */}
      <View className="flex-1 relative bg-muted/10">
        {isLoadingLocation ? (
          <View className="absolute inset-0 justify-center items-center z-10 bg-background/50">
            <ActivityIndicator size="large" color="hsl(var(--primary))" />
            <Text className="text-muted-foreground text-xs mt-3 font-semibold select-none">
              Resolving GPS Position...
            </Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html: leafletHTML }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={{ flex: 1 }}
            onLoadEnd={initializeWebViewMap}
            onMessage={handleWebViewMessage}
          />
        )}

        {/* Map control widgets */}
        {!isLoadingLocation && (
          <View className="absolute top-4 right-4 flex-col gap-2.5 z-20">
            {/* Map Mode Toggle */}
            <Pressable
              onPress={toggleMapMode}
              className="w-10 h-10 rounded-full bg-card border border-border/40 justify-center items-center active:bg-muted/20 shadow-md shadow-black/10"
            >
              <Layers size={15} color="hsl(var(--foreground))" />
            </Pressable>

            {/* Recenter */}
            <Pressable
              onPress={handleRecenter}
              className="w-10 h-10 rounded-full bg-card border border-border/40 justify-center items-center active:bg-muted/20 shadow-md shadow-black/10"
            >
              <Compass size={15} color="hsl(var(--primary))" />
            </Pressable>

            {/* Zoom In */}
            <Pressable
              onPress={handleZoomIn}
              className="w-10 h-10 rounded-full bg-card border border-border/40 justify-center items-center active:bg-muted/20 shadow-md shadow-black/10"
            >
              <ZoomIn size={15} color="hsl(var(--foreground))" />
            </Pressable>

            {/* Zoom Out */}
            <Pressable
              onPress={handleZoomOut}
              className="w-10 h-10 rounded-full bg-card border border-border/40 justify-center items-center active:bg-muted/20 shadow-md shadow-black/10"
            >
              <ZoomOut size={15} color="hsl(var(--foreground))" />
            </Pressable>
          </View>
        )}
      </View>

      {/* Confirmation Bottom Card */}
      {!isLoadingLocation && (
        <View className="px-6 py-5 bg-background border-t border-border/30">
          <Card className="p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <Brain size={14} color="hsl(var(--primary))" className="mr-2" />
              <Text className="text-foreground text-xs font-black select-none">
                Summary: {params.preCategory ? params.preCategory.toUpperCase() : "HAZARD"}
              </Text>
            </View>

            <View className="gap-2.5 mb-1.5">
              <View className="flex-row items-start">
                <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 mr-2" />
                <View className="flex-1">
                  <Text className="text-muted-foreground text-[9px] font-black uppercase tracking-wider select-none">
                    Reporter Location
                  </Text>
                  <Text className="text-foreground text-[11px] font-semibold select-text mt-0.5 leading-relaxed" numberOfLines={1}>
                    {reporterAddress}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start">
                <View className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 mr-2" />
                <View className="flex-1">
                  <Text className="text-muted-foreground text-[9px] font-black uppercase tracking-wider select-none">
                    Hazard Location (Draggable Pin)
                  </Text>
                  <Text className="text-foreground text-[11px] font-black select-text mt-0.5 leading-relaxed" numberOfLines={1}>
                    {hazardAddress}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          <Button
            label="Confirm Location"
            variant="primary"
            className="w-full py-3.5"
            onPress={handleConfirmLocation}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
