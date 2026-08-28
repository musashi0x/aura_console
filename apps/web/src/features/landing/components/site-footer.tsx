import { landing } from "../copy";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer__brand">{landing.footer.brand}</p>
      <ul className="site-footer__lines">
        {landing.footer.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </footer>
  );
}
