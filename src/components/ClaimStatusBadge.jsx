export default function ClaimStatusBadge({ status }) {
  const configs = {
    pending:  { label: 'Pending',  bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-400' },
    active:   { label: 'Active',   bg: 'bg-blue-500/20',   text: 'text-blue-400',   dot: 'bg-blue-400' },
    voting:   { label: 'Voting',   bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-400' },
    resolved: { label: 'Resolved', bg: 'bg-green-500/20',  text: 'text-green-400',  dot: 'bg-green-400' },
    disputed: { label: 'Disputed', bg: 'bg-red-500/20',    text: 'text-red-400',    dot: 'bg-red-400' },
  }
  const cfg = configs[status] || configs.pending

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
