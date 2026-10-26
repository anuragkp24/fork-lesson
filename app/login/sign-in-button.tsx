"use client";

import { useState } from "react";
import { SIGN_IN_SCOPES } from "@/lib/google/scopes";
import { createClient } from "@/lib/supabase/client";
import { btnSecondary } from "@/lib/ui";

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
        className={`${btnSecondary} w-full gap-2.5 border-[#d7dcd9]`}
      >
        <span aria-hidden="true" className="text-lg font-bold text-[#4285f4]">
          G
        </span>
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      {failed && <p className="text-sm text-danger">Couldn&apos;t start sign-in. Please try again.</p>}
    </div>
  );
}
