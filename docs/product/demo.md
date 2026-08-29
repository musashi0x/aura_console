# Demo choreography

## The "wow" path

1. Open a fresh browser. `/` redirects to onboarding, because nothing is stored.
2. Walk the onboarding: what Aura Console is, and that there is no sign-in.
3. Show readiness. API and database are verified; policy and agent identity say
   **Not checked**, and that honesty is the point.
4. Acknowledge the disclosure and hand off. Return to `/` and let the landing
   page tell the story: one statement, three principles, the Console window.
5. Enter the Console from the landing page. The shell names the environment as
   non-mainnet, reports readiness from the live check, and shows each surface
   without a data source as explicitly unavailable rather than empty.
6. Open the example Run so the audience sees a populated timeline.
7. Walk left to right through **Evidence → Decision Context → Economic Action
   boundary → Outcome → Memory Diff**.
8. Pause the Run, restart the worker, and show that the timeline remains
   replayable and state-labelled: live, paused, and history are distinct.
9. Show a different future decision from restored memory.
10. Toggle Memory Off and show the counterfactual: no private relationship memory
   is exposed, and unavailable memory is not treated as history.
11. Show a recovery state for an unavailable dependency.

## What is demonstrable today

Steps 1 to 5 are implemented. Step 6 onward depends on the run skeleton
(task #30); the Run destinations render the shell and an explicit unavailable
state, and the landing Console window is a labelled static preview. Do not demo
them as live.

## Presentation rules

The demo should disclose that it is non-mainnet and single-operator. Never imply
that a UI click authorized a payment, created a workspace, authenticated a user,
or persisted legal consent. If a dependency is unavailable, show the recovery
state and explain what was actually verified.
