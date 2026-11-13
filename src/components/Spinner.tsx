export default function Spinner({ label }: { label?: string }) {
  return <div className="spinner" aria-label={label || 'Loading'} />;
}
