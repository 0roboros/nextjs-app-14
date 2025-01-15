import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!projectId || !accessToken) {
    return NextResponse.json(
      {
        error:
          "Missing environment variables: NEXT_PUBLIC_SUPABASE_PROJECT_ID or SUPABASE_ACCESS_TOKEN",
      },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const startTime = searchParams.get("start");
  const endTime = searchParams.get("end");
  const sql = searchParams.get("sql");

  // The Supabase Management API uses different parameter names
  const params = new URLSearchParams({
    ...(startTime && { iso_timestamp_start: startTime }),
    ...(endTime && { iso_timestamp_end: endTime }),
    ...(sql && { sql: sql }),
  });

  try {
    const url = `https://api.supabase.com/v1/projects/${projectId}/analytics/endpoints/logs.all${
      params.toString() ? `?${params}` : ""
    }`;

    console.log("Fetching logs from:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supabase API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      throw new Error(
        `Supabase API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Unknown error from Supabase API");
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching auth logs:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch auth logs",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      { status: 500 }
    );
  }
}
