import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0B1220" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="calibration"
          options={{
            headerShown: true,
            title: "Calibration",
            headerStyle: { backgroundColor: "#0B1220" },
            headerTintColor: "#fff",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: "Settings",
            headerStyle: { backgroundColor: "#0B1220" },
            headerTintColor: "#fff",
            presentation: "modal",
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
