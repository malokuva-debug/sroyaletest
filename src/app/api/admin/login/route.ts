import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { passcode } = await req.json().catch(() => ({ passcode: "" }));
  const expected = process.env.EDITOR_PASSCODE;

  if (!expected) {
    return NextResponse.json(
      { error: "Editor is not configured. Set EDITOR_PASSCODE in your environment." },
      { status: 503 }
    );
  }
  if (String(passcode ?? "") !== expected) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("editor_auth", expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
