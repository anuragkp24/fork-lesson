import { WelcomeFrame } from "@/components/welcome-frame";
import { alertError } from "@/lib/ui";
import { SignInButton } from "./sign-in-button";

const MESSAGES: Record<string, string> = {
  scopes: "Fork Lesson needs all permissions to copy your lessons and files. Please try again and leave every box ticked.",
  reconnect: "Google didn't give Fork Lesson a lasting connection. Please sign in again and approve everything.",
  denied: "Sign-in was cancelled or Google declined it. Please try again.",
  failed: "Something went wrong while signing in. Please try again.",
};

// Onboarding screen 1: what Fork Lesson is and what it does with the Google
// account, before anything runs.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reconnect?: string }>;
}) {
  const { error, reconnect } = await searchParams;
  const message = MESSAGES[error ?? (reconnect ? "reconnect" : "")];

  return (
    <WelcomeFrame step={1}>
      <h1 className="text-[22px] font-bold leading-tight">Use lessons your colleagues already taught</h1>
      <p className="text-muted">
        Find a lesson from a teacher in your district, and copy it into your own Google Classroom class as a draft,
        files included.
      </p>
      <div className="rounded-[10px] bg-[#f6f8f7] px-3.5 py-3 text-[13px]">
        <p className="font-bold">What Fork Lesson does with your Google account</p>
        <ul className="ml-[18px] mt-1.5 list-disc">
          <li className="my-1">Reads your classes and posted assignments.</li>
          <li className="my-1">
            Only for classes you choose to share: puts a <b>copy</b> of their files in a &ldquo;Fork Lesson library&rdquo;
            folder that teachers in your district can view. Your originals are never changed.
          </li>
          <li className="my-1">Never reads student work, grades or rosters.</li>
        </ul>
      </div>
      {message && (
        <p role="alert" className={alertError}>
          {message}
        </p>
      )}
      <SignInButton />
    </WelcomeFrame>
  );
}
