// Cloudflare Turnstile (the human check on public forms), loaded on demand from challenges.cloudflare.com.
interface Window {
  turnstile?: {
    render: (
      el: HTMLElement,
      opts: { sitekey: string; callback: (t: string) => void; "expired-callback"?: () => void },
    ) => string;
    reset: (id?: string) => void;
  };
}
