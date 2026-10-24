import { GoogleApiError } from "./classroom";

// A short, safe description of a failure for the UI and logs: the HTTP status
// and Google's status word, never a response body.
export function describeFailure(err: unknown): string {
  if (err instanceof GoogleApiError) return `Google said ${err.message.replace("Google API ", "")}`;
  if (err instanceof Error && err.message === "unsupported_type") return "This kind of file can't be copied";
  return "Unexpected error";
}
