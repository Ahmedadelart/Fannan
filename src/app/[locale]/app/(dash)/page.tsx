import { redirect } from "next/navigation";

// Round 4, stage B: the editor is the app. Its Home panel shows what this page used to.
export default function AppHome() {
  redirect("/editor");
}
