import { Platform } from "react-native";

let Notifications: any = null;

try {
  // Use require dynamically inside try-catch to prevent crash in Expo Go where native module is missing or restricted
  Notifications = require("expo-notifications");
} catch (error) {
  console.warn("[NotificationService] expo-notifications package failed to load:", error);
}

if (Notifications) {
  try {
    // Configure presentation behavior when app is in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.warn("[NotificationService] Failed to set notification handler:", error);
  }
}

/**
 * Requests push notification permissions from the host OS.
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!Notifications) {
    console.warn("[NotificationService] Notifications are disabled or unsupported in this environment (e.g. Expo Go).");
    return false;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === "granted";
  } catch (error) {
    console.error("[NotificationService] Error requesting notification permissions:", error);
    return false;
  }
};

/**
 * Triggers a local push notification immediately.
 */
export const sendLocalNotification = async (
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<string> => {
  if (!Notifications) {
    console.warn(
      `[NotificationService] Local notification mocked in this environment: [${title}] - ${body}`
    );
    return "mocked-notification-id";
  }
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Deliver immediately
    });
  } catch (error) {
    console.error("[NotificationService] Error sending local notification:", error);
    return "error-notification-id";
  }
};
