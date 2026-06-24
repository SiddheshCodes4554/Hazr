import React, { useState, useEffect } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { useHazards } from "../../src/features/hazards/hooks/useHazards";
import { useSyncStore } from "../../src/store/syncStore";
import { useSyncQueue } from "../../src/features/offline/hooks/useSyncQueue";
import { useProfile } from "../../src/features/auth/hooks/useProfile";
import { useResolveHazard } from "../../src/features/hazards/hooks/useResolveHazard";
import { useAssessRisk } from "../../src/features/hazards/hooks/useAssessRisk";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../src/api/supabase";
import { useHazardValidation } from "../../src/features/hazards/hooks/useHazardValidation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../src/components/Card";
import { Skeleton } from "../../src/components/Skeleton";
import { Button } from "../../src/components/Button";
import {
  Flame,
  Droplets,
  Car,
  Construction,
  CloudLightning,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  Brain,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  ThumbsDown,
  ShieldAlert,
  BadgeCheck,
} from "lucide-react-native";
import { HazardSeverity } from "../../src/features/hazards/types";

// Map hazard categories to Lucide icons
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

/**
 * Child panel to perform and render the AI Risk Assessment.
 * Query is executed lazily only when this component is mounted (card expanded),
 * protecting API endpoints from rate limit overflows.
 */
const RiskAssessmentPanel = ({ item }: { item: any }) => {
  // Synthesize weather and incident density context based on hazard category
  const weather =
    item.category === "flood"
      ? "Heavy Rain & Runoff"
      : item.category === "weather"
      ? "Strong Gale Winds"
      : "Clear Skies";
      
  const historicalReportsCount = Math.floor((item.location_lat * 1000) % 5);

  const { data: assessment, isLoading, error } = useAssessRisk({
    hazardType: item.category,
    confidenceScore: 0.9,
    weather,
    location: { lat: item.location_lat, lng: item.location_lng },
    historicalReportsCount,
  });

  if (isLoading) {
    return (
      <View className="mt-3.5 p-3.5 bg-muted/15 border border-border/30 rounded-xl">
        <View className="flex-row justify-between mb-2">
          <Skeleton className="w-1/3 h-4 rounded" />
          <Skeleton className="w-1/5 h-3 rounded" />
        </View>
        <Skeleton className="w-full h-3 mb-2 rounded" />
        <Skeleton className="w-2/3 h-3 mb-3 rounded" />
        <Skeleton className="w-full h-10 rounded-lg" />
      </View>
    );
  }

  if (error || !assessment) {
    return (
      <View className="mt-3.5 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
        <Text className="text-destructive text-xs font-semibold text-center select-none">
          Risk Assessment engine currently unavailable.
        </Text>
      </View>
    );
  }

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-500";
      case "medium":
        return "bg-amber-500";
      case "high":
        return "bg-red-500";
      case "critical":
        return "bg-purple-500";
      default:
        return "bg-primary";
    }
  };

  const getUrgencyTextColor = (level: string) => {
    switch (level) {
      case "low":
        return "text-green-600 dark:text-green-400";
      case "medium":
        return "text-amber-600 dark:text-amber-400";
      case "high":
        return "text-red-600 dark:text-red-400";
      case "critical":
        return "text-purple-600 dark:text-purple-400";
      default:
        return "text-primary";
    }
  };

  return (
    <View className="mt-3.5 p-4 bg-muted/10 border border-border/40 rounded-xl">
      {/* Assessment Header */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <Brain size={14} color="hsl(var(--primary))" className="mr-1.5" />
          <Text className="text-foreground text-xs font-black select-none">AI Assessment</Text>
        </View>
        <Text
          className={`text-[9px] font-black uppercase tracking-wider ${getUrgencyTextColor(
            assessment.risk_level
          )}`}
        >
          {assessment.risk_level} Risk
        </Text>
      </View>

      {/* Urgency Progress Bar */}
      <View className="flex-row items-center mb-3.5">
        <Text className="text-foreground text-[10px] font-bold mr-3 select-none">
          Urgency: {assessment.urgency_score}%
        </Text>
        <View className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <View
            style={{ width: `${assessment.urgency_score}%` }}
            className={`h-full ${getUrgencyColor(assessment.risk_level)}`}
          />
        </View>
      </View>

      {/* Risk Explanation */}
      <Text className="text-foreground/80 text-[11px] leading-relaxed mb-4 select-text">
        <Text className="font-bold text-foreground">Analysis: </Text>
        {assessment.explanation}
      </Text>

      {/* Guidelines Accordion */}
      <View className="flex-col gap-2 pt-2 border-t border-border/30">
        <View className="bg-primary/5 p-2.5 rounded-lg border border-primary/10">
          <Text className="text-primary font-bold text-[8px] uppercase tracking-wider select-none">
            Citizen Guidance
          </Text>
          <Text className="text-foreground/90 text-[10.5px] leading-relaxed mt-1 select-text">
            {assessment.citizen_recommendation}
          </Text>
        </View>

        <View className="bg-secondary/15 p-2.5 rounded-lg border border-secondary/10">
          <Text className="text-secondary-foreground font-bold text-[8px] uppercase tracking-wider select-none">
            Municipality Dispatch
          </Text>
          <Text className="text-foreground/90 text-[10.5px] leading-relaxed mt-1 select-text">
            {assessment.municipality_recommendation}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default function FeedScreen() {
  const { data: hazards, isLoading, error, refetch, isRefetching } = useHazards();
  const queue = useSyncStore((state) => state.queue);
  const { isSyncing, processQueue } = useSyncQueue();
  const { isModerator, isMunicipality, role } = useProfile();
  const resolveHazardMutation = useResolveHazard();
  const { userValidations, submitValidation } = useHazardValidation();
  const [mountTime] = useState(() => Date.now());

  // Load all user reputations to display next to reports
  const { data: profilesList } = useQuery({
    queryKey: ["profiles_reputations"],
    queryFn: async () => {
      try {
        const { data } = await supabase.from("profiles").select("email, reputation");
        return data || [];
      } catch {
        return [];
      }
    },
  });

  const repMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    profilesList?.forEach((p: any) => {
      if (p.email) map[p.email] = p.reputation ?? 100;
    });
    return map;
  }, [profilesList]);
  
  const [isOnline, setIsOnline] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<HazardSeverity | "all">("all");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [revealedSpam, setRevealedSpam] = useState<Record<string, boolean>>({});

  const handleValidationAction = (
    hazardId: string,
    action: "upvote" | "downvote" | "verify" | "fixed"
  ) => {
    submitValidation(
      { hazardId, action },
      {
        onError: (err: any) => {
          Alert.alert("Action Failed", err.message || "Could not complete validation.");
        },
      }
    );
  };

  // Track network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter hazards by severity
  const filteredHazards = hazards?.filter((h) => {
    if (selectedSeverity === "all") return true;
    return h.severity === selectedSeverity;
  });

  const getSeverityColor = (severity: HazardSeverity) => {
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

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = mountTime - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {/* App Header */}
      <View className="px-6 py-4 flex-row justify-between items-center border-b border-border/40 bg-card/30">
        <View>
          <Text className="text-foreground text-2xl font-black tracking-tight select-none">Hazr</Text>
          <Text className="text-muted-foreground text-xs font-semibold select-none">
            Incidents Feed ({role})
          </Text>
        </View>
        
        {/* Connection Status Badge */}
        <View
          className={`flex-row items-center px-3 py-1.5 rounded-full border ${
            isOnline
              ? "bg-green-500/10 border-green-500/25"
              : "bg-red-500/10 border-red-500/25"
          }`}
        >
          {isOnline ? (
            <>
              <Wifi size={12} color="hsl(142, 70%, 45%)" className="mr-1" />
              <Text className="text-[10px] font-bold text-green-600 dark:text-green-400">Online</Text>
            </>
          ) : (
            <>
              <WifiOff size={12} color="hsl(0, 84%, 60%)" className="mr-1" />
              <Text className="text-[10px] font-bold text-red-600 dark:text-red-400">Offline</Text>
            </>
          )}
        </View>
      </View>

      {/* Sync Queue Warning Bar */}
      {queue.length > 0 && (
        <View className="bg-primary/10 border-b border-primary/20 px-6 py-3 flex-row justify-between items-center">
          <View className="flex-row items-center flex-1 pr-2">
            <RefreshCw size={14} color="hsl(var(--primary))" className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            <Text className="text-primary text-xs font-semibold">
              {queue.length} reports pending sync ({isOnline ? "syncing..." : "waiting for network"})
            </Text>
          </View>
          {isOnline && !isSyncing && (
            <Button
              label="Sync Now"
              variant="outline"
              size="sm"
              className="py-1 px-3 border-primary/30"
              onPress={processQueue}
            />
          )}
        </View>
      )}

      {/* Severity Filter Scroll */}
      <View className="py-3 bg-card/20 border-b border-border/30">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24 }}
        >
          {(["all", "low", "medium", "high", "critical"] as const).map((sev) => {
            const isSelected = selectedSeverity === sev;
            return (
              <Pressable
                key={sev}
                onPress={() => setSelectedSeverity(sev)}
                className={`mr-2.5 px-4 py-2 rounded-full border ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-card/50 border-border/40"
                }`}
              >
                <Text
                  className={`text-xs font-semibold capitalize ${
                    isSelected ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {sev}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Hazards Feed list */}
      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{ padding: 24 }}
          renderItem={() => (
            <Card className="mb-4">
              <View className="flex-row items-center mb-3">
                <Skeleton className="w-10 h-10 rounded-xl mr-3" />
                <View className="flex-1">
                  <Skeleton className="w-2/3 h-4 mb-2 rounded" />
                  <Skeleton className="w-1/3 h-3 rounded" />
                </View>
              </View>
              <Skeleton className="w-full h-16 rounded-xl" />
            </Card>
          )}
        />
      ) : error ? (
        <View className="flex-1 justify-center items-center px-6">
          <AlertTriangle size={48} color="hsl(var(--destructive))" className="mb-4" />
          <Text className="text-foreground text-lg font-bold mb-2">Failed to load feed</Text>
          <Text className="text-muted-foreground text-sm text-center mb-6">
            An error occurred while fetching reports.
          </Text>
          <Button label="Retry Connection" onPress={() => refetch()} />
        </View>
      ) : filteredHazards && filteredHazards.length > 0 ? (
        <FlatList
          data={filteredHazards}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="hsl(var(--primary))"
              colors={["hsl(var(--primary))"]}
            />
          }
          renderItem={({ item }) => {
            const isExpanded = !!expandedCards[item.id];
            const userVal = userValidations[item.id] || {
              vote: 0,
              verified: false,
              marked_fixed: false,
            };

            const trust = item.trust_score !== undefined ? item.trust_score : 50;
            const totalVotes = (item.upvotes_count || 0) + (item.downvotes_count || 0);
            const isSpam = trust < 25 && totalVotes >= 3;
            const isRevealed = !!revealedSpam[item.id];

            const getTrustScoreColor = (score: number) => {
              if (score >= 80) return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
              if (score >= 40) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
              return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
            };

            const getReporterReputation = () => {
              const rep = repMap[item.reported_by];
              return rep !== undefined ? rep : 100;
            };

            if (isSpam && !isRevealed) {
              return (
                <Card className="mb-4 border-red-500/20 bg-red-500/5 opacity-80">
                  <CardHeader className="flex-row items-center justify-between pb-2">
                    <View className="flex-row items-center">
                      <ShieldAlert size={18} color="hsl(var(--destructive))" className="mr-2" />
                      <Text className="text-destructive font-black text-xs select-none">
                        POTENTIAL SPAM REPORT
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-md border ${getTrustScoreColor(trust)}`}>
                      <Text className="text-[9px] font-black uppercase tracking-wider">
                        {trust}% Trust
                      </Text>
                    </View>
                  </CardHeader>
                  <CardContent className="pt-1">
                    <Text className="text-muted-foreground text-xs leading-relaxed mb-3.5 select-none">
                      This report was flagged by the community due to very low credibility. The content is collapsed to protect community watch boards.
                    </Text>
                    <Button
                      label="View Report Content"
                      variant="outline"
                      size="sm"
                      className="border-destructive/30 text-destructive text-[11px] py-1.5 active:bg-destructive/10"
                      onPress={() => setRevealedSpam((prev) => ({ ...prev, [item.id]: true }))}
                    />
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card className={`mb-4 ${item.status === "resolved" ? "opacity-75" : ""}`}>
                <CardHeader className="flex-row items-start justify-between">
                  <View className="flex-row items-center flex-1 pr-3">
                    <View className="w-10 h-10 rounded-xl bg-muted justify-center items-center mr-3 border border-border/40">
                      <CategoryIcon category={item.category} color="hsl(var(--primary))" size={20} />
                    </View>
                    <View className="flex-1">
                      <CardTitle className="leading-tight text-sm">{item.title}</CardTitle>
                      <CardDescription className="capitalize font-medium text-[10.5px]">
                        {item.category} • {formatTime(item.created_at)} • Rep: {getReporterReputation()}
                      </CardDescription>
                    </View>
                  </View>
                  
                  {/* Badges Container */}
                  <View className="flex-row items-center gap-1.5">
                    {/* Trust Score Badge */}
                    <View className={`px-2 py-0.5 rounded-md border ${getTrustScoreColor(trust)}`}>
                      <Text className="text-[9px] font-black uppercase tracking-wider">
                        {trust}% Trust
                      </Text>
                    </View>
                    {item.status === "resolved" && (
                      <View className="bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-md flex-row items-center">
                        <CheckCircle size={10} color="hsl(142, 70%, 45%)" className="mr-0.5" />
                        <Text className="text-[9px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                          Resolved
                        </Text>
                      </View>
                    )}
                    {/* Severity Badge */}
                    <View className={`px-2 py-0.5 rounded-md border ${getSeverityColor(item.severity)}`}>
                      <Text className="text-[9px] font-black uppercase tracking-wider">{item.severity}</Text>
                    </View>
                  </View>
                </CardHeader>
                
                <CardContent>
                  <Text className="text-foreground/90 text-sm leading-relaxed mb-3">
                    {item.description}
                  </Text>
                  
                  {/* Attached photo thumbnail if available */}
                  {item.photo_url && (
                    <View className="w-full aspect-[16/9] rounded-xl overflow-hidden mb-3 border border-border/40 bg-zinc-950">
                      <Image source={{ uri: item.photo_url }} className="w-full h-full" resizeMode="cover" />
                    </View>
                  )}

                  {/* Community Validation Panel */}
                  <View className="flex-row items-center justify-between border-t border-border/25 pt-3.5 mt-2 gap-2">
                    <View className="flex-row items-center gap-1.5">
                      {/* Upvote Button */}
                      <Pressable
                        onPress={() => handleValidationAction(item.id, "upvote")}
                        className={`flex-row items-center px-3 py-2 rounded-xl border ${
                          userVal.vote === 1
                            ? "bg-green-500/15 border-green-500/35"
                            : "bg-muted/10 border-border/20 active:bg-muted/20"
                        }`}
                      >
                        <ThumbsUp size={12} color={userVal.vote === 1 ? "hsl(142, 70%, 45%)" : "hsl(var(--muted-foreground))"} />
                        <Text className={`text-[10px] font-black ml-1.5 ${userVal.vote === 1 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                          {item.upvotes_count || 0}
                        </Text>
                      </Pressable>

                      {/* Downvote Button */}
                      <Pressable
                        onPress={() => handleValidationAction(item.id, "downvote")}
                        className={`flex-row items-center px-3 py-2 rounded-xl border ${
                          userVal.vote === -1
                            ? "bg-red-500/15 border-red-500/35"
                            : "bg-muted/10 border-border/20 active:bg-muted/20"
                        }`}
                      >
                        <ThumbsDown size={12} color={userVal.vote === -1 ? "hsl(0, 84%, 60%)" : "hsl(var(--muted-foreground))"} />
                        <Text className={`text-[10px] font-black ml-1.5 ${userVal.vote === -1 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {item.downvotes_count || 0}
                        </Text>
                      </Pressable>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      {/* Verify Active Button */}
                      <Pressable
                        onPress={() => handleValidationAction(item.id, "verify")}
                        className={`flex-row items-center px-3 py-2 rounded-xl border ${
                          userVal.verified
                            ? "bg-primary/15 border-primary/35"
                            : "bg-muted/10 border-border/20 active:bg-muted/20"
                        }`}
                      >
                        <BadgeCheck size={12} color={userVal.verified ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                        <Text className={`text-[10px] font-black ml-1.5 ${userVal.verified ? "text-primary" : "text-muted-foreground"}`}>
                          Verify
                        </Text>
                      </Pressable>

                      {/* Fixed Button */}
                      <Pressable
                        onPress={() => handleValidationAction(item.id, "fixed")}
                        className={`flex-row items-center px-3 py-2 rounded-xl border ${
                          userVal.marked_fixed
                            ? "bg-cyan-500/15 border-cyan-500/35"
                            : "bg-muted/10 border-border/20 active:bg-muted/20"
                        }`}
                      >
                        <CheckCircle size={12} color={userVal.marked_fixed ? "#06b6d4" : "hsl(var(--muted-foreground))"} />
                        <Text className={`text-[10px] font-black ml-1.5 ${userVal.marked_fixed ? "text-cyan-600 dark:text-cyan-400" : "text-muted-foreground"}`}>
                          Fixed
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Collapsible toggle for Risk Assessment */}
                  <Pressable
                    onPress={() => toggleExpand(item.id)}
                    className="flex-row justify-between items-center py-2.5 px-3 border border-border/30 rounded-xl bg-card active:bg-muted/10 mt-3"
                  >
                    <View className="flex-row items-center">
                      <Brain size={13} color="hsl(var(--primary))" className="mr-1.5" />
                      <Text className="text-foreground/80 text-[11px] font-bold select-none">
                        AI Risk Assessment Data
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={13} color="hsl(var(--muted-foreground))" />
                    ) : (
                      <ChevronDown size={13} color="hsl(var(--muted-foreground))" />
                    )}
                  </Pressable>

                  {/* Lazy-loaded Risk assessment panel */}
                  {isExpanded && <RiskAssessmentPanel item={item} />}
                  
                  {/* Action button for Moderators / Municipalities */}
                  {item.status !== "resolved" && (isModerator || isMunicipality) && (
                    <Button
                      label="Resolve Incident"
                      variant="outline"
                      size="sm"
                      className="mt-3.5 w-full border-green-500/30 text-green-600 dark:text-green-400 py-2 active:bg-green-500/10"
                      onPress={() => resolveHazardMutation.mutate(item.id)}
                      loading={resolveHazardMutation.isPending && resolveHazardMutation.variables === item.id}
                    />
                  )}

                  {/* Queued indicator */}
                  {(item as any)._queued && (
                    <View className="mt-2.5 bg-yellow-500/10 border border-yellow-500/20 py-1.5 px-3 rounded-lg flex-row items-center">
                      <Text className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold select-none">
                        ⚠️ Stored Offline - Pending upload
                      </Text>
                    </View>
                  )}
                </CardContent>
              </Card>
            );
          }}
        />
      ) : (
        <View className="flex-1 justify-center items-center px-6">
          <AlertTriangle size={48} color="hsl(var(--muted-foreground))" className="mb-4" />
          <Text className="text-foreground text-lg font-bold mb-1">No reports found</Text>
          <Text className="text-muted-foreground text-sm text-center">
            There are no incidents matching this severity filter.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
