import { NextResponse } from "next/server";

// First, define possible attribute types
interface TraceAttributes {
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  error?: string | Record<string, unknown>;
  stack?: string;
  [key: string]: unknown; // For any other potential attributes
}

interface TraceEvent {
  name: string;
  duration?: number;
  attributes?: TraceAttributes;
  level?: string;
  environment: "client" | "server";
  timestamp: number;
}

function formatSupabaseError(trace: TraceEvent): string {
  const timestamp = new Date(trace.timestamp).toISOString();
  let message = `💫 [${timestamp}] Supabase Error:`;

  if (trace.duration) {
    message += ` (${trace.duration.toFixed(2)}ms)`;
  }

  if (trace.attributes?.method) {
    message += `\n  Request: ${trace.attributes.method} ${trace.attributes.url}`;
  }

  if (trace.attributes?.status) {
    message += `\n  Status: ${trace.attributes.status} ${trace.attributes.statusText}`;
  }

  if (trace.attributes?.error) {
    message += `\n  Error: ${
      typeof trace.attributes.error === "object"
        ? JSON.stringify(trace.attributes.error, null, 2)
        : trace.attributes.error
    }`;
  }

  if (trace.attributes?.stack) {
    message += `\n  Stack: ${trace.attributes.stack}`;
  }

  return message;
}

export async function POST(request: Request) {
  try {
    const traces: TraceEvent[] = await request.json();

    traces.forEach((trace) => {
      if (trace.name.startsWith("Supabase.")) {
        // Log Supabase errors with special formatting
        console.error(formatSupabaseError(trace));
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error processing traces:", error);
    return NextResponse.json({ error: "Invalid trace data" }, { status: 400 });
  }
}
