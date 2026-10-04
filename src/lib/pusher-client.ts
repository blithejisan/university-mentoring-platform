"use client";

import PusherClient from "pusher-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const pusherClient = new PusherClient(
  requiredEnv("NEXT_PUBLIC_PUSHER_KEY"),
  {
    cluster: requiredEnv("NEXT_PUBLIC_PUSHER_CLUSTER"),
    channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
  }
);
