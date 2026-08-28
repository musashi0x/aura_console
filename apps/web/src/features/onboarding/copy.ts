/**
 * All onboarding strings live here so the UX spec's microcopy rules are
 * reviewable in one place: domain language, never "Aura thinks", and every
 * failure names its owning domain.
 */
export const copy = {
  welcome: {
    title: "Aura Console",
    lead: "Your agent remembers what it spent, and why.",
    body: "Aura is an economic decision layer for autonomous agents. The Console is where you give an agent an objective, see which provider it chose and why, approve anything your policy gates, and inspect what it learned afterwards.",
    noSignIn:
      "There is no sign-in. v0.1 is a single-operator demo console running against a non-mainnet environment.",
    primary: "Check readiness",
    secondary: "Skip for now",
  },
  readiness: {
    title: "What is ready",
    body: "Aura checks each dependency it can reach and reports only what it verified. Anything it cannot check is listed as not checked rather than assumed.",
    primary: "Continue",
    secondary: "Skip for now",
    retry: "Retry",
  },
  disclosure: {
    title: "What Aura stores",
    body: "Read this before you start a Run.",
    points: [
      {
        heading: "Private relationship memory",
        text: "Aura records what your agent learned from its own validated economic interactions: which providers delivered, which failed, and how confident it is. This is private to your agent. It is not a public reputation score and it is never published.",
      },
      {
        heading: "What the agent can access",
        text: "The agent reads its own relationship memory and your operator policy when it evaluates a decision. It cannot read another operator's memory, and provider text can never write trust directly.",
      },
      {
        heading: "What reaches a counterparty",
        text: "Counterparties see public protocol identity and public job state only. Private episodes, profile bodies, raw evidence, deliverables, private policy values, credentials, and salts are never projected outward.",
      },
      {
        heading: "When you are asked to approve",
        text: "Policy decides whether an action runs automatically, needs your approval, or is denied. If required memory cannot be loaded, Aura never runs the action automatically.",
      },
    ],
    acknowledgeLabel: "I have read what Aura stores",
    storageNote:
      "This acknowledgement is stored in this browser only. It is not sent to a server and it is not a legal consent record.",
    primary: "Start using Aura",
    secondary: "Skip for now",
  },
  complete: {
    title: "You are set up",
    body: "Start a Run to give your agent an economic objective, or open the example Run to see a completed one first.",
    primary: "Start a Run",
    secondary: "View example run",
    exampleNote: "The example uses a fixture and is not live commerce.",
  },
  banner: {
    text: "First time here? Take a two minute tour of what Aura stores and what is ready.",
    action: "Open onboarding",
    dismiss: "Not now",
  },
} as const;
