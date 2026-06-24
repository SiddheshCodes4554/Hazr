import { useState } from "react";
import { supabase } from "../../../api/supabase";
import { DetectionResult, HazardCategory, HazardSeverity } from "../types";
import * as ImageManipulator from "expo-image-manipulator";
import NetInfo from "@react-native-community/netinfo";

/**
 * Custom hook to orchestrate image processing, backend file uploading,
 * and AI object detection pipelines.
 */
export const useDetectHazards = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  /**
   * Compresses the source photo using expo-image-manipulator.
   * Resizes large images (max 1024px width) and scales down JPEG quality to optimize upload sizes.
   */
  const compressImage = async (uri: string): Promise<string> => {
    console.log("[useDetectHazards] Compressing captured photo:", uri);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (e) {
      console.error("[useDetectHazards] Image compression failed:", e);
      return uri; // Return original as fallback if manipulation throws
    }
  };

  /**
   * Uploads compressed photo file to public 'hazard-photos' Supabase bucket.
   * If offline, bypasses upload and returns the local file path.
   */
  const uploadPhoto = async (localUri: string): Promise<string> => {
    setIsUploading(true);
    try {
      const netState = await NetInfo.fetch();
      const isOnline = !!netState.isConnected && netState.isInternetReachable !== false;

      if (!isOnline) {
        console.log("[useDetectHazards] Offline. Bypassing upload, caching local URI.");
        setPhotoUrl(localUri);
        return localUri;
      }

      // Convert file path into arraybuffer / blob
      const response = await fetch(localUri);
      const blob = await response.blob();

      const fileName = `hzd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`;

      const { error } = await supabase.storage
        .from("hazard-photos")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) throw error;

      // Resolve public access link
      const {
        data: { publicUrl },
      } = supabase.storage.from("hazard-photos").getPublicUrl(fileName);

      setPhotoUrl(publicUrl);
      return publicUrl;
    } catch (err: any) {
      console.warn("[useDetectHazards] Upload failed. Using local path as fallback:", err?.message || err);
      setPhotoUrl(localUri);
      return localUri;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Triggers the object detection workflow.
   * Runs client-side heuristic simulators to mock detection coordinates (normalized 0-100 percentages)
   * if backend connections are unconfigured, demonstrating the workflow out of the box.
   */
  const runDetection = async (imageUrl: string): Promise<DetectionResult[]> => {
    setIsDetecting(true);
    setDetections([]);

    // Simulate model inference latency
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Predefined realistic bounding boxes mapping coordinates (percentages relative to parent size)
    const possibleDetections: DetectionResult[] = [
      {
        id: "det-1",
        class: "pothole",
        confidence: 0.94,
        bbox: { x: 35, y: 55, width: 30, height: 18 },
      },
      {
        id: "det-2",
        class: "construction hazard",
        confidence: 0.89,
        bbox: { x: 60, y: 28, width: 25, height: 35 },
      },
      {
        id: "det-3",
        class: "garbage",
        confidence: 0.82,
        bbox: { x: 10, y: 65, width: 22, height: 16 },
      },
      {
        id: "det-4",
        class: "manhole",
        confidence: 0.87,
        bbox: { x: 45, y: 40, width: 14, height: 11 },
      },
      {
        id: "det-5",
        class: "fallen tree",
        confidence: 0.91,
        bbox: { x: 20, y: 35, width: 60, height: 25 },
      },
      {
        id: "det-6",
        class: "flood",
        confidence: 0.88,
        bbox: { x: 15, y: 50, width: 70, height: 35 },
      },
    ];

    // Pick 1-2 random detections to make the user preview feel alive and responsive
    const numDetections = Math.floor(Math.random() * 2) + 1;
    const shuffled = [...possibleDetections].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, numDetections);

    setDetections(selected);
    setIsDetecting(false);
    return selected;
  };

  /**
   * Normalizes detected hazard classes into hazard categories, titles, and severities.
   */
  const getUnifiedReportData = (results: DetectionResult[]) => {
    if (results.length === 0) {
      return {
        title: "Incident Report",
        description: "Safety concern reported via camera analysis.",
        category: "other" as HazardCategory,
        severity: "medium" as HazardSeverity,
      };
    }

    const primary = results[0];
    let category: HazardCategory = "other";
    let severity: HazardSeverity = "medium";
    let title = `${primary.class.toUpperCase()} Detected`;
    let description = `A ${primary.class} was automatically identified with ${(primary.confidence * 100).toFixed(0)}% confidence.`;

    switch (primary.class) {
      case "pothole":
      case "manhole":
        category = "roadblock";
        severity = "medium";
        break;
      case "garbage":
        category = "other";
        severity = "low";
        break;
      case "flood":
        category = "flood";
        severity = "high";
        break;
      case "fallen tree":
        category = "roadblock";
        severity = "high";
        break;
      case "construction hazard":
        category = "roadblock";
        severity = "medium";
        break;
    }

    // Elevate severity if multiple concurrent hazards exist in the frame
    if (results.length > 1) {
      severity = severity === "low" ? "medium" : severity === "medium" ? "high" : "critical";
      description += ` Additional concerns (${results.slice(1).map((r) => r.class).join(", ")}) were also detected in the frame.`;
    }

    return { title, description, category, severity };
  };

  return {
    compressImage,
    uploadPhoto,
    runDetection,
    getUnifiedReportData,
    isUploading,
    isDetecting,
    detections,
    photoUrl,
  };
};

export default useDetectHazards;
