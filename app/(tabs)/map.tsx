import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useHazards } from "../../src/features/hazards/hooks/useHazards";
import { useTheme } from "../../src/components/ThemeProvider";
import { supabase } from "../../src/api/supabase";
import { MapPin, Flame, Droplets, Construction, CloudLightning, Layers, Navigation } from "lucide-react-native";
import { HazardCategory } from "../../src/features/hazards/types";


export default function MapScreen() {
  const { data: hazards, isLoading, refetch } = useHazards();
  const { colorScheme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const isDark = colorScheme === "dark";

  const [selectedCategory, setSelectedCategory] = useState<HazardCategory | "all">("all");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSafeRoute, setShowSafeRoute] = useState(false);

  // Subscribe to Supabase Realtime channel for live hazard changes
  useEffect(() => {
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hazards" },
        (payload) => {
          console.log("[MapRealtime] Database change detected:", payload);
          refetch(); // Refetch query data, triggering webview update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Filter markers based on selected category (memoized to optimize render lists)
  const filteredHazards = useMemo(() => {
    return hazards?.filter((h) => {
      if (selectedCategory === "all") return true;
      return h.category === selectedCategory;
    }) || [];
  }, [hazards, selectedCategory]);

  // Post messages to Leaflet WebView to refresh markers, heatmaps, or route lines
  useEffect(() => {
    if (webViewRef.current && !isLoading) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "update_hazards",
          hazards: filteredHazards,
        })
      );
    }
  }, [filteredHazards, isLoading]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "toggle_heatmap",
          show: showHeatmap,
        })
      );
    }
  }, [showHeatmap]);

  // Calculate route avoiding high-severity hazard markers (memoized)
  const getSafeRoutePoints = useCallback(() => {
    // Standard direct route coordinates (e.g. San Francisco Mission to Financial District)
    const baseRoute = [
      [37.7599, -122.4368], // Start: Mission
      [37.7710, -122.4280], // Midpoint 1
      [37.7810, -122.4200], // Midpoint 2
      [37.7949, -122.4117], // End: Financial District
    ];

    // If there are critical/high roadblocks or fires nearby, recalculate points to bend around them
    const activeThreats = hazards?.filter(
      (h) => (h.severity === "high" || h.severity === "critical") && h.status === "active"
    ) || [];

    return baseRoute.map((pt) => {
      let lat = pt[0];
      let lng = pt[1];
      
      activeThreats.forEach((threat) => {
        // Simple distance checking
        const dist = Math.sqrt(
          Math.pow(lat - threat.location_lat, 2) + Math.pow(lng - threat.location_lng, 2)
        );
        // If threat is too close to route node, offset longitude westward/eastward
        if (dist < 0.008) {
          lng -= 0.012; // detour around hazard
          lat += 0.002;
        }
      });
      
      return [lat, lng];
    });
  }, [hazards]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(
        JSON.stringify({
          type: "toggle_route",
          show: showSafeRoute,
          routePoints: showSafeRoute ? getSafeRoutePoints() : null,
        })
      );
    }
  }, [showSafeRoute, getSafeRoutePoints]);

  const categories: { value: HazardCategory | "all"; label: string; icon: any }[] = [
    { value: "all", label: "All", icon: MapPin },
    { value: "fire", label: "Fire", icon: Flame },
    { value: "flood", label: "Flood", icon: Droplets },
    { value: "roadblock", label: "Block", icon: Construction },
    { value: "weather", label: "Weather", icon: CloudLightning },
  ];

  // High-fidelity Leaflet map script tailored to active color scheme
  const leafletHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
      body { padding: 0; margin: 0; background-color: ${isDark ? "#09090b" : "#ffffff"}; }
      html, body, #map { height: 100%; width: 100vw; }
      .leaflet-popup-content-wrapper {
        background: ${isDark ? "#18181b" : "#ffffff"}; 
        color: ${isDark ? "#ffffff" : "#000000"}; 
        border-radius: 16px; 
        border: 1px solid ${isDark ? "#27272a" : "#e4e4e7"};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      }
      .leaflet-popup-tip { background: ${isDark ? "#18181b" : "#ffffff"}; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const map = L.map('map', { zoomControl: false }).setView([37.7749, -122.4194], 13);
      
      const tileUrl = '${
        isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      }';
      
      L.tileLayer(tileUrl, {
        attribution: '&copy; CartoDB'
      }).addTo(map);

      let markersLayer = L.layerGroup().addTo(map);
      let heatmapLayer = L.layerGroup();
      let routeLayer = L.layerGroup();

      function getSeverityColor(sev) {
        if (sev === 'critical') return '#a855f7'; 
        if (sev === 'high') return '#ef4444'; 
        if (sev === 'medium') return '#f59e0b'; 
        return '#22c55e'; 
      }

      window.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'update_hazards') {
          markersLayer.clearLayers();
          heatmapLayer.clearLayers();
          
          data.hazards.forEach((h) => {
            // Draw marker
            const marker = L.circleMarker([h.location_lat, h.location_lng], {
              radius: 9,
              fillColor: getSeverityColor(h.severity),
              color: '${isDark ? "#09090b" : "#ffffff"}',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.85
            });

            marker.bindPopup(\`
              <div style="font-size:12px;padding:4px;">
                <strong style="display:block;margin-bottom:3px;font-size:13px;">\${h.title}</strong>
                <span style="color:\${getSeverityColor(h.severity)};text-transform:uppercase;font-size:9px;font-weight:900;letter-spacing:1px;">\${h.severity} • \${h.category}</span>
                <p style="margin:8px 0 0 0;line-height:1.4;color:${
                  isDark ? "#a1a1aa" : "#4b5563"
                }">\${h.description}</p>
              </div>
            \`);
            markersLayer.addLayer(marker);

            // Draw heatmap node circles
            const heatmapNode = L.circle([h.location_lat, h.location_lng], {
              radius: 250,
              fillColor: getSeverityColor(h.severity),
              color: 'transparent',
              fillOpacity: 0.16
            });
            heatmapLayer.addLayer(heatmapNode);
          });
        }

        if (data.type === 'toggle_heatmap') {
          if (data.show) {
            map.addLayer(heatmapLayer);
          } else {
            map.removeLayer(heatmapLayer);
          }
        }

        if (data.type === 'toggle_route') {
          routeLayer.clearLayers();
          if (data.show && data.routePoints) {
            const polyline = L.polyline(data.routePoints, {
              color: 'hsl(263.4, 80%, 60%)', 
              weight: 5,
              opacity: 0.85,
              dashArray: '6, 8'
            });
            routeLayer.addLayer(polyline);
            map.addLayer(routeLayer);
            map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          } else {
            map.removeLayer(routeLayer);
          }
        }
      });
    </script>
  </body>
  </html>
  `;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {/* Category Scroll filters */}
      <View className="py-3 bg-card border-b border-border/40 flex-row">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24 }}
        >
          {categories.map((opt) => {
            const isSelected = selectedCategory === opt.value;
            const IconComp = opt.icon;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSelectedCategory(opt.value)}
                className={`mr-2.5 px-4 py-2 rounded-full border flex-row items-center ${
                  isSelected ? "bg-primary border-primary" : "bg-card/50 border-border/40"
                }`}
              >
                <IconComp
                  size={12}
                  color={isSelected ? "#ffffff" : "hsl(var(--muted-foreground))"}
                  className="mr-1.5"
                />
                <Text
                  className={`text-xs font-semibold capitalize ${
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Map Content Viewport */}
      <View className="flex-1 relative">
        {isLoading ? (
          <View className="absolute inset-0 justify-center items-center bg-background/50 z-10">
            <ActivityIndicator size="large" color="hsl(var(--primary))" />
          </View>
        ) : null}

        {/* High-Fidelity WebView Leaflet map (Free, no credit card / tokens required) */}
        <WebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: leafletHTML }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ flex: 1 }}
          onLoadEnd={() => {
            // Push initial hazard list when webview load finishes
            if (webViewRef.current) {
              webViewRef.current.postMessage(
                JSON.stringify({
                  type: "update_hazards",
                  hazards: filteredHazards,
                })
              );
            }
          }}
        />

        {/* Floating Map Actions Panel */}
        <View className="absolute bottom-6 left-6 right-6 flex-row justify-between">
          {/* Heatmap Layer toggle */}
          <Pressable
            onPress={() => setShowHeatmap(!showHeatmap)}
            className={`w-[47%] py-3.5 rounded-2xl border flex-row items-center justify-center shadow-lg shadow-black/10 ${
              showHeatmap
                ? "bg-primary border-primary"
                : "bg-card border-border/45 active:bg-muted/10"
            }`}
          >
            <Layers size={14} color={showHeatmap ? "#ffffff" : "hsl(var(--primary))"} className="mr-2" />
            <Text
              className={`text-xs font-bold ${
                showHeatmap ? "text-white" : "text-foreground"
              }`}
            >
              Heatmap {showHeatmap ? "On" : "Off"}
            </Text>
          </Pressable>

          {/* Route safety overlay toggle */}
          <Pressable
            onPress={() => setShowSafeRoute(!showSafeRoute)}
            className={`w-[47%] py-3.5 rounded-2xl border flex-row items-center justify-center shadow-lg shadow-black/10 ${
              showSafeRoute
                ? "bg-primary border-primary"
                : "bg-card border-border/45 active:bg-muted/10"
            }`}
          >
            <Navigation size={14} color={showSafeRoute ? "#ffffff" : "hsl(var(--primary))"} className="mr-2" />
            <Text
              className={`text-xs font-bold ${
                showSafeRoute ? "text-white" : "text-foreground"
              }`}
            >
              Safe Route {showSafeRoute ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
