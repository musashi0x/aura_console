import axe from "axe-core";

/** Fails with the rule ids and the offending markup, not just a count. */
export async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: { region: { enabled: false } },
  });

  if (results.violations.length > 0) {
    const detail = results.violations
      .map((violation) => `${violation.id}: ${violation.help}\n  ${violation.nodes.map((n) => n.html).join("\n  ")}`)
      .join("\n");
    throw new Error(`Accessibility violations:\n${detail}`);
  }
}
