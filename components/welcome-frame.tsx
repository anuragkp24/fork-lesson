import type { ReactNode } from "react";
import { Logo } from "./logo";

// The sign-in and onboarding screens: logo top-left, "Step N of 4" top-right,
// one narrow centred card, no app navigation.
export function WelcomeFrame({ step, children }: { step: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line bg-white">
        <div className="flex items-center justify-between px-[18px] py-3">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-heading text-lg font-bold tracking-tight">Fork Lesson</span>
          </div>
          <p className="text-xs text-muted">Step {step} of 4</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pb-24 pt-[34px]">
        <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-white p-5 shadow-[0_2px_6px_rgba(0,0,0,.04)] sm:p-7">
          {children}
        </div>
      </main>
    </>
  );
}

// "Not you? Sign out", small, for the signed-in onboarding screens.
export function SignOutLink() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="min-h-11 text-sm text-muted underline hover:text-ink">
        Not you? Sign out
      </button>
    </form>
  );
}
