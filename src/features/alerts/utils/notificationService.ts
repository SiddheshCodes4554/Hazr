import * as Notifications from "expo-notifications";

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

/**
 * Requests push notification permissions from the host OS.
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === "granted";
};

/**
 * Triggers a local push notification immediately.
 */
export const sendLocalNotification = async (
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<string> => {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Deliver immediately
  });
};
