import { withAuth } from "@workos-inc/authkit-nextjs";
import { AuthenticatedHomeRedirect } from "@/components/auth/AuthenticatedHomeRedirect";
import { BrandLogo } from "@/components/ui/BrandLogo";

export default async function HomePage() {
  const { user, organizationId } = await withAuth();

  if (user && organizationId) {
    return <AuthenticatedHomeRedirect organizationId={organizationId} />;
  }

  return (
    <div className="dark">
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#0d0c0a] blueprint-grid">
        {/* Amber hairline that sweeps left-to-right */}
        <div className="login-scan-line" aria-hidden="true" />

        {/* Radial vignette — pulls focus to center */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(13,12,10,0.6) 100%)",
          }}
        />

        {/* Center composition */}
        <div className="corner-accent relative z-10 flex flex-col items-center gap-7 px-12 py-14">
          {/* Category label */}
          <p
            className="font-mono text-[0.625rem] tracking-[0.22em] uppercase text-[#d4b454]/50 animate-fade-in"
            style={{ animationDelay: "0ms" }}
          >
            Release Coordination
          </p>

          {/* Wordmark */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "60ms" }}
          >
            <BrandLogo
              variant="dark-mode"
              className="w-52 sm:w-60"
              priority
            />
          </div>

          {/* Tagline */}
          <p
            className="text-[#8a8078] text-[0.8125rem] tracking-[0.02em] text-center max-w-[42ch] leading-relaxed animate-fade-in"
            style={{ animationDelay: "110ms" }}
          >
            Coordinate releases. Eliminate deployment chaos.
          </p>

          {/* CTAs */}
          <div
            className="flex items-center gap-3 mt-1 animate-fade-up"
            style={{ animationDelay: "170ms" }}
          >
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-[2px] bg-[#f5f4f1] px-8 py-4 text-[0.8125rem] font-medium tracking-wide text-[#0d0c0a] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(212,180,84,0.3),0_2px_12px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4b454] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0c0a]"
            >
              Sign in
            </a>
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-[2px] border border-[#2a2825] px-8 py-4 text-[0.8125rem] font-medium tracking-wide text-[#c8c2b8] transition-all duration-300 hover:border-[rgba(212,180,84,0.35)] hover:bg-[rgba(212,180,84,0.06)] hover:text-[#f5f4f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4b454] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0c0a]"
            >
              Create account
            </a>
          </div>
        </div>

        {/* Product identifier */}
        <div
          className="absolute bottom-6 right-6 animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <span className="font-mono text-[0.5625rem] tracking-[0.14em] uppercase text-[#2a2825]">
            Titan Rollouts
          </span>
        </div>
      </main>
    </div>
  );
}
