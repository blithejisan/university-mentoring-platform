import "server-only";
import Pusher from "pusher";

const pusherConfig = {
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
};

const { appId, key, secret, cluster } = pusherConfig;
const pusherServer =
  appId && key && secret && cluster
    ? new Pusher({ appId, key, secret, cluster, useTLS: true })
    : null;

if (!pusherServer) {
  console.error(
    "[pusher] Real-time server events are disabled. Configure PUSHER_APP_ID, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY, and NEXT_PUBLIC_PUSHER_CLUSTER."
  );
}

export { pusherServer };
