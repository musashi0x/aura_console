import type { ReactNode } from "react";

/**
 * Empty is a state, not an absence. It always names what is missing and what
 * the operator can do, which is why body and action are not optional in
 * practice even though action is typed as such.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__body">{body}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
