import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "../../../api/supabase";
import { useHazards } from "../../hazards/hooks/useHazards";
import { usePredictions } from "../../predictions/hooks/usePredictions";
import { useRouteSafety } from "../../routing/hooks/useRouteSafety";
import { requestNotificationPermissions, sendLocalNotification } from "../utils/notificationService";
import { Coordinate } from "../../routing/types";

// Dynamic distance calculator in meters
const getDistanceMeters = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const dy = (lat2 - lat1) * 111000;
  const dx = (lng2 - lng1) * 88000;
  return Math.sqrt(dx * dx + dy * dy);
};

export const useIntelligentAlerts = () => {
  const { data: hazards } = useHazards();
  
  // 1. Simulating a moving user coordinate (walking from SOMA to Tenderloin Collision hotspot)
  // This lets us demonstrate "entering danger zone" in real-time.
  const [userLat, setUserLat] = useState(37.7749);
  const [userLng, setUserLng] = useState(-122.4194);
  
  // Track notified threat ids, flood warnings, and route safety warnings to avoid notification spam
  const notifiedDangerZones = useRef<Set<string>>(new Set());
  const notifiedNearbyHazards = useRef<Set<string>>(new Set());
  const hasAlertedFlood = useRef(false);
  const hasAlertedRoute = useRef(false);

  // Define active travel route path to monitor
  const activeRoutePath: Coordinate[] = useMemo(() => [
    [37.7599, -122.4368], // Start: Mission
    [37.7710, -122.4280], // Midpoint 1
    [37.7810, -122.4200], // Midpoint 2
    [37.7949, -122.4117], // End: Financial District
  ], []);

  // Fetch predictions and route safety queries
  const { prediction } = usePredictions(userLat, userLng);
  const { defaultRoute } = useRouteSafety({ routePath: activeRoutePath });

  // Request notifications permissions on hook mount
  useEffect(() => {
    requestNotificationPermissions().then((granted) => {
      if (granted) {
        console.log("[Alerts] Push notifications permission granted.");
      } else {
        console.warn("[Alerts] Push notifications permission denied.");
      }
    });
  }, []);

  // Simulates user movements every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setUserLat((lat) => {
        // Move user closer to Tenderloin multi-car collision hotspot [37.7833, -122.4167]
        if (lat < 37.7830) {
          console.log("[LocationSimulator] User is moving northward closer to SOMA/Tenderloin.");
          return lat + 0.002;
        } else {
          // Loop back to start SOMA coordinate
          console.log("[LocationSimulator] Resetting coordinates back to SOMA start.");
          notifiedDangerZones.current.clear(); // Reset danger zone flags to re-test
          return 37.7749;
        }
      });
      setUserLng((lng) => (lng > -122.4170 ? -122.4194 : lng + 0.0006));
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // 2. Monitor Danger Zones (within 400m of active critical/high severity hazards)
  useEffect(() => {
    if (!hazards) return;

    const activeThreats = hazards.filter(
      (h) => h.status === "active" && (h.severity === "high" || h.severity === "critical")
    );

    activeThreats.forEach((h) => {
      const distance = getDistanceMeters(userLat, userLng, h.location_lat, h.location_lng);
      
      // If user enters danger zone (< 400 meters) and hasn't been warned about this hazard yet
      if (distance <= 400 && !notifiedDangerZones.current.has(h.id)) {
        notifiedDangerZones.current.add(h.id);
        
        sendLocalNotification(
          "⚠️ Danger Zone Alert!",
          `You have entered a high-risk area: ${h.title} is just ${Math.round(distance)}m away.`,
          { hazardId: h.id, type: "danger_zone" }
        );
      }
    });
  }, [userLat, userLng, hazards]);

  // 3. Monitor Supabase Realtime channel for new nearby hazards (< 1000m of user)
  useEffect(() => {
    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hazards" },
        (payload) => {
          const newHazard = payload.new as any;
          if (newHazard && newHazard.status === "active") {
            const distance = getDistanceMeters(
              userLat,
              userLng,
              newHazard.location_lat,
              newHazard.location_lng
            );

            // If a hazard is created within 1000 meters and hasn't been notified yet
            if (distance <= 1000 && !notifiedNearbyHazards.current.has(newHazard.id)) {
              notifiedNearbyHazards.current.add(newHazard.id);

              sendLocalNotification(
                "🚨 New Hazard Nearby!",
                `A new ${newHazard.category} was reported ${Math.round(distance)}m away: ${newHazard.title}.`,
                { hazardId: newHazard.id, type: "nearby_hazard" }
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userLat, userLng]);

  // 4. Monitor Flood Prediction Escalations (exceeds 70% probability)
  useEffect(() => {
    if (!prediction) return;

    const floodProb = prediction.floodRisk.probability;

    if (floodProb >= 70 && !hasAlertedFlood.current) {
      hasAlertedFlood.current = true;
      
      sendLocalNotification(
        "🌧️ Critical Flood Risk Warning",
        `Flood probability in your sector has risen to ${floodProb}%. Heavy rain/runoff forecasted.`,
        { type: "flood_escalation", probability: floodProb }
      );
    } else if (floodProb < 50) {
      hasAlertedFlood.current = false; // Reset if risk drops, allowing future alarms
    }
  }, [prediction]);

  // 5. Monitor Active Travel Route Safety Drops (safetyScore < 80%)
  useEffect(() => {
    if (!defaultRoute) return;

    const safetyScore = defaultRoute.analysis.safetyScore;

    if (safetyScore < 80 && !hasAlertedRoute.current) {
      hasAlertedRoute.current = true;
      
      sendLocalNotification(
        "⚠️ Active Route Safety Alert",
        `Your active travel route safety score has dropped to ${safetyScore}%. A detour is recommended.`,
        { type: "route_unsafe", safetyScore }
      );
    } else if (safetyScore >= 90) {
      hasAlertedRoute.current = false; // Reset warning if route safety recovers
    }
  }, [defaultRoute]);

  return {
    userLocation: { lat: userLat, lng: userLng },
    notifiedDangerCount: notifiedDangerZones.current.size,
  };
};

export default useIntelligentAlerts;
