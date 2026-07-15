/**
 * OtaruChain — Reusable Supabase Realtime Subscription Hook
 *
 * Subscribes to INSERT/UPDATE/DELETE events on the `fraud_scans` table
 * for a specific user. Automatically updates local state when the
 * Telegram Bot or any other source inserts a new processed scan.
 *
 * Usage:
 *   const { latestEvent, eventCount } = useRealtimeScans(userId, onNewScan);
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export interface RealtimeScanEvent {
  type: RealtimeEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

interface UseRealtimeScansOptions {
  /** Called when any change event arrives */
  onEvent?: (event: RealtimeScanEvent) => void;
  /** Additional tables to subscribe to (besides fraud_scans) */
  extraTables?: string[];
  /** Disable the subscription (e.g. when user is not logged in) */
  enabled?: boolean;
}

export function useRealtimeScans(
  userId: string | null | undefined,
  options: UseRealtimeScansOptions = {}
) {
  const { onEvent, extraTables = [], enabled = true } = options;
  const [latestEvent, setLatestEvent] = useState<RealtimeScanEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!userId || !enabled) return;

    const channelName = `otaruchain-realtime-${userId.slice(0, 8)}`;
    const tables = ["fraud_scans", ...extraTables];

    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const event: RealtimeScanEvent = {
            type: payload.eventType as RealtimeEventType,
            data: payload.new || payload.old || {},
            timestamp: Date.now(),
          };

          setLatestEvent(event);
          setEventCount((prev) => prev + 1);

          if (onEventRef.current) {
            onEventRef.current(event);
          }
        }
      );
    });

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.log(
          `🔔 OtaruChain Realtime active for ${tables.length} table(s)`
        );
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled, extraTables.join(",")]);

  const resetCount = useCallback(() => setEventCount(0), []);

  return {
    /** The most recent realtime event received */
    latestEvent,
    /** Total number of events received since mount/reset */
    eventCount,
    /** Reset the event counter */
    resetCount,
  };
}
