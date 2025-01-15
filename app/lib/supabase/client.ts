"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./database.types";
import {
  getEnvironment,
  SUPABASE_ENV_HEADER,
  SUPABASE_CLIENT_TYPE,
} from "./environment";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          [SUPABASE_ENV_HEADER]: getEnvironment(),
          [SUPABASE_CLIENT_TYPE]: "client",
        },
      },
    }
  );
}
