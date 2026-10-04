"use client";

import PusherClient from "pusher-js";

const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

if (!key || !cluster) {
  console.error(
    "[pusher] Real-time client updates are disabled. Configure NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER."
  );
}

export const pusherClient = key && cluster
  ? new PusherClient(key, {
      cluster,
      channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
    })
  : null;
