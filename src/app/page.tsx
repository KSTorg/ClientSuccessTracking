export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-20 bg-kst-black">
      <h1
        className="text-6xl md:text-7xl text-kst-gold text-center mb-10 tracking-tight font-display"
        style={{ fontFamily: "var(--font-display)" }}
      >
        KST Tracker
      </h1>

      <div className="glass-panel max-w-xl w-full p-10 text-center">
        <p className="text-kst-white text-lg mb-3">Client Success Tracking</p>
        <p className="text-kst-muted text-sm leading-relaxed">
          A premium dashboard for tracking client engagements, milestones,
          and success metrics. Sign in to view your portfolio.
        </p>
      </div>

      <button
        type="button"
        className="mt-10 px-8 py-3 rounded-full bg-kst-gold text-kst-black font-semibold tracking-wide hover:bg-kst-gold-light transition-colors shadow-[0_8px_32px_rgba(201,168,76,0.25)]"
      >
        Get Started
      </button>
    </main>
  );
}
