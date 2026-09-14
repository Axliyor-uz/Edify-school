"use client";

import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, ScanFace, Loader2, RefreshCw } from "lucide-react";
import { getHikDevices, type HikDevicesResult } from "@/services/hikvisionService";

interface Props {
  /** Compact mode hides the label text. */
  compact?: boolean;
  /** Auto-refresh interval in ms (default 60s). 0 = no auto-refresh. */
  refreshMs?: number;
}

/**
 * Live face terminal status badge.
 * Shows: ● ONLINE (green) / ● OFFLINE (red) / ● Not configured (gray).
 * Polls hikDevices periodically to keep the indicator fresh.
 */
export default function FaceTerminalStatus({ compact = false, refreshMs = 60_000 }: Props) {
  const [data, setData] = useState<HikDevicesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getHikDevices();
      setData(res);
    } catch (e: unknown) {
      // If the function doesn't exist yet (not deployed), show "not configured"
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (refreshMs > 0) {
      const iv = setInterval(refresh, refreshMs);
      return () => clearInterval(iv);
    }
  }, [refresh, refreshMs]);

  // Not configured (no keys or function not deployed)
  if (!loading && (!data || !data.configured)) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-semibold text-on-surface-variant">
        <ScanFace size={13} className="opacity-50" />
        Face ID — sozlanmagan
      </span>
    );
  }

  // Loading
  if (loading && !data) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-full text-[11px] font-semibold text-on-surface-variant">
        <Loader2 size={13} className="animate-spin" />
        {!compact && "Terminal..."}
      </span>
    );
  }

  const isOnline = data?.anyTerminalOnline;
  const terminalName = data?.onlineTerminal?.name;

  return (
    <button
      onClick={refresh}
      title={
        isOnline
          ? `Terminal online: ${terminalName || "Hikvision"}\nBosing — yangilash`
          : "Terminal offline\nBosing — yangilash"
      }
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all hover:shadow-sm active:scale-95 ${
        isOnline
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
      }`}
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : isOnline ? (
        <Wifi size={12} />
      ) : (
        <WifiOff size={12} />
      )}
      {!compact && (
        <span>{isOnline ? "LIVE" : "Offline"}</span>
      )}
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-400"
        }`}
      />
    </button>
  );
}
