export function AdminTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted"><tr>{head.map((h) => <th key={h} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminSearch({ placeholder, defaultValue, extra }: { placeholder: string; defaultValue?: string; extra?: React.ReactNode }) {
  return (
    <form className="flex flex-wrap gap-2" method="get">
      <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="h-10 min-w-56 flex-1 rounded-field border border-line bg-surface px-3 text-sm" />
      {extra}
      <button className="h-10 rounded-field bg-brand px-4 text-sm font-semibold text-white">Filtrar</button>
    </form>
  );
}
