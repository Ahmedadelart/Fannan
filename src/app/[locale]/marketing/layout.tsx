import { StagingBar } from "@/components/StagingBar";

export default function MarketingLayout({ children }: LayoutProps<"/[locale]/marketing">) {
  return (
    <>
      <StagingBar />
      {children}
    </>
  );
}
