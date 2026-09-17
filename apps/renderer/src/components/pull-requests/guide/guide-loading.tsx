const pixels = Array.from({ length: 9 }, (_, index) => index);

export function GuideLoading() {
  return (
    <div className="flex min-h-80 items-center justify-center gap-3 text-sm text-text-secondary" role="status">
      <span aria-hidden="true" className="guide-loader">
        {pixels.map((pixel) => <span key={pixel} style={{ animationDelay: `${pixel * 90}ms` }} />)}
      </span>
      <span className="guide-loading-label">Loading review</span>
      <span className="sr-only">You can leave this tab while the guide is prepared.</span>
    </div>
  );
}
