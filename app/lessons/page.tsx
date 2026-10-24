import { getAccessToken } from "@/lib/google/access-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

// Placeholder until sync lands: shows the signed-in teacher and whether the
// saved Google connection works. Never shows a token.
export default async function LessonsPage() {
  const user = (await getUser())!;
  const admin = createAdminClient();

  const [{ data: profile }, { data: tokenRow }, google] = await Promise.all([
    admin.from("users").select("name, email, domain").eq("id", user.id).maybeSingle(),
    admin.from("google_tokens").select("scopes, updated_at").eq("user_id", user.id).maybeSingle(),
    getAccessToken(user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">My lessons</h1>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        <dt className="text-zinc-500">Signed in as</dt>
        <dd>{profile?.name ?? "(no name)"} · {profile?.email ?? user.email}</dd>
        <dt className="text-zinc-500">Sharing domain</dt>
        <dd>{profile?.domain ?? "not saved"}</dd>
        <dt className="text-zinc-500">Refresh token</dt>
        <dd>
          {tokenRow
            ? `saved, encrypted (${tokenRow.scopes.length} scopes, ${new Date(tokenRow.updated_at).toLocaleString()})`
            : "not saved"}
        </dd>
        <dt className="text-zinc-500">Google connection</dt>
        <dd>{google.status === "ok" ? "working" : `${google.status}: ${google.reason}`}</dd>
      </dl>
      <p className="text-sm text-zinc-500">Sync and lessons come next.</p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
          Sign out
        </button>
      </form>
    </main>
  );
}
