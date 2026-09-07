"use client";

export type PropRow = {
  prop: string;
  type: string;
  default?: string;
};

/**
 * The standard Prop / Type / Default table used by every catalog page.
 */
export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-raised">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted">Prop</th>
            <th className="px-4 py-2 text-left font-medium text-muted">Type</th>
            <th className="px-4 py-2 text-left font-medium text-muted">Default</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.prop}>
              <td className="px-4 py-2 font-mono text-[13px] text-ink">{row.prop}</td>
              <td className="px-4 py-2 font-mono text-[13px] text-muted">{row.type}</td>
              <td className="px-4 py-2 font-mono text-[13px] text-muted">
                {row.default ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
