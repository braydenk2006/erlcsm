import { getAuth } from "@commandry/auth/server";

// Better Auth is created lazily (see @commandry/auth/server#getAuth) so the
// production build does not require BETTER_AUTH_SECRET at page-data collection.
export async function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
