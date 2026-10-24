"use client";

import { useState } from "react";
import { SIGN_IN_SCOPES } from "@/lib/google/scopes";
import { createClient } from "@/lib/supabase/client";

export function SignInButton() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setBusy(true);
    setFailed(false);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: SIGN_IN_SCOPES,
        // offline + consent make Google return a refresh token every time.
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setBusy(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="rounded-md bg-black px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      {failed && <p className="text-sm text-red-700">Couldn&apos;t start sign-in. Please try again.</p>}
    </div>
  );
}
