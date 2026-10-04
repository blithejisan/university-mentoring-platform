import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requireUser } from "@/lib/auth/guards";
import { authorizeCoordinationNoteChannel } from "@/lib/services/coordination";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser();
    let socketId: string | null;
    let channelName: string | null;
    if (request.headers.get("content-type")?.includes("application/json")) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }
      if (typeof body !== "object" || body === null) {
        return NextResponse.json({ error: "Invalid channel authorization request." }, { status: 400 });
      }
      socketId = "socket_id" in body && typeof body.socket_id === "string" ? body.socket_id : null;
      channelName = "channel_name" in body && typeof body.channel_name === "string" ? body.channel_name : null;
    } else {
      const formData = await request.formData();
      const socketValue = formData.get("socket_id");
      const channelValue = formData.get("channel_name");
      socketId = typeof socketValue === "string" ? socketValue : null;
      channelName = typeof channelValue === "string" ? channelValue : null;
    }

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "A socket ID and channel name are required." }, { status: 400 });
    }
    if (!pusherServer) {
      return NextResponse.json({ error: "Real-time channel authorization is not configured." }, { status: 503 });
    }

    if (channelName.startsWith("private-user-")) {
      if (channelName.slice("private-user-".length) !== actor.sub) {
        return NextResponse.json({ error: "Not authorized for this channel." }, { status: 403 });
      }
    } else if (channelName.startsWith("private-note-")) {
      if (actor.role !== "MENTOR" && actor.role !== "MODERATOR") {
        return NextResponse.json({ error: "Not authorized for this channel." }, { status: 403 });
      }
      await authorizeCoordinationNoteChannel(actor, channelName.slice("private-note-".length));
    } else {
      return NextResponse.json({ error: "Unsupported channel." }, { status: 400 });
    }

    return NextResponse.json(pusherServer.authorizeChannel(socketId, channelName));
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
