import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePredictions } from "../../src/features/predictions/hooks/usePredictions";
import { Card, CardContent, CardHeader } from "../../src/components/Card";
import {
  CloudRain,
  Thermometer,
  Wind,
  Sun,
  Cloud,
  CloudLightning,
  AlertTriangle,
  MapPin,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";

interface LocationOption {
  name: string;
  lat: number;
  lng: number;
}

const SF_NEIGHBORHOODS: LocationOption[] = [
  { name: "SOMA / Civic Center", lat: 37.7749, lng: -122.4194 },
  { name: "Mission District", lat: 37.7599, lng: -122.4368 },
  { name: "Financial District / Tenderloin", lat: 37.7833, lng: -122.4167 },
  { name: "Richmond District / Presidio", lat: 37.7699, lng: -122.4468 },
];

export default function PredictionsScreen() {
  const [selectedLoc, setSelectedLoc] = useState<LocationOption>(SF_NEIGHBORHOODS[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedRisk, setExpandedRisk] = useState<string | null>("flood");

  const { prediction, isLoading, refetch, isRefetching } = usePredictions(
    selectedLoc.lat,
    selectedLoc.lng
  );

  const getWeatherIcon = (code: number) => {
    if (code >= 95) return <CloudLightning size={20} color="#a855f7" />;
    if (code >= 51 || code === 80 || code === 81 || code === 82) {
      return <CloudRain size={20} color="#06b6d4" />;
    }
    if (code >= 1 && code <= 3) return <Cloud size={20} color="hsl(var(--muted-foreground))" />;
    return <Sun size={20} color="#f59e0b" />;
  };

  const getWeatherLabel = (code: number) => {
    if (code >= 95) return "Thunderstorm";
    if (code >= 80) return "Rain Showers";
    if (code >= 61 && code <= 65) return "Heavy Rain";
    if (code >= 51 && code <= 57) return "Drizzle";
    if (code >= 1 && code <= 3) return "Partly Cloudy";
    return "Clear Sky";
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return "text-red-500 bg-red-500/10 border-red-500/20";
    if (prob >= 35) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-green-500 bg-green-500/10 border-green-500/20";
  };

  const getProgressBgColor = (prob: number) => {
    if (prob >= 70) return "bg-red-500";
    if (prob >= 35) return "bg-amber-500";
    return "bg-green-500";
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="px-6 py-4 border-b border-border/40 bg-card/30 flex-row justify-between items-center z-20">
        <View>
          <Text className="text-foreground text-2xl font-black tracking-tight select-none">
            Risk Forecast
          </Text>
          <Text className="text-muted-foreground text-xs font-semibold select-none">
            Predictive community hazard index
          </Text>
        </View>

        <Pressable
          onPress={() => refetch()}
          disabled={isLoading}
          className="w-10 h-10 bg-muted/20 border border-border/30 rounded-xl justify-center items-center active:bg-muted/30"
        >
          <RefreshCw
            size={14}
            color="hsl(var(--foreground))"
            className={isRefetching ? "animate-spin" : ""}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="hsl(var(--primary))"
          />
        }
      >
        {/* Neighborhood Selector */}
        <View className="mb-6 relative z-30">
          <Text className="text-foreground/75 text-xs font-bold mb-2 ml-1 select-none">
            Select Target Sector
          </Text>

          <Pressable
            onPress={() => setShowDropdown(!showDropdown)}
            className="flex-row items-center justify-between px-4 py-3.5 bg-card border border-border/40 rounded-2xl active:bg-muted/10 shadow-sm"
          >
            <View className="flex-row items-center">
              <MapPin size={15} color="hsl(var(--primary))" className="mr-2.5" />
              <Text className="text-foreground font-bold text-sm select-none">
                {selectedLoc.name}
              </Text>
            </View>
            <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
          </Pressable>

          {showDropdown && (
            <View className="absolute top-16 left-0 right-0 bg-card border border-border/45 rounded-2xl shadow-xl z-50 overflow-hidden">
              {SF_NEIGHBORHOODS.map((loc) => (
                <Pressable
                  key={loc.name}
                  onPress={() => {
                    setSelectedLoc(loc);
                    setShowDropdown(false);
                  }}
                  className={`px-4 py-3.5 border-b border-border/10 flex-row items-center active:bg-muted/20 ${
                    selectedLoc.name === loc.name ? "bg-primary/5" : ""
                  }`}
                >
                  <MapPin
                    size={13}
                    color={selectedLoc.name === loc.name ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                    className="mr-2"
                  />
                  <Text
                    className={`text-xs ${
                      selectedLoc.name === loc.name ? "text-primary font-bold" : "text-foreground"
                    }`}
                  >
                    {loc.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {isLoading ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="hsl(var(--primary))" />
            <Text className="text-muted-foreground text-xs mt-3 select-none">
              Calculating probability scores...
            </Text>
          </View>
        ) : prediction ? (
          <View className="gap-5">
            {/* Weather Metric Card */}
            <Card>
              <CardHeader className="pb-3 border-b border-border/15 flex-row justify-between items-center">
                <View className="flex-row items-center">
                  {getWeatherIcon(prediction.weather.weatherCode)}
                  <Text className="text-foreground font-black text-xs ml-2 select-none">
                    Weather API Forecast (Open-Meteo)
                  </Text>
                </View>
                <View className="bg-primary/5 border border-primary/25 px-2 py-0.5 rounded">
                  <Text className="text-primary text-[9px] font-black uppercase tracking-wider select-none">
                    {getWeatherLabel(prediction.weather.weatherCode)}
                  </Text>
                </View>
              </CardHeader>
              <CardContent className="pt-4 flex-row justify-between items-center">
                <View className="items-center flex-1">
                  <Thermometer size={16} color="hsl(var(--muted-foreground))" className="mb-1" />
                  <Text className="text-foreground text-xs font-black select-none">
                    {prediction.weather.temperature}°C
                  </Text>
                  <Text className="text-muted-foreground text-[9px] mt-0.5 select-none">Temp</Text>
                </View>

                <View className="w-[1px] h-8 bg-border/20" />

                <View className="items-center flex-1">
                  <CloudRain size={16} color="hsl(var(--muted-foreground))" className="mb-1" />
                  <Text className="text-foreground text-xs font-black select-none">
                    {prediction.weather.precipitation24h} mm
                  </Text>
                  <Text className="text-muted-foreground text-[9px] mt-0.5 select-none">Rain 24h</Text>
                </View>

                <View className="w-[1px] h-8 bg-border/20" />

                <View className="items-center flex-1">
                  <Wind size={16} color="hsl(var(--muted-foreground))" className="mb-1" />
                  <Text className="text-foreground text-xs font-black select-none">
                    {Math.round(prediction.weather.windSpeed)} km/h
                  </Text>
                  <Text className="text-muted-foreground text-[9px] mt-0.5 select-none">Wind Speed</Text>
                </View>
              </CardContent>
            </Card>

            {/* Prediction Dials List */}
            <Text className="text-foreground/75 text-xs font-bold ml-1 select-none">
              Calculated Probability Indexes
            </Text>

            {([prediction.floodRisk, prediction.roadDamageRisk, prediction.hazardGrowthRisk] as const).map(
              (risk) => {
                const key = risk === prediction.floodRisk ? "flood" : risk === prediction.roadDamageRisk ? "road" : "growth";
                const isExpanded = expandedRisk === key;

                return (
                  <Card key={key} className="overflow-hidden">
                    <Pressable
                      onPress={() => setExpandedRisk(isExpanded ? null : key)}
                      className="p-4 active:bg-muted/5 flex-row justify-between items-center"
                    >
                      <View className="flex-1 pr-4">
                        <Text className="text-foreground font-black text-sm select-none">{risk.title}</Text>
                        
                        {/* Progress slider bar */}
                        <View className="flex-row items-center mt-2.5">
                          <View className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden mr-3">
                            <View
                              style={{ width: `${risk.probability}%` }}
                              className={`h-full ${getProgressBgColor(risk.probability)}`}
                            />
                          </View>
                          <View className={`px-2 py-0.5 border rounded-md ${getProbabilityColor(risk.probability)}`}>
                            <Text className="text-[10px] font-black">{risk.probability}%</Text>
                          </View>
                        </View>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={14} color="hsl(var(--muted-foreground))" />
                      ) : (
                        <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
                      )}
                    </Pressable>

                    {isExpanded && (
                      <View className="px-4 pb-4 pt-1 bg-muted/5 border-t border-border/10">
                        <View className="flex-row items-center mb-2.5">
                          <AlertTriangle size={12} color="hsl(var(--primary))" className="mr-1.5" />
                          <Text className="text-foreground/80 font-bold text-[10px] uppercase tracking-wider select-none">
                            Explainable risk factors:
                          </Text>
                        </View>
                        {risk.explanations.map((exp, idx) => (
                          <Text
                            key={idx}
                            className="text-foreground/85 text-[11px] leading-relaxed mb-1.5 select-text"
                          >
                            • {exp}
                          </Text>
                        ))}
                      </View>
                    )}
                  </Card>
                );
              }
            )}
          </View>
        ) : (
          <View className="py-20 justify-center items-center">
            <AlertTriangle size={48} color="hsl(var(--destructive))" className="mb-4" />
            <Text className="text-foreground text-base font-bold select-none">
              Calculation Error
            </Text>
            <Text className="text-muted-foreground text-xs text-center mt-1 select-none">
              Unable to compute prediction scores at this coordinate.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
