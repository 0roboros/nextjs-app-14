import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getEnvironment,
  SUPABASE_ENV_HEADER,
  SUPABASE_CLIENT_TYPE,
} from "./environment";
import { Database } from "./database.types";

export async function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {
            console.log(error);
            // Handle cookie setting error in Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch (error) {
            console.log(error);
            // Handle cookie removal error in Server Component
          }
        },
      },
      global: {
        headers: {
          [SUPABASE_ENV_HEADER]: getEnvironment(),
          [SUPABASE_CLIENT_TYPE]: "server",
        },
      },
    }
  );
}
