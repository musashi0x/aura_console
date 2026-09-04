import { console_ } from "./copy";
import { getMemoryViewEnabled, toggleMemoryView } from "./memory-view-state";

/**
 * One console command.
 *
 * `run` receives a navigate function and nothing else. There is deliberately
 * no shape here that can carry an amount, a counterparty or a Run to act on,
 * so "the console's command surface cannot spend" is a property of the type
 * rather than a rule every reviewer has to remember. The palette and the chat
 * both execute from this one registry, so a command can never exist in one and
 * not the other, and neither can gain a power the other lacks.
 */
export interface ConsoleCommand {
  id: string;
  label: string;
  group: string;
  /**
   * Phrases an operator might type in the chat. Matching is exact-substring on
   * these, not fuzzy: a near miss must fall through to being a question, never
   * fire a command the operator did not ask for.
   */
  aliases: readonly string[];
  run: (navigate: (href: string) => void) => void;
  /** Reported after the fact, describing only what actually happened. */
  done: () => string;
}

/** Every destination a command may reach. Nothing else is navigable from here. */
export const COMMAND_DESTINATIONS = [
  "/runs",
  "/runs/new",
  "/runs/example",
  "/system",
  "/policies",
  "/counterparties",
] as const;

const go = (href: (typeof COMMAND_DESTINATIONS)[number]) => (navigate: (h: string) => void) =>
  navigate(href);

export const CONSOLE_COMMANDS: readonly ConsoleCommand[] = [
  {
    id: "runs",
    label: console_.palette.commands.runs,
    group: console_.palette.groupNavigate,
    aliases: ["go to runs", "open runs", "show runs", "runs"],
    run: go("/runs"),
    done: () => console_.chat.did.navigated("Runs"),
  },
  {
    id: "new",
    label: console_.palette.commands.newRun,
    group: console_.palette.groupNavigate,
    aliases: ["start a run", "new run", "create a run"],
    run: go("/runs/new"),
    done: () => console_.chat.did.navigated("Start a Run"),
  },
  {
    id: "example",
    label: console_.palette.commands.example,
    group: console_.palette.groupNavigate,
    aliases: ["example run", "open example", "show me an example"],
    run: go("/runs/example"),
    done: () => console_.chat.did.navigated("Example Run"),
  },
  {
    id: "system",
    label: console_.palette.commands.system,
    group: console_.palette.groupNavigate,
    aliases: ["system health", "readiness", "system", "health"],
    run: go("/system"),
    done: () => console_.chat.did.navigated("Readiness"),
  },
  {
    id: "policies",
    label: console_.palette.commands.policies,
    group: console_.palette.groupNavigate,
    aliases: ["policies", "policy", "go to policies"],
    run: go("/policies"),
    done: () => console_.chat.did.navigated("Policies"),
  },
  {
    id: "counterparties",
    label: console_.palette.commands.counterparties,
    group: console_.palette.groupNavigate,
    aliases: ["counterparties", "counterparty", "providers"],
    run: go("/counterparties"),
    done: () => console_.chat.did.navigated("Counterparties"),
  },
  {
    id: "memory",
    label: console_.palette.commands.memoryToggle,
    group: console_.palette.groupView,
    aliases: ["memory off", "memory on", "toggle memory", "turn memory off", "turn memory on"],
    run: () => toggleMemoryView(),
    // Read AFTER the toggle, so the line reports the state that now exists
    // rather than the one the operator asked for.
    done: () => console_.chat.did.memory(getMemoryViewEnabled()),
  },
];

const normalise = (text: string) => text.trim().toLowerCase().replace(/[?.!,]+$/g, "");

/**
 * The command an operator's message asks for, or null.
 *
 * "memory on" and "memory off" are distinguished before the generic aliases so
 * a request for a specific state is not answered by a blind toggle. Everything
 * else requires the whole alias to be present: a message that merely mentions
 * "runs" in a sentence is a question about Runs, not an instruction to leave
 * the page the operator is reading.
 */
export function matchCommand(text: string): ConsoleCommand | null {
  const said = normalise(text);
  if (said.length === 0) return null;

  const memory = CONSOLE_COMMANDS.find((c) => c.id === "memory")!;
  if (said === "memory on" || said === "turn memory on") {
    return getMemoryViewEnabled() ? null : memory;
  }
  if (said === "memory off" || said === "turn memory off") {
    return getMemoryViewEnabled() ? memory : null;
  }

  for (const command of CONSOLE_COMMANDS) {
    if (said === normalise(command.label)) return command;
    for (const alias of command.aliases) {
      // Whole message, or the message with a leading verb. Substring matching
      // anywhere would turn "what do the policies say about refunds?" into a
      // navigation away from the answer.
      if (said === alias || said === `${alias} please`) return command;
    }
  }
  return null;
}
