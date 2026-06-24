import React from "react";
import { View, Text, ScrollView, Alert, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useUser } from "../../src/features/auth/hooks/useUser";
import { useTheme } from "../../src/components/ThemeProvider";
import { useSyncStore } from "../../src/store/syncStore";
import { useProfile, UserRole } from "../../src/features/auth/hooks/useProfile";
import { Card, CardContent } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Sun, Moon, Laptop, ShieldCheck, Award, BarChart3 } from "lucide-react-native";
import { ThemeMode } from "../../src/store/themeStore";

export default function ProfileScreen() {
  const { user, signOut } = useUser();
  const { theme, setTheme } = useTheme();
  const { queue, clearQueue } = useSyncStore();
  const { profile, role, updateRole, isUpdatingRole } = useProfile();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to log out of Hazr?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: signOut },
    ]);
  };

  const handleClearSyncQueue = () => {
    if (queue.length === 0) {
      Alert.alert("Queue Empty", "There are no pending offline reports to clear.");
      return;
    }

    Alert.alert(
      "Clear Pending Reports",
      "Are you sure you want to discard all pending offline reports? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Discard All", style: "destructive", onPress: clearQueue },
      ]
    );
  };

  const themeOptions: { mode: ThemeMode; label: string; icon: any }[] = [
    { mode: "light", label: "Light", icon: Sun },
    { mode: "dark", label: "Dark", icon: Moon },
    { mode: "system", label: "System", icon: Laptop },
  ];

  const roles: { value: UserRole; label: string }[] = [
    { value: "citizen", label: "Citizen" },
    { value: "moderator", label: "Moderator" },
    { value: "municipality", label: "Municipality" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 24 }} className="flex-1">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-foreground text-2xl font-black tracking-tight select-none">Settings</Text>
          <Text className="text-muted-foreground text-xs font-semibold select-none">
            Manage your user session, appearance, and roles
          </Text>
        </View>

        {/* User Account Info */}
        <Card className="mb-6">
          <View className="flex-row items-center p-2 pb-4 border-b border-border/20">
            <View className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 justify-center items-center mr-4">
              <ShieldCheck size={22} color="hsl(var(--primary))" />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-bold text-base leading-tight select-none">Account</Text>
              <Text className="text-muted-foreground text-xs select-all mt-1">
                {user?.email || "guest@hazr.app"}
              </Text>
              <View className="bg-primary/10 border border-primary/25 rounded-md px-2 py-0.5 mt-2 self-start">
                <Text className="text-primary font-bold text-[9px] uppercase tracking-wider">
                  Role: {role}
                </Text>
              </View>
            </View>
          </View>

          {/* Reputation & Rank Summary */}
          {(() => {
            const reputation = profile?.reputation !== undefined ? profile.reputation : 100;
            let rank = "Novice Watcher";
            let rankColor = "text-muted-foreground";
            let rankBg = "bg-muted/15 border-border/30";
            if (reputation >= 200) {
              rank = "Community Champion";
              rankColor = "text-amber-600 dark:text-amber-400";
              rankBg = "bg-amber-500/10 border-amber-500/20";
            } else if (reputation >= 120) {
              rank = "Active Guardian";
              rankColor = "text-primary";
              rankBg = "bg-primary/10 border-primary/20";
            }

            return (
              <View className="pt-4 px-2 flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <Award size={16} color="hsl(var(--primary))" className="mr-2" />
                  <View>
                    <Text className="text-foreground font-bold text-xs">Community Reputation</Text>
                    <Text className="text-muted-foreground text-[10px] mt-0.5">Influences report visibility & trust weight</Text>
                  </View>
                </View>
                <View className={`px-2.5 py-1 rounded-lg border flex-row items-center ${rankBg}`}>
                  <Text className={`text-[10px] font-black uppercase tracking-wider mr-1.5 ${rankColor}`}>
                    {rank}
                  </Text>
                  <Text className="text-foreground text-xs font-black select-none">
                    {reputation}
                  </Text>
                </View>
              </View>
            );
          })()}
        </Card>

        {/* Authority Portal Entry Card Banner */}
        {(role === "moderator" || role === "municipality") && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <View className="p-3 flex-row items-center justify-between">
              <View className="flex-1 pr-3 flex-row items-center">
                <View className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 justify-center items-center mr-3">
                  <BarChart3 size={18} color="hsl(var(--primary))" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-black text-xs select-none">Municipal Portal Active</Text>
                  <Text className="text-muted-foreground text-[10px] select-none mt-0.5">Access city-wide heatmaps, resolution trackers, and inflow trends.</Text>
                </View>
              </View>
              <Button
                label="Launch"
                variant="outline"
                size="sm"
                className="border-primary/30 text-primary py-2 px-3 text-[11px]"
                onPress={() => router.push("/authority/dashboard")}
              />
            </View>
          </Card>
        )}

        {/* Role Developer Switcher */}
        <Text className="text-foreground/75 text-xs font-semibold mb-2.5 ml-1 select-none">
          Active Role (Developer Switcher)
        </Text>
        <Card className="mb-6">
          <CardContent className="flex-row justify-between pt-1">
            {roles.map((item) => {
              const isSelected = role === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => updateRole(item.value)}
                  disabled={isUpdatingRole}
                  className={`flex-1 py-3.5 border rounded-xl mx-1 items-center justify-center ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-card/45 border-border/30"
                  } ${isUpdatingRole ? "opacity-50" : ""}`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      isSelected ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Text className="text-foreground/75 text-xs font-semibold mb-2.5 ml-1 select-none">
          Theme / Appearance
        </Text>
        <Card className="mb-6">
          <CardContent className="flex-row justify-between pt-1">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.mode;
              const IconComp = opt.icon;
              return (
                <Pressable
                  key={opt.mode}
                  onPress={() => setTheme(opt.mode)}
                  className={`flex-1 py-3.5 border rounded-xl mx-1 items-center justify-center flex-row ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "bg-card/45 border-border/30"
                  }`}
                >
                  <IconComp
                    size={14}
                    color={isSelected ? "#ffffff" : "hsl(var(--muted-foreground))"}
                    className="mr-1.5"
                  />
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </CardContent>
        </Card>

        {/* Offline Cache / Sync settings */}
        <Text className="text-foreground/75 text-xs font-semibold mb-2.5 ml-1 select-none">
          Offline Sync Management
        </Text>
        <Card className="mb-6">
          <View className="p-1">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1 pr-3">
                <Text className="text-foreground text-sm font-semibold select-none">Sync Queue Size</Text>
                <Text className="text-muted-foreground text-xs mt-0.5 select-none">
                  Reports waiting for connection to upload
                </Text>
              </View>
              <View className="bg-muted px-3 py-1.5 rounded-xl border border-border/40">
                <Text className="text-foreground font-bold text-xs">
                  {queue.length} reports
                </Text>
              </View>
            </View>
            
            <Button
              label="Clear Offline Queue"
              variant="outline"
              size="sm"
              className="border-destructive/20 active:bg-destructive/5 w-full flex-row"
              onPress={handleClearSyncQueue}
            />
          </View>
        </Card>

        {/* Sign Out Card */}
        <Button
          label="Sign Out of Account"
          variant="destructive"
          onPress={handleSignOut}
          className="w-full mt-4"
        />

        {/* System Diagnostics footer */}
        <View className="mt-12 items-center">
          <Text className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider select-none">
            Hazr v1.0.0 (SDK 54)
          </Text>
          <Text className="text-[9px] text-muted-foreground/60 mt-1 select-none">
            Theme Engine: NativeWind v4 • Offline Sync Activated
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
