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
8. Select an earlier event. The timeline holds at that point and labels itself
   `HISTORY` with the event's exact timestamp, then `Back to the end` returns to
   the final state. Do NOT say "pause": there is no Play or Pause control and
   nothing is running to pause.
9. Show a different future decision from restored memory.
10. Toggle Memory Off and show the counterfactual: no private relationship memory
   is exposed, and unavailable memory is not treated as history.
11. Show a recovery state for an unavailable dependency.

## What is demonstrable today

Steps 1 to 6 are implemented. `/runs` lists real Runs from the API, `/runs/new`
creates one, and `/runs/example` is a labelled fixture through the same fold.

What is NOT demonstrable: live updates and replay progression.

There is no stream, so every Run surface is a single read and says
`LATEST SNAPSHOT`. Do not narrate a Run as unfolding on screen, and do not
reload to imply it moved on its own.

Nothing advances the playhead on a timer either, so there is no Play or Pause to
press. What replaces them in the demo is scrubbing: select an event, the
timeline holds there under a `HISTORY` label carrying that event's timestamp,
and the return control brings it back. Describe that as inspecting a recording,
never as playing one.

The landing Console window remains a labelled static preview. Its `LIVE` and
`PAUSED` chips are illustration, not the Console's transport vocabulary; if the
audience asks, say so rather than letting the landing set an expectation the
product does not meet.

## Presentation rules

The demo should disclose that it is non-mainnet and single-operator. Never imply
that a UI click authorized a payment, created a workspace, authenticated a user,
or persisted legal consent. If a dependency is unavailable, show the recovery
state and explain what was actually verified.
