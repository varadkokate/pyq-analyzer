const WATERMARK_TEXT = 'pyq-analyzer-by-vk';

function WatermarkTileGrid({ isPrint = false }: { isPrint?: boolean }) {
  const rows = isPrint ? 6 : 6;
  const cols = isPrint ? 3 : 4;
  const cells = Array.from({ length: rows * cols }, (_, i) => i);

  return (
    <div
      className={`w-[150vw] h-[150vh] -translate-x-[18vw] -translate-y-[15vh] grid ${
        isPrint ? 'grid-cols-3 gap-y-24 gap-x-10' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-24 gap-x-12'
      } items-center justify-items-center -rotate-[24deg]`}
    >
      {cells.map((idx) => (
        <span
          key={idx}
          className={
            isPrint
              ? 'font-mono text-lg font-semibold tracking-wider text-slate-900 opacity-[0.075] whitespace-nowrap select-none'
              : 'font-mono text-base sm:text-lg font-semibold tracking-wider text-slate-900 dark:text-slate-100 opacity-[0.045] dark:opacity-[0.055] whitespace-nowrap select-none'
          }
        >
          {WATERMARK_TEXT}
        </span>
      ))}
    </div>
  );
}

export function WatermarkOverlay() {
  return (
    <>
      {/* Transparent screen watermark across the website */}
      <div
        aria-hidden="true"
        className="no-print pointer-events-none select-none fixed inset-0 z-20 overflow-hidden flex items-center justify-center"
      >
        <WatermarkTileGrid />
      </div>

      {/* Transparent print/PDF watermark repeating on every exported page */}
      <div
        aria-hidden="true"
        className="print-only print-watermark-layer pointer-events-none select-none items-center justify-center"
      >
        <WatermarkTileGrid isPrint />
      </div>
    </>
  );
}
