"use client";

import { useState, useTransition } from "react";
import { Button, Input, Label } from "@commandry/ui";
import { authClient } from "@commandry/auth/client";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await authClient.signIn.magicLink({
            email,
            callbackURL: "/app",
          });
          if (result.error) {
            setError(result.error.message ?? "Unable to send sign-in link");
            return;
          }
          setMessage(
            "If that address can receive mail, a secure sign-in link has been issued. In local development, check the server logs.",
          );
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? "email-error" : message ? "email-help" : undefined}
          disabled={pending}
        />
        {error ? (
          <p id="email-error" className="text-sm text-[var(--cmd-danger)]" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p id="email-help" className="text-sm text-[var(--cmd-success)]" role="status">
            {message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending link…" : "Email me a magic link"}
      </Button>
      <p className="text-xs text-[var(--cmd-fg-muted)]">
        Discord OAuth appears when Discord credentials are configured. Roblox linking is available
        after sign-in.
      </p>
    </form>
  );
}
