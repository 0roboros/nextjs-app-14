import { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

type LogLevel = "info" | "warn" | "error" | "debug";

// First define our interfaces
interface LogDetails {
  [key: string]: string | number | boolean | null | object | undefined;
}

interface LogError {
  message?: string;
  code?: string | number;
  details?: Record<string, unknown>;
  hint?: string;
  stack?: string;
  [key: string]: unknown; // Allow for additional error properties
}

// Update SupabaseLog to make details optional
interface SupabaseLog {
  timestamp: number;
  level: LogLevel;
  operation: string;
  details?: LogDetails; // Make details optional
  duration?: number;
  error?: LogError;
  environment: string;
}

class SupabaseLogger {
  private static instance: SupabaseLogger;
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();
  private logs: SupabaseLog[] = [];
  private readonly MAX_LOGS = 1000;

  private constructor() {}

  static getInstance(): SupabaseLogger {
    if (!SupabaseLogger.instance) {
      SupabaseLogger.instance = new SupabaseLogger();
    }
    return SupabaseLogger.instance;
  }

  private formatLog(log: SupabaseLog): string {
    const timestamp = new Date(log.timestamp).toISOString();
    const icon = "💫";
    const levelIcons = {
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      debug: "🔍",
    };

    let message = `${icon} [${timestamp}] ${levelIcons[log.level]} Supabase.${
      log.operation
    }`;

    if (log.duration !== undefined) {
      message += ` (${log.duration.toFixed(2)}ms)`;
    }

    if (log.details) { // Check if details exists
      message += "\n  Details:";
      const details = this.sanitizeLogDetails(log.details);
      Object.entries(details).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          message += `\n    ${key}: ${this.formatValue(value)}`;
        }
      });
    }

    if (log.error) {
      message += "\n  Error:";
      if (log.error.message) {
        message += `\n    Message: ${log.error.message}`;
      }
      if (log.error.code) {
        message += `\n    Code: ${log.error.code}`;
      }
      if (log.error.details) {
        message += `\n    Details: ${JSON.stringify(log.error.details)}`;
      }
      if (log.error.hint) {
        message += `\n    Hint: ${log.error.hint}`;
      }
      if (process.env.NODE_ENV === "development" && log.error.stack) {
        message += `\n    Stack: ${log.error.stack}`;
      }
    }

    return message;
  }

  private sanitizeLogDetails(details: LogDetails): LogDetails {
    if (typeof details !== "object" || details === null) {
      return details;
    }

    const sanitized: LogDetails = {};
    for (const [key, value] of Object.entries(details)) {
      // Skip internal properties and empty values
      if (!key.startsWith("_") && value !== undefined && value !== null) {
        // Redact sensitive information in production
        if (
          process.env.NODE_ENV === "production" &&
          (key.includes("password") ||
            key.includes("token") ||
            key.includes("key") ||
            key.includes("secret") ||
            key.includes("session"))
        ) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }

  private formatValue(value: LogDetails[keyof LogDetails]): string {
    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        return `[${value.map((v) => this.formatValue(v)).join(", ")}]`;
      }
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  log(
    level: LogLevel,
    operation: string,
    details?: LogDetails,
    error?: unknown,
    duration?: number
  ) {
    const log: SupabaseLog = {
      timestamp: Date.now(),
      level,
      operation,
      details: details || undefined,
      error: error ? this.formatError(error) : undefined,
      duration: duration || undefined,
      environment: process.env.NODE_ENV || "development",
    };

    // In development, store logs in memory and log to console
    if (process.env.NODE_ENV === "development") {
      this.logs.unshift(log); // Add to beginning of array
      if (this.logs.length > this.MAX_LOGS) {
        this.logs.pop(); // Remove oldest log if we exceed MAX_LOGS
      }
      console.log(this.formatLog(log));
    }
  }

  // Make these methods public
  public getLogs(limit: number = 100, level?: LogLevel): SupabaseLog[] {
    let filteredLogs = this.logs;
    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }
    return filteredLogs.slice(0, limit);
  }

  // Add method to clear logs
  public clearLogs(): void {
    this.logs = [];
  }

  trackRealtimeChannel(channel: RealtimeChannel, channelName: string) {
    this.realtimeChannels.set(channelName, channel);

    channel.subscribe((status) => {
      this.log("info", "realtime.status", {
        channel: channelName,
        status,
      });
    });

    return channel;
  }

  wrapClient<T extends SupabaseClient<Database>>(client: T): T {
    if (process.env.NODE_ENV !== "development") {
      return client;
    }

    return new Proxy(client, {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop, receiver);

        if (typeof value === "function") {
          return new Proxy(value, {
            apply: async (target, thisArg, args) => {
              const startTime = performance.now();
              try {
                const result = await target.apply(thisArg, args);

                this.log(
                  "info",
                  String(prop),
                  {
                    arguments: args,
                    result: result?.data,
                  },
                  undefined,
                  performance.now() - startTime
                );

                return result;
              } catch (error) {
                this.log(
                  "error",
                  String(prop),
                  { arguments: args },
                  error,
                  performance.now() - startTime
                );
                throw error;
              }
            },
          });
        }

        return value;
      },
    });
  }

  // Add a helper method to format the error
  private formatError(error: unknown): LogError {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        ...Object.fromEntries(Object.entries(error as unknown as Record<string, unknown>))
      };
    }

    if (typeof error === 'object' && error !== null) {
      return error as LogError;
    }

    return {
      message: String(error)
    };
  }
}

export const logger = SupabaseLogger.getInstance();

export function wrapWithLogging<T extends SupabaseClient<Database>>(
  supabase: T
): T {
  return logger.wrapClient(supabase);
}

export const getLogs = (limit?: number, level?: LogLevel) =>
  logger.getLogs(limit, level);
export const clearLogs = () => logger.clearLogs();
