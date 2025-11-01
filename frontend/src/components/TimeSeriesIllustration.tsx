export default function TimeSeriesIllustration({ className }: { className?: string }) {
  return (
    <div className={className ?? "w-full h-full flex items-center justify-center"}>
      <svg viewBox="0 0 520 360" width="100%" height="100%" className="chart">
        <defs>
          <linearGradient id="g1" x1="0" x2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#065F46" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="520" height="360" rx="12" fill="#fff" stroke="rgba(2,6,23,0.06)" />
        <path d="M20 280 L80 200 L140 220 L200 160 L260 180 L320 140 L380 160 L440 120 L500 140" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <g transform="translate(12,12)">
          <text x="8" y="18" fontSize="12" fill="#0f172a">Prévision (exemple)</text>
        </g>
      </svg>
    </div>
  );
}
