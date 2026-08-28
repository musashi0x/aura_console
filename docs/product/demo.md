# Demo choreography

## The "wow" path

1. Open a fresh browser. `/` redirects to onboarding, because nothing is stored.
2. Walk the onboarding: what Aura Console is, and that there is no sign-in.
3. Show readiness. API and database are verified; policy and agent identity say
   **Not checked**, and that honesty is the point.
4. Acknowledge the disclosure and hand off. Return to `/` and let the landing
   page tell the story: one statement, three principles, the Console window.
5. Open the example Run so the audience sees a populated timeline.
6. Walk left to right through **Evidence → Decision Context → Economic Action
   boundary → Outcome → Memory Diff**.
7. Pause the Run, restart the worker, and show that the timeline remains
   replayable and state-labelled: live, paused, and history are distinct.
8. Show a different future decision from restored memory.
9. Toggle Memory Off and show the counterfactual: no private relationship memory
   is exposed, and unavailable memory is not treated as history.
10. Show a recovery state for an unavailable dependency.

## What is demonstrable today

Steps 1 to 4 are implemented. Steps 5 onward depend on the Console shell
(task #44) and the run skeleton (task #30); the Run destinations are currently
labelled placeholders and the landing Console window is a labelled static
preview. Do not demo them as live.

## Presentation rules

The demo should disclose that it is non-mainnet and single-operator. Never imply
that a UI click authorized a payment, created a workspace, authenticated a user,
or persisted legal consent. If a dependency is unavailable, show the recovery
state and explain what was actually verified.
