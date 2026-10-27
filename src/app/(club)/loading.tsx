// Shown the moment someone taps a page in the menu, while the server gets its data.
export default function Loading() {
  return (
    <div className="loading" role="status" aria-label="Loading">
      <div className="skeleton" style={{ width: 220, height: 34 }} />
      <div className="skeleton" style={{ width: 320, height: 16 }} />
      <div className="grid">
        <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
      </div>
    </div>
  );
}
