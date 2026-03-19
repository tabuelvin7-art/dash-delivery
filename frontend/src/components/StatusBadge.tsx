const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  created:                      { bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400',  label: 'Created' },
  dropped_off_at_agent:         { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Dropped Off' },
  dispatched:                   { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Dispatched' },
  arrived_at_destination_agent: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Arrived' },
  out_for_delivery:             { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Out for Delivery' },
  delivered:                    { bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'Delivered' },
  pending:                      { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Pending' },
  paid:                         { bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'Paid' },
  failed:                       { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Failed' },
  active:                       { bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500',label: 'Active' },
  expired:                      { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Expired' },
  returned:                     { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Returned' },
  cancelled:                    { bg: 'bg-slate-100',  text: 'text-slate-600',  dot: 'bg-slate-400',  label: 'Cancelled' },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: status.replace(/_/g, ' ') };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
