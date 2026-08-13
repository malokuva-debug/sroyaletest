import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "editor_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isEditorApi = pathname.startsWith("/api/admin/") && pathname !== "/api/admin/login";
  const isEditorPage = pathname.startsWith("/editor") && pathname !== "/editor/login";

  if (!isEditorApi && !isEditorPage) return NextResponse.next();

  const passcode = process.env.EDITOR_PASSCODE;
  if (!passcode) {
    if (isEditorApi) {
      return NextResponse.json(
        { error: "Editor is not configured. Set EDITOR_PASSCODE in your environment." },
        { status: 503 }
      );
    }
    return NextResponse.redirect(new URL("/editor/login?unconfigured=1", req.url));
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === passcode) return NextResponse.next();

  if (isEditorApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/editor/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/editor/:path*", "/api/admin/:path*"],
};
