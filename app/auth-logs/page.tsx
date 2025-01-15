"use client";

import { useEffect, useState } from "react";

interface AuthLog {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

interface LogResponse {
  result: AuthLog[];
  error?: {
    message: string;
    code: number;
    status: string;
  };
}

function parseLogMessage(message: string) {
  const parts = message.split(" | ");
  return {
    method: parts[0],
    status: parseInt(parts[1]),
    ip: parts[2],
    request_id: parts[3],
    url: parts[4],
    user_agent: parts[5],
  };
}

export default function AuthLogsPage() {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("15m");
  const [sqlFilter, setSqlFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [methodFilter, setMethodFilter] = useState<string>("all");

  const fetchLogs = async () => {
    try {
      setLoading(true);
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

      let finalSqlFilter = sqlFilter;
      if (methodFilter !== "all") {
        // Add method filtering to SQL query if selected
        const methodCondition = `message LIKE '${methodFilter} | %'`;
        finalSqlFilter = sqlFilter
          ? `${sqlFilter} AND ${methodCondition}`
          : methodCondition;
      }

      const params = new URLSearchParams({
        start: startTime.toISOString(),
        end: now.toISOString(),
        ...(finalSqlFilter && { sql: finalSqlFilter }),
      });

      const response = await fetch(`/api/auth-logs?${params.toString()}`);
      const data: LogResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to fetch logs");
      }

      if (data.error) {
        throw new Error(data.error.message || "Unknown error");
      }

      setLogs(data.result || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      console.error("Error fetching logs:", err);
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
  }, [timeRange, sqlFilter, methodFilter, autoRefresh]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
    });
  };

  const getStatusColor = (status: number): string => {
    if (status >= 500) return "text-red-500";
    if (status >= 400) return "text-orange-500";
    if (status >= 300) return "text-blue-500";
    return "text-green-500";
  };

  // Get unique methods from logs
  const methods = Array.from(
    new Set(
      logs
        .map((log) => {
          try {
            return parseLogMessage(log.message).method;
          } catch (e) {
            return null;
          }
        })
        .filter((method): method is string => method !== null)
    )
  ).sort();

  if (process.env.NODE_ENV === "production") {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Auth Logs</h1>
        <p className="text-red-500">
          Auth logs viewer is only available in development mode.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Auth Logs</h1>
          <div className="flex gap-4">
            <button
              onClick={() => void fetchLogs()}
              className="px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/80"
            >
              Refresh
            </button>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-black/[.12] dark:border-white/[.12]"
              />
              Auto-refresh
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background border-black/[.12] dark:border-white/[.12]"
          >
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="1d">Last 24 hours</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background border-black/[.12] dark:border-white/[.12]"
          >
            <option value="all">All methods</option>
            {methods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="SQL filter..."
            value={sqlFilter}
            onChange={(e) => setSqlFilter(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border bg-background border-black/[.12] dark:border-white/[.12]"
          />
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
          {logs.map((log, index) => {
            try {
              const { method, status, ip, request_id, url, user_agent } =
                parseLogMessage(log.message);
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-black/[.12] dark:border-white/[.12] font-mono text-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className="px-2 py-0.5 bg-foreground/10 rounded">
                      {method}
                    </span>
                    <span className={`${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-foreground/60">IP:</span> {ip}
                    </div>
                    <div>
                      <span className="text-foreground/60">Request ID:</span>{" "}
                      {request_id}
                    </div>
                    <div className="md:col-span-2 break-all">
                      <span className="text-foreground/60">URL:</span> {url}
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-foreground/60">User Agent:</span>{" "}
                      {user_agent}
                    </div>
                  </div>
                </div>
              );
            } catch (e) {
              // Fallback for unparseable logs
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg border border-black/[.12] dark:border-white/[.12] font-mono text-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className="px-2 py-0.5 bg-foreground/10 rounded">
                      {log.level}
                    </span>
                  </div>
                  <div className="mt-2 break-all">{log.message}</div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
