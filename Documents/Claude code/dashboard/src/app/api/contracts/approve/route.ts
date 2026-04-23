import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Verify admin auth
  const authCookie = request.cookies.get("dashboard_auth");
  if (!authCookie?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const auth = JSON.parse(authCookie.value);
    if (auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid auth" }, { status: 401 });
  }

  // Get the contract ID from request body
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Contract ID required" }, { status: 400 });
  }

  // Forward to Railway API — Phase 6 cutover.
  // POST /api/contracts/:id/approve, id in URL path, no body.
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  try {
    const res = await fetch(`${apiBase}/api/contracts/${id}/approve`, {
      method: "POST",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, message: `API error: ${res.status} ${text}` }, { status: 500 });
    }

    const text = await res.text();
    if (!text || text.trim() === "") {
      return NextResponse.json({ success: true, message: "Contract sent" });
    }

    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    return NextResponse.json({ success: false, message: "Failed to reach Railway API" }, { status: 500 });
  }
}
