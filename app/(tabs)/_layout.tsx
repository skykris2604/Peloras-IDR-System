import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#00E5FF",
        tabBarInactiveTintColor: "#6B7A90",
        tabBarStyle: {
          backgroundColor: "#0F1A2E",
          borderTopColor: "#1E2F4A",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Navigate",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "navigate" : "navigate-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: "Sensors",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "pulse" : "pulse-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="playback"
        options={{
          title: "Playback",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "play-circle" : "play-circle-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
