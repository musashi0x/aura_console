// Refuses installs from anything but pnpm. Runs as the root preinstall script.
const agent = process.env.npm_config_user_agent ?? "";
const manager = agent.split("/")[0];

if (manager && manager !== "pnpm") {
  console.error(
    [
      "",
      `  This repository uses pnpm. Detected: ${manager}.`,
      "",
      "  Install pnpm, then run:",
      "    corepack enable && pnpm install",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
