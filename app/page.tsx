import { redirect } from "next/navigation";

// /lessons is protected, so signed-out visitors end up on /login.
export default function Home() {
  redirect("/lessons");
}
