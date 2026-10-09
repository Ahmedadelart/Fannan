import { redirect } from "next/navigation";
import { loadGuide } from "@/lib/server/guide";
import { getSession } from "@/lib/server/session";

// Round 4, stage B: the editor is the app. Its Home panel shows what this page used to.
// Round 8: the first time, people choose between the guided setup and designing it themselves.
export default async function AppHome() {
  const session = await getSession();
  if (session && !(await loadGuide(session.uid)).offered) redirect("/guide/start");
  redirect("/editor");
}
