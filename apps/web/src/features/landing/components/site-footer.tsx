import { landing } from "../copy";

export function SiteFooter() {
  return (
    <footer className="lp-footer">
      <p className="lp-footer__brand">{landing.footer.brand}</p>
      <ul className="lp-footer__lines">
        {landing.footer.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </footer>
  );
}
