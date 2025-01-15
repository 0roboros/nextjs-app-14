"use client";

import { useEffect, useState } from "react";

interface LogResult {
  timestamp: string;
  method?: string;
  path?: string;
  status?: number;
  status_text?: string;
  duration?: number;
  query?: string;
  error_message?: string;
  [key: string]: any;
}

interface LogResponse {
  result: LogResult[];
  error?: {
    message: string;
    code: number;
    status: string;
  };
}

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });
};

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("15m"); // 15m, 1h, 1d
  const [sqlFilter, setSqlFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case "1h":
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case "1d":
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        default: // 15m
          startTime = new Date(now.getTime() - 15 * 60 * 1000);
      }

      const params = new URLSearchParams({
        start: startTime.toISOString(),
        end: now.toISOString(),
        ...(sqlFilter && { sql: sqlFilter }),
      });

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch logs");

      const data: LogResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      setLogs(data.result || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = autoRefresh ? setInterval(fetchLogs, 5000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeRange, sqlFilter, autoRefresh]);

  const getLogColor = (status?: number) => {
    if (!status) return "text-gray-500";
    if (status >= 500) return "text-red-500";
    if (status >= 400) return "text-orange-500";
    if (status >= 300) return "text-blue-500";
    return "text-green-500";
  };

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Supabase Logs</h1>
        <p className="text-red-500">
          Logs viewer is only available in development mode.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Supabase Logs</h1>
        <div className="flex gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background border-black/[.12] dark:border-white/[.12]"
          >
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="1d">Last 24 hours</option>
          </select>
          <input
            type="text"
            placeholder="SQL filter..."
            value={sqlFilter}
            onChange={(e) => setSqlFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background border-black/[.12] dark:border-white/[.12]"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-black/[.12] dark:border-white/[.12]"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/80"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8">No logs available</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log, index) => (
            <div
              key={index}
              className="p-4 rounded-lg border border-black/[.12] dark:border-white/[.12] font-mono text-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold">
                  {formatTimestamp(log.timestamp)}
                </span>
                {log.method && (
                  <span className="px-2 py-0.5 bg-foreground/10 rounded">
                    {log.method}
                  </span>
                )}
                {log.status && (
                  <span className={`${getLogColor(log.status)}`}>
                    {log.status} {log.status_text}
                  </span>
                )}
                {log.duration && (
                  <span className="text-foreground/60">
                    {log.duration.toFixed(2)}ms
                  </span>
                )}
              </div>
              {log.path && <div className="mb-2 break-all">{log.path}</div>}
              {log.query && (
                <div className="mt-2 p-2 bg-foreground/5 rounded">
                  <div className="text-foreground/60 mb-1">Query:</div>
                  <pre className="whitespace-pre-wrap">{log.query}</pre>
                </div>
              )}
              {log.error_message && (
                <div className="mt-2 text-red-500">
                  <div>Error:</div>
                  <pre className="whitespace-pre-wrap">{log.error_message}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
