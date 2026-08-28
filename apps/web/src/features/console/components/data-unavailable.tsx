import Link from "next/link";

import { EmptyState, MonoRef } from "@/components/primitives";

/**
 * The honest state for a surface whose data source does not exist yet.
 *
 * This is not an error and not an empty result: Aura has not asked anything,
 * because there is nothing to ask. Saying "no runs yet" here would claim a
 * verified empty list that was never fetched.
 */
export function DataUnavailable({
  title,
  body,
  owner,
}: {
  title: string;
  body: string;
  owner: string;
}) {
  return (
    <EmptyState
      title={title}
      body={body}
      action={
        <span className="cs__owner">
          <MonoRef label="TRACKED BY">{owner}</MonoRef>
          <Link href="/system" className="cs__link">
            Check system readiness
          </Link>
        </span>
      }
    />
  );
}
