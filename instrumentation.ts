import { registerOTel } from "@vercel/otel";
import { trace } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

type ConsoleMethod = keyof Console;

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { NodeTracerProvider } = await import(
      "@opentelemetry/sdk-trace-node"
    );
    const { SimpleSpanProcessor, ConsoleSpanExporter } = await import(
      "@opentelemetry/sdk-trace-base"
    );

    const provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "next-app",
      }),
    });

    const exporter = new ConsoleSpanExporter();
    const processor = new SimpleSpanProcessor(exporter);
    provider.addSpanProcessor(processor);
    provider.register();

    registerOTel({
      serviceName: "next-app",
    });
  } else if (typeof window !== "undefined") {
    const sendToServer = async (log: any) => {
      try {
        await fetch("/api/traces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([
            {
              ...log,
              timestamp: Date.now(),
              environment: "client",
            },
          ]),
        });
      } catch (error) {
        // Silently fail to avoid infinite loop
      }
    };

    // Override window.fetch before anything else loads
    const originalFetch = window.fetch;
    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : input.url;

      // Only intercept Supabase requests
      if (url.includes("supabase.co")) {
        const startTime = performance.now();

        try {
          const response = await originalFetch(input, init);
          const duration = performance.now() - startTime;

          // Clone response to read body without consuming it
          const clonedResponse = response.clone();
          let responseData;

          try {
            if (
              clonedResponse.headers
                .get("content-type")
                ?.includes("application/json")
            ) {
              responseData = await clonedResponse.json();
            }
          } catch {}

          if (!response.ok) {
            // Create type-safe console proxy
            console = new Proxy(console, {
              get: (target: Console, prop: PropertyKey): any => {
                if (prop === "error") {
                  return () => {}; // No-op for error logging
                }
                return (target as any)[prop];
              },
            });

            await sendToServer({
              name: "Supabase.error",
              level: "error",
              duration,
              attributes: {
                url: url.replace(
                  /https:\/\/.*\.supabase\.co/,
                  "[SUPABASE_URL]"
                ),
                method: init?.method || "GET",
                status: response.status,
                statusText: response.statusText,
                error: responseData,
              },
            });
          }

          return response;
        } catch (error: any) {
          // Create type-safe console proxy
          console = new Proxy(console, {
            get: (target: Console, prop: PropertyKey): any => {
              if (prop === "error") {
                return () => {}; // No-op for error logging
              }
              return (target as any)[prop];
            },
          });

          await sendToServer({
            name: "Supabase.error",
            level: "error",
            attributes: {
              url: url.replace(/https:\/\/.*\.supabase\.co/, "[SUPABASE_URL]"),
              method: init?.method || "GET",
              error: error.message,
              stack: error.stack,
            },
          });

          throw error; // Re-throw but it won't appear in console
        }
      }

      return originalFetch(input, init);
    };

    // Prevent unhandled rejection errors from appearing in console
    window.addEventListener(
      "unhandledrejection",
      (event) => {
        if (event.reason?.message?.includes("supabase.co")) {
          event.preventDefault();
          sendToServer({
            name: "Supabase.unhandledRejection",
            level: "error",
            attributes: {
              message: event.reason.message,
              stack: event.reason.stack,
            },
          });
        }
      },
      true
    );

    // Prevent general errors from appearing in console
    window.addEventListener(
      "error",
      (event) => {
        if (
          event.filename?.includes("supabase.co") ||
          event.message.includes("supabase.co")
        ) {
          event.preventDefault();
          sendToServer({
            name: "Supabase.error",
            level: "error",
            attributes: {
              message: event.message,
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              stack: event.error?.stack,
            },
          });
        }
      },
      true
    );

    // Replace console.error with type-safe version
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const errorString = args.join(" ");
      if (errorString.includes("supabase.co")) {
        sendToServer({
          name: "Supabase.consoleError",
          level: "error",
          attributes: {
            message: errorString,
            arguments: args.map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg) : String(arg)
            ),
          },
        });
        return; // Don't call original console.error
      }
      originalConsoleError.apply(console, args);
    };

    // Create a type-safe proxy for all console methods
    const safeConsole = new Proxy(console, {
      get(target: Console, prop: PropertyKey): any {
        const method = prop as ConsoleMethod;
        if (method === "error") {
          return (...args: any[]) => {
            const errorString = args.join(" ");
            if (errorString.includes("supabase.co")) {
              sendToServer({
                name: "Supabase.consoleError",
                level: "error",
                attributes: {
                  message: errorString,
                  arguments: args,
                },
              });
              return;
            }
            return target[method].apply(target, args);
          };
        }
        return target[method];
      },
    });

    // Replace the global console with our safe version
    (window as any).console = safeConsole;
  }
}
