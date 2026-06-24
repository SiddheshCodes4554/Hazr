import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import WebView from "react-native-webview";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../src/api/supabase";
import { useHazards } from "../../src/features/hazards/hooks/useHazards";
import { useResolveHazard } from "../../src/features/hazards/hooks/useResolveHazard";
import { useTheme } from "../../src/components/ThemeProvider";
import { Card } from "../../src/components/Card";
import {
  ArrowLeft,
  Flame,
  Droplets,
  Car,
  Construction,
  CloudLightning,
  AlertTriangle,
  Activity,
  CheckCircle,
  Trash2,
  TrendingUp,
} from "lucide-react-native";
import { HazardCategory, HazardSeverity, Hazard } from "../../src/features/hazards/types";

// Category Icons
const CategoryIcon = ({ category, color, size }: { category: string; color: string; size: number }) => {
  switch (category) {
    case "fire":
      return <Flame color={color} size={size} />;
    case "flood":
      return <Droplets color={color} size={size} />;
    case "accident":
      return <Car color={color} size={size} />;
    case "roadblock":
      return <Construction color={color} size={size} />;
    case "weather":
      return <CloudLightning color={color} size={size} />;
    default:
      return <AlertTriangle color={color} size={size} />;
  }
};

export default function AuthorityDashboard() {
  const queryClient = useQueryClient();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const { data: hazards = [], isLoading } = useHazards();
  const resolveHazardMutation = useResolveHazard();

  // Selected filters for analytics and tracker table
  const [filterCategory, setFilterCategory] = useState<HazardCategory | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<HazardSeverity | "all">("all");

  // Flag spam/delete report mutation
  const flagSpamMutation = useMutation({
    mutationFn: async (hazardId: string) => {
      const { error } = await supabase.from("hazards").delete().eq("id", hazardId);
      if (error) throw error;
      return hazardId;
    },
    onSuccess: (id) => {
      Alert.alert("Success", "Report has been flagged and removed from the watch board.");
      queryClient.setQueryData<Hazard[]>(["hazards"], (old = []) => old.filter((h) => h.id !== id));
      queryClient.invalidateQueries({ queryKey: ["hazards"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to remove report.");
    },
  });

  // Calculate stats based on hazards
  const stats = useMemo(() => {
    const total = hazards.length;
    const active = hazards.filter((h) => h.status === "active");
    const resolved = hazards.filter((h) => h.status === "resolved");
    const activeCount = active.length;
    
    const resolutionRate = total > 0 ? Math.round((resolved.length / total) * 100) : 0;
    
    // Average trust score of active hazards
    const avgTrust =
      activeCount > 0
        ? Math.round(
            active.reduce((sum, h) => sum + (h.trust_score !== undefined ? h.trust_score : 50), 0) /
              activeCount
          )
        : 50;

    return {
      activeCount,
      resolvedCount: resolved.length,
      resolutionRate,
      avgTrust,
    };
  }, [hazards]);

  // Filter list of hazards for the tracker table
  const filteredHazards = useMemo(() => {
    return hazards.filter((h) => {
      const categoryMatch = filterCategory === "all" || h.category === filterCategory;
      const severityMatch = filterSeverity === "all" || h.severity === filterSeverity;
      return categoryMatch && severityMatch;
    });
  }, [hazards, filterCategory, filterSeverity]);

  // Heatmap Leaflet HTML
  const heatmapHTML = useMemo(() => {
    const activeHazards = hazards.filter((h) => h.status === "active");
    
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([37.7749, -122.4194], 12);
        
        const tileUrl = '${
          isDark
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }';
        
        L.tileLayer(tileUrl).addTo(map);

        const data = ${JSON.stringify(activeHazards)};
        
        function getSeverityColor(sev) {
          if (sev === 'critical') return '#a855f7'; 
          if (sev === 'high') return '#ef4444'; 
          if (sev === 'medium') return '#f59e0b'; 
          return '#22c55e'; 
        }

        data.forEach(h => {
          // Heatmap nodes rendered as semi-transparent rings
          L.circle([h.location_lat, h.location_lng], {
            radius: 350,
            fillColor: getSeverityColor(h.severity),
            color: 'transparent',
            fillOpacity: 0.28
          }).addTo(map);

          // Center pin indicator
          L.circleMarker([h.location_lat, h.location_lng], {
            radius: 6,
            fillColor: getSeverityColor(h.severity),
            color: '${isDark ? "#09090b" : "#ffffff"}',
            weight: 1.5,
            fillOpacity: 1
          }).addTo(map);
        });
      </script>
    </body>
    </html>
    `;
  }, [hazards, isDark]);

  // Categories and severities filters
  const categoriesList: (HazardCategory | "all")[] = ["all", "fire", "flood", "accident", "roadblock", "weather"];
  const severitiesList: (HazardSeverity | "all")[] = ["all", "low", "medium", "high", "critical"];

  const getSeverityBadgeColor = (severity: HazardSeverity) => {
    switch (severity) {
      case "low":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "high":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "critical":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="px-6 py-4 border-b border-border/40 bg-card/30 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 bg-muted/20 border border-border/30 rounded-xl justify-center items-center mr-3 active:bg-muted/30"
          >
            <ArrowLeft size={16} color="hsl(var(--foreground))" />
          </Pressable>
          <View>
            <Text className="text-foreground text-lg font-black tracking-tight select-none">
              Operations Center
            </Text>
            <Text className="text-muted-foreground text-[10px] font-semibold select-none">
              Municipal Portal & Resolution Desk
            </Text>
          </View>
        </View>
        <View className="bg-green-500/10 border border-green-500/25 px-2.5 py-1 rounded-full flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
          <Text className="text-[9px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
            Live Link
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} className="flex-1">
        {/* Statistics Grid */}
        <View className="flex-row justify-between mb-6 gap-2">
          {/* Active Hazards */}
          <Card className="flex-1 p-3 flex-col justify-between">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-muted-foreground text-[9px] font-black uppercase tracking-wider select-none">
                Active
              </Text>
              <Activity size={12} color="hsl(var(--primary))" />
            </View>
            <Text className="text-foreground text-lg font-black select-none">{stats.activeCount}</Text>
          </Card>

          {/* Resolution Rate */}
          <Card className="flex-1 p-3 flex-col justify-between">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-muted-foreground text-[9px] font-black uppercase tracking-wider select-none">
                Resolved
              </Text>
              <CheckCircle size={12} color="#22c55e" />
            </View>
            <Text className="text-foreground text-lg font-black select-none">{stats.resolutionRate}%</Text>
          </Card>

          {/* Average Trust */}
          <Card className="flex-1 p-3 flex-col justify-between">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-muted-foreground text-[9px] font-black uppercase tracking-wider select-none">
                Trust Index
              </Text>
              <TrendingUp size={12} color="#06b6d4" />
            </View>
            <Text className="text-foreground text-lg font-black select-none">{stats.avgTrust}%</Text>
          </Card>
        </View>

        {/* Heatmap Section */}
        <Text className="text-foreground/75 text-xs font-bold mb-2.5 ml-1 select-none">
          City-wide Hazard Density Heatmap
        </Text>
        <Card className="mb-6 overflow-hidden h-[180px]">
          {isLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="small" color="hsl(var(--primary))" />
            </View>
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={{ html: heatmapHTML }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              style={{ flex: 1 }}
            />
          )}
        </Card>

        {/* CSS Trends Chart (Weekly Intake) */}
        <Text className="text-foreground/75 text-xs font-bold mb-2.5 ml-1 select-none">
          Incident Intake vs Resolution Trends
        </Text>
        <Card className="mb-6 p-4">
          {/* Custom View Bar Chart */}
          <View className="h-28 flex-row items-end justify-between border-b border-border/20 pb-1.5 gap-2">
            {[
              { day: "M", in: 12, res: 8 },
              { day: "T", in: 18, res: 15 },
              { day: "W", in: 24, res: 14 },
              { day: "T", in: 15, res: 18 },
              { day: "F", in: 28, res: 22 },
              { day: "S", in: 8, res: 12 },
              { day: "S", in: 4, res: 6 },
            ].map((d, idx) => {
              // Scale percentages for bars (max value 30)
              const inHeight = `${Math.min(100, (d.in / 30) * 100)}%`;
              const resHeight = `${Math.min(100, (d.res / 30) * 100)}%`;
              return (
                <View key={idx} className="items-center flex-1 h-full justify-end">
                  <View className="flex-row items-end gap-1 flex-1 justify-center w-full">
                    {/* Inflow bar */}
                    <View style={{ height: inHeight as any }} className="w-2 bg-primary rounded-t-sm" />
                    {/* Resolved bar */}
                    <View style={{ height: resHeight as any }} className="w-2 bg-green-500 rounded-t-sm" />
                  </View>
                  <Text className="text-muted-foreground text-[8px] font-black uppercase mt-1 select-none">
                    {d.day}
                  </Text>
                </View>
              );
            })}
          </View>
          <View className="flex-row justify-center mt-3 gap-5">
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-sm bg-primary mr-1.5" />
              <Text className="text-muted-foreground text-[9px] font-bold select-none">New Reports</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-sm bg-green-500 mr-1.5" />
              <Text className="text-muted-foreground text-[9px] font-bold select-none">Resolved Reports</Text>
            </View>
          </View>
        </Card>

        {/* Resolution Tracking Section */}
        <Text className="text-foreground/75 text-xs font-bold mb-2 ml-1 select-none">
          Active Resolution Watchboard ({filteredHazards.length})
        </Text>

        {/* Filter Pills */}
        <View className="mb-4">
          {/* Category Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
            className="mb-2"
          >
            {categoriesList.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setFilterCategory(cat)}
                className={`mr-2 px-3 py-1.5 rounded-full border ${
                  filterCategory === cat ? "bg-primary border-primary" : "bg-card border-border/30"
                }`}
              >
                <Text
                  className={`text-[9px] font-black uppercase tracking-wider ${
                    filterCategory === cat ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Severity Scroll */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 2 }}
          >
            {severitiesList.map((sev) => (
              <Pressable
                key={sev}
                onPress={() => setFilterSeverity(sev)}
                className={`mr-2 px-3 py-1 rounded-full border ${
                  filterSeverity === sev ? "bg-primary border-primary" : "bg-card border-border/30"
                }`}
              >
                <Text
                  className={`text-[9px] font-black uppercase tracking-wider ${
                    filterSeverity === sev ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {sev}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Resolution Tracker Table */}
        {filteredHazards.length > 0 ? (
          <View className="gap-3">
            {filteredHazards.map((item) => {
              const trust = item.trust_score !== undefined ? item.trust_score : 50;
              return (
                <Card key={item.id} className="p-4 border-border/30 bg-card">
                  <View className="flex-row justify-between items-start mb-2.5">
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-7 h-7 bg-muted/30 border border-border/20 rounded-lg justify-center items-center mr-2">
                        <CategoryIcon category={item.category} color="hsl(var(--primary))" size={14} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-xs font-black select-text" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text className="text-muted-foreground text-[9px] select-all mt-0.5" numberOfLines={1}>
                          {item.reported_by} • Trust: {trust}%
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-1 items-center">
                      <View className={`px-1.5 py-0.5 rounded border ${getSeverityBadgeColor(item.severity)}`}>
                        <Text className="text-[8px] font-black uppercase tracking-wider">
                          {item.severity}
                        </Text>
                      </View>
                      {item.status === "resolved" && (
                        <View className="bg-green-500/10 border border-green-500/25 px-1.5 py-0.5 rounded">
                          <Text className="text-[8px] text-green-600 dark:text-green-400 font-bold uppercase">
                            Done
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text className="text-foreground/80 text-[10.5px] leading-relaxed mb-3 select-text">
                    {item.description}
                  </Text>

                  {item.status !== "resolved" && (
                    <View className="flex-row border-t border-border/10 pt-3 gap-2">
                      <Pressable
                        onPress={() => resolveHazardMutation.mutate(item.id)}
                        disabled={resolveHazardMutation.isPending}
                        className="flex-1 bg-green-500 border border-green-500 py-2 rounded-xl justify-center items-center active:opacity-90 flex-row"
                      >
                        {resolveHazardMutation.isPending &&
                        resolveHazardMutation.variables === item.id ? (
                          <ActivityIndicator size="small" color="#ffffff" className="mr-1" />
                        ) : (
                          <CheckCircle size={11} color="#ffffff" className="mr-1.5" />
                        )}
                        <Text className="text-white text-[10px] font-black">Dispatch & Resolve</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => flagSpamMutation.mutate(item.id)}
                        disabled={flagSpamMutation.isPending}
                        className="w-10 bg-red-500/5 border border-red-500/15 py-2 rounded-xl justify-center items-center active:bg-red-500/10"
                      >
                        <Trash2 size={12} color="hsl(var(--destructive))" />
                      </Pressable>
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        ) : (
          <View className="py-12 justify-center items-center bg-card border border-border/30 rounded-2xl">
            <AlertTriangle size={32} color="hsl(var(--muted-foreground))" className="mb-2" />
            <Text className="text-foreground text-xs font-bold select-none">No active dispatches</Text>
            <Text className="text-muted-foreground text-[10px] text-center mt-0.5 select-none">
              All items in this severity/category are resolved.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
