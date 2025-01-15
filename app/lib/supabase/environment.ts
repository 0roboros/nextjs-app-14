export type Environment = "development" | "preview" | "production";
export type ClientType = "client" | "server" | "middleware";

export const SUPABASE_ENV_HEADER = "x-environment";
export const SUPABASE_CLIENT_TYPE = "x-client-type";

export function getEnvironment(): Environment {
  if (typeof window === "undefined") {
    return (
      (process.env.NEXT_PUBLIC_VERCEL_ENV as Environment) ||
      (process.env.NODE_ENV as Environment) ||
      "development"
    );
  } else {
    return window.location.hostname === "localhost"
      ? "development"
      : "production";
  }
}
