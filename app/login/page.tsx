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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Fork Lesson</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Share a Google Classroom lesson with the teachers in your school, or fork one of theirs into
        your own class.
      </p>
      {message && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {message}
        </p>
      )}
      <SignInButton />
    </main>
  );
}
