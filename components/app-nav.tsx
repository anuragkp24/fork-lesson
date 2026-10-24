import Link from "next/link";

export function AppNav({ current }: { current: "lessons" | "library" | null }) {
  const link = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active ? "bg-zinc-100 font-medium dark:bg-zinc-800" : "text-zinc-600 dark:text-zinc-400"}`;
  return (
    <nav className="flex items-center gap-2 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <span className="mr-4 font-semibold">Fork Lesson</span>
      <Link href="/lessons" className={link(current === "lessons")}>
        My lessons
      </Link>
      <Link href="/library" className={link(current === "library")}>
        Library
      </Link>
    </nav>
  );
}
