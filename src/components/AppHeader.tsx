import Link from "next/link";

type Props = {
  ethJpy: number;
  fetchedAtFull: string;
};

function jpyCompact(n: number): string {
  try {
    const m = n / 1_000_000;
    const s = m.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    return `${s}M`;
  } catch {
    const m = Math.round((n / 1_000_000) * 1000) / 1000;
    return `${m.toFixed(3)}M`;
  }
}

export default function AppHeader({ ethJpy, fetchedAtFull }: Props) {
  return (
    <header
      // ref={ref}
      className="fixed top-0 left-0 right-0 z-50 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50"
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="font-semibold leading-tight">
          <span>NOT A HOTEL</span>
          <span className="mx-1 hidden sm:inline">-</span>
          <br className="sm:hidden" />
          <span>KEY SCOUT</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm flex-wrap justify-end">
          <Link href="/about" className="underline">
            About
          </Link>
          <a
            href="https://github.com/nasjp/nah-key-scout"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            GitHub
          </a>
          <span
            className="text-[11px] opacity-80 whitespace-nowrap rounded border px-2 py-0.5 bg-white/40"
            title={`1 ETH = 約${jpyCompact(ethJpy)} / 取得: ${fetchedAtFull}`}
          >
            ETH/JPY {jpyCompact(ethJpy)}
          </span>
        </nav>
      </div>
    </header>
  );
}
