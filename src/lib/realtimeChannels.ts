import type { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeChannelRemover = {
  removeChannel: (channel: RealtimeChannel) => Promise<"ok" | "timed out" | "error">;
};

function randomSuffix(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function uniqueRealtimeTopic(baseTopic: string): string {
  return `${baseTopic}:${randomSuffix()}`;
}

export function removeRealtimeChannel(
  client: RealtimeChannelRemover,
  channel: RealtimeChannel | null,
): void {
  if (!channel) return;
  void client.removeChannel(channel).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to remove realtime channel:", message);
  });
}
