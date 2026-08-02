import { SignInForm } from "@/components/sign-in-form";
import { BrandMark } from "@/components/brand-mark";

export default function SignInPage() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12"
    >
      <div className="cmd-glass rounded-[22px] p-8">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={72} priority className="cmd-crest-glow" />
          <p className="mt-4 font-[family-name:var(--cmd-font-display)] text-3xl font-semibold tracking-[0.1em] uppercase">
            Commandry
          </p>
          <h1 className="mt-2 text-base text-[var(--cmd-fg-muted)]">Sign in to your workspace</h1>
        </div>
        <div className="mt-8">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
