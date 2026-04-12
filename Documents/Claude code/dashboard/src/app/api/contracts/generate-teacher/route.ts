import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { studentEmail } = body;

  if (!studentEmail || typeof studentEmail !== "string") {
    return NextResponse.json({ error: "studentEmail required" }, { status: 400 });
  }

  const webhookBase = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "https://learninggoalsformations.app.n8n.cloud/webhook";
  try {
    const res = await fetch(`${webhookBase}/generate-teacher-contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentEmail }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, message: `n8n error: ${res.status} ${text}` }, { status: 500 });
    }

    const text = await res.text();
    if (!text || text.trim() === "") {
      return NextResponse.json({ success: true, message: "No contracts generated", contracts: [], count: 0 });
    }
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ success: false, message: "Failed to reach n8n workflow" }, { status: 500 });
  }
}
