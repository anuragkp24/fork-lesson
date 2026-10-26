import Link from "next/link";
import { after } from "next/server";
import { initials } from "@/lib/initials";
import { createClient, getUser } from "@/lib/supabase/server";
import { syncIfStale } from "@/lib/sync/auto";
import { btnSecondary } from "@/lib/ui";
import { Logo } from "./logo";

export async function AppHeader({ current }: { current: "lessons" | "library" | null }) {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = user
    ? await supabase.from("users").select("name, email, domain").eq("id", user.id).maybeSingle()
    : { data: null };

  // Every signed-in page keeps the teacher's library current: after the page
  // is sent, sync in the background if the last sync is over 30 minutes old.
  // syncIfStale never throws, and nothing here waits for it.
  if (user && profile?.domain) {
    const domain = profile.domain;
    after(() => syncIfStale(user.id, domain, "visit"));
  }

  const tab = (active: boolean) =>
    `inline-flex min-h-11 items-center border-b-2 px-1 text-[15px] font-semibold ${
      active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-6 px-5">
        <Link href="/library" className="flex items-center gap-2.5 py-3">
          <Logo />
          <span className="font-heading text-lg font-bold tracking-tight">Fork Lesson</span>
        </Link>

        <nav className="flex flex-1 items-center gap-5" aria-label="Main">
          <Link href="/library" className={tab(current === "library")} aria-current={current === "library" ? "page" : undefined}>
            Library
          </Link>
          <Link href="/lessons" className={tab(current === "lessons")} aria-current={current === "lessons" ? "page" : undefined}>
            My lessons
          </Link>
        </nav>

        <details className="relative">
          <summary
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand [&::-webkit-details-marker]:hidden"
            aria-label="Account menu"
          >
            {initials(profile?.name, profile?.email ?? user?.email)}
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-3 rounded-card border border-line bg-white p-4 shadow-lg">
            <div className="text-sm">
              <p className="font-semibold">{profile?.name ?? "Signed in"}</p>
              <p className="break-all text-muted">{profile?.email ?? user?.email}</p>
              {profile?.domain && <p className="text-muted">Sharing with {profile.domain}</p>}
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className={`${btnSecondary} w-full`}>
                Sign out
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
