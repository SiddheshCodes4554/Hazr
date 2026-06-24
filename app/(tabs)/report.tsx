import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useCreateHazard } from "../../src/features/hazards/hooks/useCreateHazard";
import { Button } from "../../src/components/Button";
import { Input } from "../../src/components/Input";
import { Card } from "../../src/components/Card";
import {
  Flame,
  Droplets,
  Car,
  Construction,
  CloudLightning,
  AlertTriangle,
  Camera,
  X,
  MapPin,
} from "lucide-react-native";
import { HazardCategory, HazardSeverity } from "../../src/features/hazards/types";

// Category options
const CATEGORIES: { value: HazardCategory; label: string; icon: any }[] = [
  { value: "fire", label: "Fire / Smoke", icon: Flame },
  { value: "flood", label: "Flooding", icon: Droplets },
  { value: "accident", label: "Accident", icon: Car },
  { value: "roadblock", label: "Roadblock", icon: Construction },
  { value: "weather", label: "Weather", icon: CloudLightning },
  { value: "other", label: "Other Hazard", icon: AlertTriangle },
];

const SEVERITIES: { value: HazardSeverity; label: string; color: string; activeColor: string }[] = [
  { value: "low", label: "Low", color: "border-green-500/35 text-green-600 dark:text-green-400 bg-green-500/5", activeColor: "bg-green-500 border-green-500 text-white" },
  { value: "medium", label: "Medium", color: "border-amber-500/35 text-amber-600 dark:text-amber-400 bg-amber-500/5", activeColor: "bg-amber-500 border-amber-500 text-white" },
  { value: "high", label: "High", color: "border-red-500/35 text-red-600 dark:text-red-400 bg-red-500/5", activeColor: "bg-red-500 border-red-500 text-white" },
  { value: "critical", label: "Critical", color: "border-purple-500/35 text-purple-600 dark:text-purple-400 bg-purple-500/5", activeColor: "bg-purple-500 border-purple-500 text-white" },
];

export default function ReportScreen() {
  const createHazard = useCreateHazard();
  
  // Read query parameters passed from camera detection workflows or select-location
  const params = useLocalSearchParams<{
    photoUrl?: string;
    preTitle?: string;
    preDesc?: string;
    preCategory?: HazardCategory;
    preSeverity?: HazardSeverity;
    reporterLat?: string;
    reporterLng?: string;
    hazardLat?: string;
    hazardLng?: string;
    reporterAddress?: string;
    hazardAddress?: string;
  }>();

  const [title, setTitle] = useState(() => params.preTitle || "");
  const [description, setDescription] = useState(() => params.preDesc || "");
  const [category, setCategory] = useState<HazardCategory>(() => params.preCategory || "other");
  const [severity, setSeverity] = useState<HazardSeverity>(() => params.preSeverity || "medium");
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(() => params.photoUrl || null);

  // States to hold precise location data
  const [reporterLat, setReporterLat] = useState<number | null>(() => params.reporterLat ? parseFloat(params.reporterLat) : null);
  const [reporterLng, setReporterLng] = useState<number | null>(() => params.reporterLng ? parseFloat(params.reporterLng) : null);
  const [hazardLat, setHazardLat] = useState<number | null>(() => params.hazardLat ? parseFloat(params.hazardLat) : null);
  const [hazardLng, setHazardLng] = useState<number | null>(() => params.hazardLng ? parseFloat(params.hazardLng) : null);
  const [reporterAddress, setReporterAddress] = useState<string | null>(() => params.reporterAddress || null);
  const [hazardAddress, setHazardAddress] = useState<string | null>(() => params.hazardAddress || null);

  const handleSelectLocation = () => {
    router.replace({
      pathname: "/select-location",
      params: {
        photoUrl: attachedPhoto || "",
        preTitle: title,
        preDesc: description,
        preCategory: category,
        preSeverity: severity,
      },
    });
  };

  const handleSubmit = async () => {
    if (!title || !description) {
      Alert.alert("Input Required", "Please enter a title and description for the report.");
      return;
    }

    if (!hazardLat || !hazardLng) {
      Alert.alert(
        "Location Required",
        "Please select the precise hazard location on the map first.",
        [
          { text: "Select Location", onPress: handleSelectLocation },
          { text: "Cancel", style: "cancel" }
        ]
      );
      return;
    }

    try {
      const result: any = await createHazard.mutateAsync({
        title,
        description,
        category,
        severity,
        location_lat: hazardLat,
        location_lng: hazardLng,
        reporter_lat: reporterLat !== null ? reporterLat : undefined,
        reporter_lng: reporterLng !== null ? reporterLng : undefined,
        reporter_address: reporterAddress || undefined,
        hazard_address: hazardAddress || undefined,
        photo_url: attachedPhoto || undefined,
      });

      if (result._queued) {
        Alert.alert(
          "Report Saved Offline",
          "You are currently offline. Your report has been saved locally and will automatically upload when network connectivity is restored.",
          [{ text: "OK", onPress: navigateBack }]
        );
      } else {
        Alert.alert("Report Submitted", "Your incident report has been posted successfully.", [
          { text: "OK", onPress: navigateBack },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Submission Failed", error?.message || "Could not publish hazard report.");
    }
  };

  const navigateBack = () => {
    setTitle("");
    setDescription("");
    setCategory("other");
    setSeverity("medium");
    setAttachedPhoto(null);
    setReporterLat(null);
    setReporterLng(null);
    setHazardLat(null);
    setHazardLng(null);
    setReporterAddress(null);
    setHazardAddress(null);
    
    router.push("/(tabs)");
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          {/* Header */}
          <View className="mb-6">
            <Text className="text-foreground text-2xl font-black tracking-tight select-none">Report Hazard</Text>
            <Text className="text-muted-foreground text-xs font-semibold select-none">
              Report an incident to update regional awareness maps
            </Text>
          </View>

          {/* AI Scan Trigger Button */}
          <Pressable
            onPress={() => router.replace("/camera")}
            className="w-full flex-row justify-center items-center py-4 border-2 border-dashed border-primary/40 rounded-2xl bg-primary/5 mb-5 active:opacity-75"
          >
            <Camera size={18} color="hsl(var(--primary))" className="mr-2" />
            <Text className="text-primary font-bold text-sm select-none">
              Detect Hazard with Camera AI
            </Text>
          </Pressable>

          {/* Form container */}
          <Card className="w-full mb-6">
            {/* Attached Photo Preview */}
            {attachedPhoto && (
              <View className="mb-5 relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border/40 bg-zinc-950">
                <Image
                  source={{ uri: attachedPhoto }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setAttachedPhoto(null)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 justify-center items-center active:opacity-80"
                >
                  <X size={14} color="#ffffff" />
                </Pressable>
              </View>
            )}

            {/* Title */}
            <Input
              label="Incident Title"
              placeholder="e.g. Road flooded near freeway entrance"
              value={title}
              onChangeText={setTitle}
            />

            {/* Description */}
            <Input
              label="Details / Description"
              placeholder="Provide a brief description of the incident..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              inputClassName="h-24 pt-2.5"
            />

            {/* Category Grid Selector */}
            <Text className="text-foreground/75 text-xs font-semibold mb-2 ml-1 select-none">
              Select Category
            </Text>
            <View className="flex-row flex-wrap justify-between mb-5">
              {CATEGORIES.map((item) => {
                const isSelected = category === item.value;
                const IconComponent = item.icon;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setCategory(item.value)}
                    className={`w-[48%] mb-2.5 p-3.5 border rounded-xl items-center flex-row ${
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-card/45 border-border/30"
                    }`}
                  >
                    <View className="w-8 h-8 rounded-lg bg-muted justify-center items-center mr-2 border border-border/30">
                      <IconComponent
                        size={16}
                        color={isSelected ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                      />
                    </View>
                    <Text
                      className={`text-xs font-bold ${
                        isSelected ? "text-primary font-bold" : "text-foreground/80"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Severity Segmented Selector */}
            <Text className="text-foreground/75 text-xs font-semibold mb-2 ml-1 select-none">
              Incident Severity
            </Text>
            <View className="flex-row justify-between mb-6">
              {SEVERITIES.map((item) => {
                const isSelected = severity === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setSeverity(item.value)}
                    className={`flex-1 py-3.5 border rounded-xl mx-0.5 items-center justify-center ${
                      isSelected ? item.activeColor : item.color
                    }`}
                  >
                    <Text className="text-xs font-bold">{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Location Selector / Status Card */}
            <Text className="text-foreground/75 text-xs font-semibold mb-2 ml-1 select-none">
              Location Details
            </Text>
            {hazardLat !== null && hazardLng !== null ? (
              <Pressable
                onPress={handleSelectLocation}
                className="p-4 mb-5 border border-primary/20 bg-primary/5 rounded-xl flex-col active:bg-primary/10"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-primary text-[10px] font-bold uppercase tracking-wider">
                    Precise Location Placed
                  </Text>
                  <Text className="text-xs text-primary font-bold">Edit Map Pin</Text>
                </View>
                
                <View className="gap-2">
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                    <View className="flex-1">
                      <Text className="text-muted-foreground text-[9px] font-bold uppercase">Reporter GPS</Text>
                      <Text className="text-foreground text-[11px] font-medium" numberOfLines={1}>
                        {reporterAddress || `${reporterLat?.toFixed(5)}, ${reporterLng?.toFixed(5)}`}
                      </Text>
                    </View>
                  </View>
                  
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                    <View className="flex-1">
                      <Text className="text-muted-foreground text-[9px] font-bold uppercase">Hazard Location</Text>
                      <Text className="text-foreground text-[11px] font-bold" numberOfLines={1}>
                        {hazardAddress || `${hazardLat?.toFixed(5)}, ${hazardLng?.toFixed(5)}`}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSelectLocation}
                className="p-4 mb-5 border border-dashed border-red-500/40 bg-red-500/5 rounded-xl flex-row items-center justify-between active:bg-red-500/10"
              >
                <View className="flex-row items-center flex-1 pr-2">
                  <MapPin size={16} color="hsl(var(--destructive))" className="mr-2" />
                  <View className="flex-1">
                    <Text className="text-foreground text-xs font-bold">Hazard location not set</Text>
                    <Text className="text-muted-foreground text-[10px] font-medium leading-relaxed">
                      Tap to place a precise pin on the map.
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-primary font-bold">Select Pin</Text>
              </Pressable>
            )}

            <Button
              label="Publish Report"
              variant="primary"
              loading={createHazard.isPending}
              onPress={handleSubmit}
              className="w-full mt-2"
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
