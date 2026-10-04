import "server-only";
import Pusher from "pusher";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const pusherServer = new Pusher({
  appId: requiredEnv("PUSHER_APP_ID"),
  key: requiredEnv("NEXT_PUBLIC_PUSHER_KEY"),
  secret: requiredEnv("PUSHER_SECRET"),
  cluster: requiredEnv("NEXT_PUBLIC_PUSHER_CLUSTER"),
  useTLS: true,
});
