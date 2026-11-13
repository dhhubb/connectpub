import { statusClass } from '@/lib/client/format';

export default function Badge({ status, label, className }: { status: string; label: string; className?: string }) {
  return <span className={'badge ' + (className || statusClass(status))}>{label}</span>;
}
