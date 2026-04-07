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
  const { studentEmail, studentName, ficheDocId, teacherEmail } = body;

  if (!studentEmail || !ficheDocId) {
    return NextResponse.json({ error: "studentEmail and ficheDocId are required" }, { status: 400 });
  }

  const webhookBase = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "https://learninggoalsformations.app.n8n.cloud/webhook";
  try {
    const res = await fetch(`${webhookBase}/generate-midcourse-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentEmail, studentName, ficheDocId, teacherEmail: teacherEmail || null }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ success: false, message: `n8n error: ${res.status} ${text}` }, { status: 500 });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false, message: "Failed to reach test generator workflow" }, { status: 500 });
  }
}
