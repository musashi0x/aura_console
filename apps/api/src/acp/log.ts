/**
 * One JSON line per event, the same shape the HTTP server already emits.
 *
 * This lives on its own because three call sites needed it and two of them are
 * on opposite sides of the module: the inbound bridge and the outbound spender
 * must not depend on each other, so neither can own the type the other imports.
 */
export type AcpLogger = (
  level: "info" | "error",
  msg: string,
  fields?: Record<string, unknown>,
) => void;

export const jsonLogger: AcpLogger = (level, msg, fields = {}) => {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
};
