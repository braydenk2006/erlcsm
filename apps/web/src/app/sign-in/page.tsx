import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12"
    >
      <div className="rounded-[20px] border border-[var(--cmd-border)] bg-[var(--cmd-bg-elevated)] p-8 shadow-[var(--cmd-shadow)]">
        <p className="font-[family-name:var(--cmd-font-display)] text-3xl">Commandry</p>
        <h1 className="mt-2 text-lg text-[var(--cmd-fg-muted)]">Sign in to your workspace</h1>
        <div className="mt-8">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
