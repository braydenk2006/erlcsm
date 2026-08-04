export function assertAuthSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters");
  }
  return secret;
}
