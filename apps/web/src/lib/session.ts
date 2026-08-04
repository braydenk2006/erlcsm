import { headers } from "next/headers";
import { auth } from "@commandry/auth/server";
import { UnauthorizedError } from "@commandry/shared";

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session;
}
