import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "../../common/db/prisma";
import { env } from "../../config/env";

const expo = new Expo({ accessToken: env.expoAccessToken });

export async function sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, unknown>) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages: ExpoPushMessage[] = [{
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      // Logic to handle tickets/errors can be added here
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

export async function sendNotificationToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (user?.pushToken) {
    await sendPushNotification(user.pushToken, title, body, data);
  }
}

export async function sendNotificationToUsers(userIds: string[], title: string, body: string, data?: Record<string, unknown>) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, pushToken: { not: null } },
    select: { pushToken: true },
  });

  const tokens = users.map(u => u.pushToken!).filter(t => Expo.isExpoPushToken(t));
  
  const messages: ExpoPushMessage[] = tokens.map(token => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  // Send in chunks
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
       console.error("Error sending chunk:", error);
    }
  }
}
