/** ConnectHealth mark: two connected nodes over a pulse line. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0f766e" />
      <path d="M5 18h5l2.5-6 4 11 2.5-5H27" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="9" r="2.2" fill="#99f6e4" />
      <circle cx="22" cy="9" r="2.2" fill="#99f6e4" />
      <path d="M12.2 9h7.6" stroke="#99f6e4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ sub }: { sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <div>
        <p className="text-sm font-semibold tracking-tight text-slate-900">
          Connect<span className="text-teal-700">Health</span>
        </p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}
