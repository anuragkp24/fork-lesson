import { Logo } from "@/components/logo";
import { alertError, card } from "@/lib/ui";
import { SignInButton } from "./sign-in-button";

const MESSAGES: Record<string, string> = {
  scopes: "Fork Lesson needs all permissions to copy your lessons and files. Please try again and leave every box ticked.",
  reconnect: "Google didn't give Fork Lesson a lasting connection. Please sign in again and approve everything.",
  denied: "Sign-in was cancelled or Google declined it. Please try again.",
  failed: "Something went wrong while signing in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reconnect?: string }>;
}) {
  const { error, reconnect } = await searchParams;
  const message = MESSAGES[error ?? (reconnect ? "reconnect" : "")];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-16">
      <div className="flex items-center gap-2.5">
        <Logo size={36} />
        <span className="font-heading text-xl font-bold tracking-tight">Fork Lesson</span>
      </div>
      <div className={`${card} flex flex-col gap-5 p-6`}>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-tight">Don&apos;t rebuild a lesson a colleague already made.</h1>
          <p className="text-muted">
            Browse lessons from teachers in your district, then fork one into your own Google Classroom class as a
            draft.
          </p>
        </div>
        {message && (
          <p role="alert" className={alertError}>
            {message}
          </p>
        )}
        <SignInButton />
      </div>
    </main>
  );
}
