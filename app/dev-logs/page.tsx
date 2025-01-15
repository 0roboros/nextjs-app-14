"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Log {
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  operation: string;
  details?: any;
  duration?: number;
  error?: any;
  environment: string;
}

export default function DevLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [level, setLevel] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/dev-logs", window.location.origin);
      if (level) url.searchParams.set("level", level);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch("/api/dev-logs", { method: "DELETE" });
      fetchLogs();
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Set up polling every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [level]);

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dev Logs</h1>
        <p className="text-red-500">
          Dev logs are not available in production.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Supabase Dev Logs</h1>
        <div className="flex gap-4">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background border-black/[.12] dark:border-white/[.12]"
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <button
            onClick={clearLogs}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            Clear Logs
          </button>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/80"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8">No logs available</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border border-black/[.12] dark:border-white/[.12] font-mono text-sm whitespace-pre-wrap"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold">
                  {new Date(log.timestamp).toISOString()}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    log.level === "error"
                      ? "bg-red-500/10 text-red-500"
                      : log.level === "warn"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-blue-500/10 text-blue-500"
                  }`}
                >
                  {log.level}
                </span>
                {log.duration && (
                  <span className="text-foreground/60">
                    {log.duration.toFixed(2)}ms
                  </span>
                )}
              </div>
              <div className="font-bold">{log.operation}</div>
              {log.details && (
                <div className="mt-2">
                  <div className="text-foreground/60">Details:</div>
                  <pre className="mt-1">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
              {log.error && (
                <div className="mt-2 text-red-500">
                  <div>Error:</div>
                  <pre className="mt-1">
                    {JSON.stringify(log.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
