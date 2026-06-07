const STYLES = {
  pending:   'bg-amber-50 text-amber-600 border border-amber-400',
  approved:  'bg-jade/10 text-jade border border-jade/30',
  rejected:  'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
  completed: 'bg-blue-50 text-blue-600 border border-blue-200',
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] || 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}
