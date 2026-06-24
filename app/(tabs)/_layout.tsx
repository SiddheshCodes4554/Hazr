import React from "react";
import { Tabs } from "expo-router";
import { useTheme } from "../../src/components/ThemeProvider";
import { AlertOctagon, PlusCircle, UserCircle, Map } from "lucide-react-native";

/**
 * Navigation Tabs Layout.
 * Configures styling for the bottom navigation bar, matching
 * the active dark/light mode and rendering Lucide icons.
 */
export default function TabsLayout() {
  const { colorScheme } = useTheme();

  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? "hsl(224, 71.4%, 8%)" : "hsl(0, 0%, 100%)",
          borderTopColor: isDark ? "hsl(215, 27.9%, 14%)" : "hsl(220, 13%, 91%)",
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: "#000",
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 10,
          elevation: 8,
        },
        tabBarActiveTintColor: "hsl(263.4, 80%, 60%)",
        tabBarInactiveTintColor: "hsl(220, 8.9%, 46.1%)",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => (
            <AlertOctagon color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => (
            <Map color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Report",
          tabBarIcon: ({ color, size }) => (
            <PlusCircle color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserCircle color={color} size={size - 2} strokeWidth={2.2} />
          ),
        }}
      />
    </Tabs>
  );
}
