import React, { useState, useRef } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useDetectHazards } from "../src/features/hazards/hooks/useDetectHazards";
import { Button } from "../src/components/Button";
import { Camera as CameraIcon, ShieldAlert, ArrowLeft, BrainCircuit } from "lucide-react-native";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const {
    compressImage,
    uploadPhoto,
    runDetection,
    getUnifiedReportData,
    isUploading,
    isDetecting,
    detections,
  } = useDetectHazards();

  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="hsl(var(--primary))" />
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center px-6">
        <View className="items-center max-w-sm">
          <ShieldAlert size={48} color="hsl(var(--destructive))" className="mb-4" />
          <Text className="text-foreground text-xl font-bold text-center mb-2">
            Camera Access Required
          </Text>
          <Text className="text-muted-foreground text-sm text-center mb-6 leading-relaxed">
            Hazr requires camera access to capture photographs and run object detection models to locate hazards.
          </Text>
          <Button
            label="Grant Permission"
            onPress={requestPermission}
            className="w-full"
          />
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        setStatusMessage("Capturing frame...");
        const options = { quality: 0.85, skipProcessing: false };
        const photo = await cameraRef.current.takePictureAsync(options);
        
        // Compress captured photo immediately to optimize storage / load performance
        const compressedUri = await compressImage(photo.uri);
        setCapturedPhoto(compressedUri);
      } catch (e) {
        Alert.alert("Capture Error", "Could not take photo from camera.");
        console.error(e);
      } finally {
        setStatusMessage("");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!capturedPhoto) return;

    try {
      // 1. Upload to Supabase Storage
      setStatusMessage("Uploading to Supabase...");
      const publicUrl = await uploadPhoto(capturedPhoto);

      // 2. Perform object detection
      setStatusMessage("Running hazard detection AI...");
      await runDetection(publicUrl);

      setAnalyzed(true);
    } catch (err: any) {
      Alert.alert("Analysis Failed", err?.message || "Could not analyze the photo.");
    } finally {
      setStatusMessage("");
    }
  };

  const handleAttachReport = () => {
    if (!capturedPhoto) return;

    // Resolve category and title pre-fills
    const { title, description, category, severity } = getUnifiedReportData(detections);

    // Navigate to select-location screen first to place precise pin coordinates
    router.replace({
      pathname: "/select-location",
      params: {
        photoUrl: capturedPhoto,
        preTitle: title,
        preDesc: description,
        preCategory: category,
        preSeverity: severity,
      },
    });
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setAnalyzed(false);
  };

  // Color mapping helpers for box rendering
  const getBoxStyle = (className: string) => {
    switch (className) {
      case "pothole":
        return { border: "border-amber-500", bg: "bg-amber-500/10", tag: "bg-amber-500" };
      case "manhole":
        return { border: "border-yellow-500", bg: "bg-yellow-500/10", tag: "bg-yellow-500" };
      case "garbage":
        return { border: "border-green-500", bg: "bg-green-500/10", tag: "bg-green-500" };
      case "flood":
        return { border: "border-blue-500", bg: "bg-blue-500/10", tag: "bg-blue-500" };
      case "fallen tree":
        return { border: "border-red-500", bg: "bg-red-500/10", tag: "bg-red-500" };
      case "construction hazard":
        return { border: "border-purple-500", bg: "bg-purple-500/10", tag: "bg-purple-500" };
      default:
        return { border: "border-primary", bg: "bg-primary/10", tag: "bg-primary" };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "bottom"]}>
      {/* Top back button */}
      <View className="absolute top-12 left-6 z-10">
        <Pressable
          onPress={() => router.replace("/(tabs)/report")}
          className="w-10 h-10 rounded-full bg-black/50 border border-white/20 justify-center items-center active:opacity-75"
        >
          <ArrowLeft size={18} color="#ffffff" />
        </Pressable>
      </View>

      {/* Main Viewport Container */}
      <View className="flex-1 justify-center px-4">
        {capturedPhoto ? (
          // Captured Image Viewer
          <View className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden bg-zinc-950 border border-white/10">
            <Image
              source={{ uri: capturedPhoto }}
              className="w-full h-full"
              resizeMode="cover"
            />
            
            {/* Render Bounding Boxes Overlay */}
            {analyzed &&
              detections.map((det) => {
                const colors = getBoxStyle(det.class);
                return (
                  <View
                    key={det.id}
                    style={{
                      position: "absolute",
                      left: `${det.bbox.x}%`,
                      top: `${det.bbox.y}%`,
                      width: `${det.bbox.width}%`,
                      height: `${det.bbox.height}%`,
                    }}
                    className={`border-2 rounded-xl flex-col ${colors.border} ${colors.bg}`}
                  >
                    <View className={`self-start px-2 py-0.5 rounded-br-lg ${colors.tag}`}>
                      <Text className="text-white text-[8px] font-black uppercase tracking-wider">
                        {det.class} ({(det.confidence * 100).toFixed(0)}%)
                      </Text>
                    </View>
                  </View>
                );
              })}

            {/* In-processing spinner overlay */}
            {(isUploading || isDetecting) && (
              <View className="absolute inset-0 bg-black/60 justify-center items-center px-6">
                <ActivityIndicator size="large" color="#ffffff" className="mb-4" />
                <Text className="text-white text-sm font-semibold text-center select-none">
                  {statusMessage}
                </Text>
              </View>
            )}
          </View>
        ) : (
          // Active Camera Viewport
          <View className="w-full aspect-[3/4] rounded-3xl overflow-hidden bg-zinc-950 border border-white/10">
            <CameraView
              ref={cameraRef}
              className="w-full h-full"
              facing="back"
              autofocus="on"
            />
          </View>
        )}
      </View>

      {/* Camera Action Drawer */}
      <View className="px-6 py-8 bg-zinc-950/90 border-t border-white/5">
        {capturedPhoto ? (
          // Capture action options
          <View className="flex-col">
            {analyzed ? (
              // Analyzed Detections Options
              <View className="items-center">
                <View className="flex-row items-center mb-5 bg-green-500/10 border border-green-500/25 px-4 py-2 rounded-2xl">
                  <BrainCircuit size={16} color="#22c55e" className="mr-2" />
                  <Text className="text-green-500 text-xs font-bold select-none">
                    Analysis Complete: Found {detections.length} hazard(s)
                  </Text>
                </View>
                
                <View className="flex-row w-full justify-between">
                  <Button
                    label="Retake Photo"
                    variant="outline"
                    className="w-[45%] border-white/15 text-white bg-zinc-900"
                    onPress={handleRetake}
                  />
                  <Button
                    label="Attach to Report"
                    variant="primary"
                    className="w-[45%]"
                    onPress={handleAttachReport}
                  />
                </View>
              </View>
            ) : (
              // Unanalyzed Photo Options
              <View className="flex-row justify-between w-full">
                <Button
                  label="Retake"
                  variant="outline"
                  className="w-[45%] border-white/15 text-white bg-zinc-900"
                  disabled={isUploading || isDetecting}
                  onPress={handleRetake}
                />
                <Button
                  label="Analyze Photo"
                  variant="primary"
                  className="w-[45%]"
                  disabled={isUploading || isDetecting}
                  onPress={handleAnalyze}
                />
              </View>
            )}
          </View>
        ) : (
          // Active Camera Shutter
          <View className="items-center justify-center">
            <Text className="text-zinc-500 text-xs mb-5 font-semibold select-none">
              Align the hazard in the viewport and press capture
            </Text>
            
            <Pressable
              onPress={handleCapture}
              className="w-18 h-18 rounded-full border-4 border-white justify-center items-center active:scale-95"
            >
              <View className="w-14 h-14 rounded-full bg-white justify-center items-center">
                <CameraIcon size={24} color="#000000" />
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
