import { NextResponse, type NextRequest } from "next/server";
import { authorizePrototype, credentialsConfigured, isPrototypePath, PREVIEW_REALM, previewResponseHeaders, type PreviewEnvironment } from "./lib/business-map/preview-access.ts";
import { prototypeMode } from "./lib/business-map/prototype-policy.ts";

export async function middleware(request: NextRequest) {
  const env: PreviewEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
    BUSINESS_MAP_PROTOTYPE: process.env.BUSINESS_MAP_PROTOTYPE,
    SITE_NOINDEX: process.env.SITE_NOINDEX,
    BUSINESS_MAP_PREVIEW_USERNAME: process.env.BUSINESS_MAP_PREVIEW_USERNAME,
    BUSINESS_MAP_PREVIEW_PASSWORD: process.env.BUSINESS_MAP_PREVIEW_PASSWORD,
  };
  const pathname = request.nextUrl.pathname;
  const previewService = env.RAILWAY_ENVIRONMENT_NAME === "preview";
  if (!previewService && !isPrototypePath(pathname)) return NextResponse.next();

  // This exception has no application content. Railway probes cannot send Basic credentials.
  if (previewService && pathname === "/healthz" && ["GET", "HEAD"].includes(request.method)) {
    const ready = prototypeMode(env.NODE_ENV, env.BUSINESS_MAP_PROTOTYPE, env.RAILWAY_ENVIRONMENT_NAME, env.SITE_NOINDEX) === "preview" && credentialsConfigured(env);
    return new NextResponse(request.method === "HEAD" ? null : ready ? "ok" : "unavailable", {
      status: ready ? 200 : 503, headers: previewResponseHeaders,
    });
  }

  const access = await authorizePrototype(env, request.headers.get("authorization"));
  if (access === "hidden") return new NextResponse("Not found", { status: 404, headers: previewResponseHeaders });
  if (access === "challenge") return new NextResponse("Authentication required", {
    status: 401, headers: { ...previewResponseHeaders, "WWW-Authenticate": PREVIEW_REALM },
  });
  // Prototype has no server writes or public-site integrations. Never deliver a live lead from preview.
  if (previewService && (pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method))) {
    return new NextResponse("Not found", { status: 404, headers: previewResponseHeaders });
  }
  const response = NextResponse.next();
  for (const [name, value] of Object.entries(previewResponseHeaders)) response.headers.set(name, value);
  return response;
}

// Deliberately includes chunks, CSS, images, manifests, RSC/prefetch and Next data routes.
// An HTML-only matcher or a Referer check would expose the preview's client bundle.
export const config = { matcher: ["/:path*"] };
