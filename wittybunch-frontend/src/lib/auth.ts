import { cookies } from "next/headers";

const COOKIE_NAME = "wittybunch_dashboard";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === "ok";
}

export async function setAuthenticated() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "ok", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.VERCEL === "1",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearAuthenticated() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function checkPassword(value: string): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD) && value === process.env.DASHBOARD_PASSWORD;
}

export function isPasswordConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}
