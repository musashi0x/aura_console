import Link from "next/link";

import { console_ } from "../copy";

/**
 * Only destinations that exist. There is no account menu, organisation
 * switcher, or workspace switcher, because v0.1 has none of those things and a
 * control implying otherwise would misrepresent the product.
 */
export function ConsoleNavigation({ surface }: { surface: string }) {
  const isCurrent = (label: string) => (surface === label ? "page" : undefined);

  return (
    <nav className="cs__nav" aria-label={console_.nav.label}>
      <ul className="cs__nav-list">
        {console_.nav.primary.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="cs__nav-link"
              aria-current={isCurrent(item.label)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <ul className="cs__nav-list cs__nav-list--secondary">
        {console_.nav.secondary.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="cs__nav-secondary"
              aria-current={isCurrent(item.label)}
            >
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <Link href={console_.nav.back.href} className="cs__nav-secondary cs__nav-back">
            {console_.nav.back.label}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
