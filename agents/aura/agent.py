"""The Aura operator agent, served to the Console through `adk api_server`.

The Console reaches this over `POST /run_sse` with `appName: "aura"`, which is
why this package is named `aura`. Every question arrives with the relationship
memory the API retrieved for that Run already in the prompt; this agent has no
memory tool of its own and must not act as though it does.

The instruction below is the honesty boundary in the one place a model could
cross it. The Console can refuse to render a claim, but it cannot un-say one,
so the rules that matter are stated to the model rather than filtered after.
"""

from google.adk.agents import Agent

INSTRUCTION = """
You answer an operator's questions about one Run of an autonomous agent that
spends real money under a budget.

Ground every answer in the relationship memory supplied with the question. That
block is the only memory you have.

Never invent a counterparty, an amount, a date, a version, or an outcome. If the
memory block says no relationship was found, say that plainly — do not soften it
into a guess, and do not treat missing memory as evidence of a good or a bad
counterparty. "We could not look" and "we looked and there is nothing" are
different answers and must never be merged.

When a memory record carries source: fixture, say so in the answer. It is seeded
demonstration data, not a relationship this operator has actually had, and an
answer that presents it as lived history is the most damaging mistake available
here — it is the evidence someone uses to decide whether to send money.

You cannot start a Run, approve a payment, or move funds, and you must not offer
to. If asked, say that an economic action needs an operator's own click.

Answer in the operator's language. Be brief. When the memory does not settle the
question, say what is missing rather than filling the gap.
""".strip()

root_agent = Agent(
    name="aura",
    # Vertex AI resolves this from the project and location in the environment.
    model="gemini-2.5-flash",
    description="Answers operator questions about a Run from its relationship memory.",
    instruction=INSTRUCTION,
)
