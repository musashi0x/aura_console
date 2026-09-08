# Aura Console — Demo Video Rehearsal Script

**Target Duration**: 4 minutes 10 seconds (Strict Cap: < 5 minutes)  
**Theme**: *Build with Agents That Don't Forget* (Sibyl Labs Hackathon)  
**Recording Commit / Freeze Tag**: `hackathon-freeze-1` (Commit `e789de7`)  
**Design System**: Astryx Stone (`#111015` canvas, `#1b1b1f` surface, WCAG AA contrast)  
**Verification Multipliers**: Base Sepolia (+15%) & Virtuals Protocol ACP (+10%)  

---

## 1. Technical Setup & Screen Layout

* **Display Configuration**: Single 16:9 1080p / 4K monitor (1920×1080 canvas recording).
* **Split Layout**:
  - **Left 70%**: Browser window at [http://localhost:3000](http://localhost:3000) (125% zoom, dark mode, no browser tabs/bookmarks bar, notifications disabled).
  - **Right 30%**: Terminal window with high-contrast Menlo/Fira Code 16pt. Top pane showing `git rev-parse --short HEAD` (`e789de7`), ticking UTC clock (`while sleep 1; do date -u +"%Y-%m-%d %H:%M:%S UTC"; done`), and command prompt.
* **On-Screen Continuity Anchors**:
  - `ConsoleTopbar` in browser continuously displays the live commit SHA (`e789de7`) and real-time ticking UTC clock.
  - Terminal displays identical commit SHA and UTC clock.
* **Audio**: Professional cardioid microphone, synthesized Web Audio cues (`InteractionSounds.tsx`) audible on interactive clicks.
* **Mandatory Rule for Segment 1:40–3:10**: **ZERO CAMERA CUTS OR EDITS**. This segment is the continuous unedited proof of state survival across complete process termination and PostgreSQL event store wipe.

---

## 2. Minute-by-Minute Teleprompter & Choreography

### 0:00 – 0:20 | Segment 1: Problem Statement & Financial Guardrails
* **Visual**:
  - Left: Aura Console landing page (`/`) displaying the live Waitlist & Design Partner section, then navigating to `/runs`.
  - Right: Terminal showing `git rev-parse --short HEAD` (`e789de7`) and active UTC clock.
* **Action**:
  - Point to the mission statement on the screen.
  - Click "Launch Console" to reveal the Mission Workspace.
* **Spoken Narration**:
  > *"Autonomous AI agents are now spending real treasury funds, but today's agents forget who burned them. When an external agent delivers garbage or rugpulls a task, the buyer agent starts from zero memory next time and hires them again.*
  > 
  > *This is Aura Console: an autonomous procurement terminal where operators and AI agents collaborate under strict financial guardrails. Aura gives agents persistent relationship memory across five storage tiers using Sibyl—a local file-backed SQLite database with zero vector dependencies. Combined with cryptographic commitments on Base Sepolia and Virtuals Protocol ACP, every decision is deterministic, reproducible, and backed by verifiable events."*

---

### 0:20 – 1:40 | Segment 2: Session A — Mission Execution, Failure & Memory Write-Back
* **Visual**:
  - Left: Console at `/runs/new` and newly created mission run.
  - Right: Terminal listening in background.
* **Action**:
  1. Input prompt: `"Hire an autonomous market research agent to analyze Base L2 DEX volumes. Budget ceiling 25 USDC."` Click **Run Mission**.
  2. The Mission visualizer renders with `<StatusDot variant="info" isPulsing />`.
  3. Expand **Candidate Scoring**: Highlight the two evaluated candidates: `virtuals:agent:alpha` and `virtuals:agent:beta`.
  4. Point to the **Memory Recall Card**: Sibyl reports `NO_HISTORY` / 0 previous interactions for both.
  5. Show base scores: Alpha quotes 9.00 USDC (score 100); Beta quotes 9.50 USDC (score 95). Alpha wins the auction purely on price.
  6. Point to the **Spend Approval Card**: Spend is gated by Human-in-the-Loop policy. Click **Approve Spend (9.00 USDC)**. Web Audio confirmation sound chimes.
  7. The agent initiates Virtuals ACP job execution on Base Sepolia.
  8. Job deliverable arrives, but verifier evaluation fails: missing mandatory JSON schema fields.
  9. **Outcome Card**: Highlights `FAILED_EVALUATION` (counterparty execution failure).
  10. **Memory Diff Card**: Sibyl automatically writes back an episode. Alpha's Bayesian reliability drops from `0.50` to `0.33`, and status drops to `WATCH`.
  11. **On-Chain Commitment**: Salted Keccak256 hash committed to Base Sepolia calldata.
* **Spoken Narration**:
  > *"Let's start Session A. We dispatch an autonomous procurement mission: 'Hire an autonomous market research agent to analyze Base L2 DEX volumes, ceiling 25 USDC'.*
  > 
  > *Look at the Candidate Scoring card. Aura queries Sibyl's WARM tier. Neither candidate has prior history. Candidate Alpha quotes 9 USDC; Beta quotes 9.50 USDC. Alpha wins purely on price. Notice the Spend Approval card: under our policy guardrails, the agent cannot spend treasury autonomously—it requires an operator signature. I click Approve.*
  > 
  > *The job is funded via Virtuals Protocol ACP on Base Sepolia. Alpha returns a deliverable, but our verification gate inspects the schema: required fields are missing. The deliverable is rejected.*
  > 
  > *Immediately, the write-back loop fires: `recordEpisodeToSibyl` logs the failure into Sibyl's COLD journal, updates Alpha's Bayesian reliability in the WARM tier from 0.50 down to 0.33, and demotes its status to WATCH. Finally, a salted Keccak256 hash of this new memory state is committed to Base Sepolia."*

---

### 1:40 – 2:10 | Segment 3: Continuous Unedited Restart Proof (`pnpm demo:restart`)
* **Visual**:
  - **CRITICAL**: Camera framing remains rock steady. NO cuts, NO transitions.
  - Right terminal pane takes visual prominence.
  - Browser topbar remains visible showing commit SHA `e789de7` and UTC time.
* **Action**:
  1. Presenter points to terminal timestamp and topbar clock.
  2. Execute in terminal:
     ```bash
     pnpm demo:restart
     ```
  3. Terminal displays:
     ```text
     --> Wiping PostgreSQL event store (TRUNCATE TABLE run_events, runs CASCADE)...
     --> Applying database migrations...
     ✓ Postgres event store wiped clean.
     ✓ Persistent Sibyl memory database preserved at ~/.sibyl-memory/memory.db
     ```
  4. Refresh browser console at `/runs`. The list is completely empty (`0 runs`).
* **Spoken Narration**:
  > *"Now for the central proof of this hackathon: the continuous unedited restart boundary. Notice the UTC clock: ticking in real time, commit e789de7. No cuts from this moment onward.*
  > 
  > *In the terminal, we execute `pnpm demo:restart`. This drops and truncates the entire PostgreSQL database—every run, every event, every chat session is erased. The only artifact surviving on this machine is the persistent SQLite file at `~/.sibyl-memory/memory.db`.*
  > 
  > *Look at the console: we refresh `/runs`. Zero runs in PostgreSQL. The application has cold-started from an absolute blank slate."*

---

### 2:10 – 3:10 | Segment 4: Session B — Cold-Start Divergence (Beta over Alpha)
* **Visual**:
  - Left browser console: `/runs/new`.
  - Right terminal: Monitoring logs.
* **Action**:
  1. Submit the exact same mission objective: `"Hire an autonomous market research agent to analyze Base L2 DEX volumes. Budget ceiling 25 USDC."`
  2. The agent queries Sibyl WARM memory.
  3. Candidate Scoring card renders:
     - Alpha: Base price 9.00 USDC (base 100), but penalized by Sibyl memory: `status: WATCH` (-6 pts), `reliability: 0.33` (-7 pts) → Adjusted Score: 87.
     - Beta: Base price 9.50 USDC (base 95), no negative history → Adjusted Score: 95.
  4. **Winner**: Beta is selected!
  5. Click **"Compare without memory"**:
     - Counterfactual badge pops up: *"Memory changed this decision by -0.35"*.
     - Shows that without memory, Alpha would have won again on price alone.
  6. Hover over the `<Citation variant="number" />` tag:
     - Astryx `<HoverCard />` appears displaying Alpha's failed episode from Session A, exact failure reason, and timestamp.
* **Spoken Narration**:
  > *"Now Session B begins. We post the exact same prompt to the fresh process: 'Hire an autonomous market research agent'.*
  > 
  > *PostgreSQL knows nothing about Session A. But when Aura calls Sibyl's WARM tier, it retrieves Alpha's updated profile: reliability 0.33, status WATCH. Even though Alpha is cheaper, the Bayesian scoring engine applies a risk penalty. Candidate Beta Labs wins with a score of 95 versus Alpha's 87.*
  > 
  > *When we click 'Compare without memory', the counterfactual diff reveals the truth: without memory, Alpha would have won again. Persistent memory causally protected treasury funds from a repeat failure.*
  > 
  > *Hovering over the citation tag displays the Astryx HoverCard with the exact episode journal entry from Session A. The past is not forgotten."*

---

### 3:10 – 3:35 | Segment 5: Multi-Agent MCP Coordination
* **Visual**:
  - Right: Terminal window running an external agent CLI (Claude Code or MCP client).
* **Action**:
  1. External agent executes an MCP tool call against Aura's MCP server:
     ```bash
     mcp-call memory_recall_counterparty '{"counterpartyKey":"virtuals:agent:alpha"}'
     ```
  2. The MCP response returns structured JSON with Sibyl verdict codes:
     ```json
     {
       "counterpartyKey": "virtuals:agent:alpha",
       "relationshipStatus": "WATCH",
       "overallReliability": 0.33,
       "episodesCount": 1
     }
     ```
  3. External agent cites the failure episode from `memory_journal`.
* **Spoken Narration**:
  > *"Aura's memory is not trapped in this UI. External agents coordinate over the exact same SQLite database through our Model Context Protocol server.*
  > 
  > *Here, an independent Claude Code session calls `memory_recall_counterparty` for Alpha. It reads the WATCH status, the 0.33 reliability score, and cites the failure episode from the journal. Different process, different model, identical persistent truth."*

---

### 3:35 – 3:55 | Segment 6: Base Sepolia Verification & Deletion Test Audit
* **Visual**:
  - Terminal executing verification scripts; browser showing BaseScan block explorer.
* **Action**:
  1. In terminal, run:
     ```bash
     pnpm memory:verify virtuals:agent:beta 1
     ```
     Highlight: Exit code 0, 100% cryptographic match between Sibyl WARM profile, REFERENCE salt, and Base Sepolia transaction calldata.
  2. In terminal, run:
     ```bash
     pnpm demo:deletion-test
     ```
     Highlight the two halves:
     - Half A (without Sibyl): Halts into `[run.created, run.blocked]`.
     - Half B (with Sibyl): Completes `[run.created, memory.retrieved, candidate.scored, decision.made, approval.requested]`.
* **Spoken Narration**:
  > *"To independently audit the cryptographic chain, we run `pnpm memory:verify`. Aura reads the 32-byte salt from Sibyl's REFERENCE tier, recomputes the Keccak256 hash, and validates it against the transaction on Base Sepolia.*
  > 
  > *Next, our load-bearing deletion test: `pnpm demo:deletion-test`. When Sibyl memory is removed, the agent refuses to make blind financial allocations, failing closed into `run.blocked`. When memory is restored, it scores candidates and requests approval. Memory is strictly load-bearing."*

---

### 3:55 – 4:10 | Segment 7: Summary & Wrap-up
* **Visual**:
  - Full-screen view of Aura Console Mission Inspector, showing transaction hashes, environment tags, and GitHub repository URL.
* **Action**:
  - Highlight repo URL and MIT license.
* **Spoken Narration**:
  > *"Aura Console gives autonomous agents memory that protects capital. Built for the Sibyl Labs Hackathon on Base Sepolia and Virtuals Protocol. 100% open-source under MIT with full test suites. Thank you."*

---

## 3. Recording & Rehearsal Checklist

- [ ] **Reset Seed**: Run `pnpm demo:reset` before take 1 to ensure a clean baseline.
- [ ] **Continuous Uncut Segment**: Segment 1:40–3:10 MUST be recorded in one take without cuts.
- [ ] **Ticking Clock & SHA**: Verify `ConsoleTopbar` and terminal show `e789de7` and matching UTC clock.
- [ ] **Audio Levels**: Peak between -6dB and -12dB; Web Audio interaction chimes audible.
- [ ] **Resolution & Zoom**: 1080p 60fps, browser at 125% zoom, Astryx Stone dark theme.
- [ ] **Video Export**: Under 5 minutes (target 4:10). Add timestamp chapters to description.
- [ ] **Publishing**: Upload unlisted to YouTube/Loom, verify playback, publish as public.
