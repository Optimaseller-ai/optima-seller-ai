import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  // Keep sessions fresh (Supabase SSR). Route protection is handled in server layouts
  // so we can check the real user instead of guessing with cookies.
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
