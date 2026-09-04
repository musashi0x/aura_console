# Demo choreography

The demo is one Mission telling one story. It is not a tour of five screens.

## The story the walkthrough has to land

```text
You asked → Aura remembered → Aura investigated → Aura chose
          → You approved → Agents acted → Money moved
          → The result arrived → Aura learned
```

Nine beats, one screen. If the audience has to be told which panel to look at
next, the workspace has failed and no narration will rescue it.

## The "wow" path

1. Open a fresh browser. `/` redirects to onboarding, because nothing is stored.
2. Walk the onboarding: what Aura Console is, and that there is no sign-in.
3. Show readiness. API and database are verified; policy and agent identity say
   **Not checked**, and that honesty is the point.
4. Acknowledge the disclosure and hand off. Return to `/` and let the landing
   page tell the story: one statement, three principles, the Console window.
5. Enter the Console. The rail names the environment as non-mainnet, reports
   readiness from the live check, and shows any surface without a data source as
   explicitly unavailable rather than empty.
6. Open the demo Mission. It opens in **Operator**: the objective, the progress
   rail, and the conversation that produced it.
7. **You asked.** The opening intent, in the operator's own words.
8. **Aura remembered.** The Memory Recall card names what Sibyl returned and
   whether it changed the ranking. Open the memory drawer: what was remembered,
   what it was used for, which Missions it came from.
9. **Aura investigated and chose.** The Comparison card, then the Decision card
   with its two or three highest-impact reasons. Press `Why this?` and show that
   the evidence sits next to the claim, not in a separate stage.
10. **The counterfactual.** Press `Compare without memory`. With Sibyl, one
    agent is selected; without it, a different one. Name the penalty that moved.
    This is the fastest proof that memory is load-bearing, and it takes five
    seconds rather than two minutes of architecture.
11. **You approved.** The Approval card carries the exact action and the maximum
    spend. Say plainly that nothing settles without this click.
12. **Agents acted, money moved, the result arrived.** Agent Job, Transaction,
    Outcome cards, in the conversation, in order.
13. **Aura learned.** The Memory Diff card: before and after aligned, direction
    in text and number, each change linked to its evidence.
14. Switch to **Board**. Same Mission, same events, four columns. Select a card
    and Operator scrolls to the event that created it.
15. Switch to **Trace**. The raw lifecycle events, receipts and tool calls
    behind everything just shown. This is the reviewer's view, and the moment
    to say that nothing on the product surface was written by a model.
16. Show a recovery state for an unavailable dependency.

## What is demonstrable today

**Steps 1 to 6 only, and step 6 in its old form.** `/runs` lists real Runs from
the API, `/runs/new` creates one, and `/runs/example` is a labelled fixture
through the same fold. There is no Mission workspace yet: no Operator, Board or
Trace, no composer, and none of the cards. Steps 7 to 15 describe the target,
not a recording that can be played today. See
[Mission workspace](mission-workspace.md#what-exists-today).

Until the workspace exists, step 6 is the current Run timeline: a list of events
with a scrubbable playhead.

What is NOT demonstrable, and will not be until the endpoints land:

**Live updates.** There is no stream, so every Mission surface is a single read
and says `LATEST SNAPSHOT`. Do not narrate a Mission as unfolding on screen, and
do not reload to imply it moved on its own.

**Replay progression.** Nothing advances the playhead on a timer, so there is no
Play or Pause to press. What replaces them is scrubbing: select an event, the
timeline holds there under a `HISTORY` label carrying that event's timestamp,
and the return control brings it back. Describe that as inspecting a recording,
never as playing one.

**Memory, the drawer, and the counterfactual.** These need memory retrieval
(tracker #32). Until it exists there are no records to recall, so steps 8 and 10
cannot be shown at all — not with placeholder data, and not with a mocked
client. A faked memory record would break the one claim the demo exists to make.

The landing Console window remains a labelled static preview. Its `LIVE` and
`PAUSED` chips are illustration, not the Console's transport vocabulary; if the
audience asks, say so rather than letting the landing set an expectation the
product does not meet.

## Presentation rules

The demo discloses that it is non-mainnet and single-operator. Never imply that
a UI click authorized a payment, created a workspace, authenticated a user, or
persisted legal consent.

Two rules specific to the workspace:

- **Never claim memory changed a decision unless the counterfactual differs.**
  `Memory checked, recommendation unchanged` is a real result and a good one to
  show; it proves the check ran without inventing an effect.
- **Never present a card as something the agent said.** Cards are folded from
  events. That is the whole reason a reviewer can trust them, and it is worth
  saying out loud when Trace is open.

If a dependency is unavailable, show the recovery state and explain what was
actually verified.
