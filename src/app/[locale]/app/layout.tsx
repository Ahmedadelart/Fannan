import { AuthProvider } from "@/components/auth/AuthProvider";
import { StagingBar } from "@/components/StagingBar";
import { firebaseEnv, firebaseWebConfig } from "@/config/firebase";

// Everything on app.fannan.net: sign-in is available here and only here.
export default function AppLayout({ children }: LayoutProps<"/[locale]/app">) {
  const env = firebaseEnv();
  return (
    <AuthProvider config={firebaseWebConfig(env)} env={env}>
      <StagingBar />
      {children}
    </AuthProvider>
  );
}
