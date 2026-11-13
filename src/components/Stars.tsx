export default function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating || 0);
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((i) => (i <= full ? <span key={i}>★</span> : <span key={i} className="off">★</span>))}
    </span>
  );
}
