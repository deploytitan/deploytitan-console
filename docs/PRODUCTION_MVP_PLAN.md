# DeployTitan Production MVP Plan

Last updated: 2026-06-20

## Product pain-point anchor

This plan must always be evaluated from the core customer pain, not from implementation convenience.

### The problem we are solving

Developer AI tools have dramatically increased the amount of code being written and shipped. Across teams, this means:

- more pull requests
- larger pull requests
- more repositories involved in each release
- more coordination overhead across services, teams, and stakeholders

This pain is amplified in existing B2B companies running legacy or mixed delivery stacks:

- AWS, GCP, on-prem, Jenkins, GitHub Actions, custom scripts
- microservice and microfrontend architectures
- fragmented ownership
- slow approval chains
- too many tabs and too many manual follow-ups

The core pain is **not** “writing code” or “summarizing code.”
The core pain is the **release phase of the SDLC after development is done**:

- choosing what ships
- packaging it into a release
- collecting approvals
- coordinating merge and deploy readiness
- monitoring the release window
- keeping stakeholders informed

### Our target user

The primary user is:

- a release manager
- a DevOps owner
- a platform engineer
- or whoever is operationally responsible for moving code into higher environments or production

Their workflow should become a near-invisible utility:

- onboard from MCP
- create org/project quickly
- search and select PRs
- create a release packet fast
- gather approvals from Slack
- merge with confidence
- monitor the release window
- alert stakeholders when something goes wrong

### Product principle

DeployTitan should feel invisible but essential.

Users should not feel like they are “using another dashboard.”
They should feel like their AI-native workflow now happens to include a trusted release coordination layer.

### Decision filter

When making product or engineering decisions, prefer the option that most improves:

1. reduced coordination overhead
2. reduced tab-switching and tool-switching
3. reduced release-manager busywork
4. faster onboarding into a working release flow
5. durability of release state, approvals, and operational memory

Avoid prioritizing work that is interesting technically but does not materially reduce release-phase friction for this user.

## Environment note

- `WORKOS_AUTHKIT_DOMAIN=https://rational-shelter-82-staging.authkit.app` is the **staging** AuthKit domain.
- Production must use a separate AuthKit domain and production resource indicator values.
- Do not hardcode staging-specific WorkOS values into production assumptions or docs.

## Current completion estimate

Estimated overall completion toward a polished production-grade MVP: **38%**

This is a practical product-delivery estimate, not a line-count estimate.

Rough breakdown:

- MCP surface and core backend scaffolding: **70%**
- Shared auth foundation: **55%**
- Billing abstraction and checkout scaffolding: **45%**
- Resumable onboarding foundation: **50%**
- Embedded help system foundation: **45%**
- Slack/GitHub/Grafana production hardening: **20%**
- Release tracker workflow polish: **35%**
- Production reliability, security, and test coverage: **15%**

## Scope definition

The target is a **polished production-grade release tracker MVP** that is:

- MCP-first
- WorkOS-authenticated across web and MCP
- low-friction to onboard
- usable by release managers through Claude Code/Codex
- usable by stakeholders through Slack approvals
- backed by provider-agnostic billing
- documented in-product through MCP help content

This MVP is **not yet** the full legacy-stack release control plane. We are preserving architecture for that future, but the immediate shipped product remains a release tracker and coordination utility.

### Scope guardrail

If a proposed feature does not help the release manager move from “too many PRs and too much coordination overhead” to “a calm, quick release packet and approval flow,” it should usually be deprioritized for the MVP.

## What is already done

### Implemented foundations

- MCP server route and MCP OAuth discovery endpoints
- WorkOS-backed actor bootstrap shared across browser and MCP
- Release tracker backend foundation for:
  - approvals
  - merge execution runs
  - monitoring sessions
  - release notifications
  - release events
- Slack action callback scaffold
- Thin CLI for setup/doctor/help entrypoints
- Provider-agnostic billing abstraction:
  - Paddle-first adapter
  - Polar fallback adapter
- Persisted billing account state
- Persisted onboarding state
- Browser continuation completion route
- Embedded help corpus and MCP help tools
- Guided onboarding page with:
  - checklist
  - org creation
  - GitHub install handoff
  - hosted billing launch

### Verification already passing

- `pnpm typecheck`
- `pnpm test`
- `npx convex codegen --typecheck=disable`

## Remaining workstreams

## 1. Auth finalization
Status: **In progress**

Goal:
- make WorkOS the clean production auth source for browser and MCP

TODO:
- finalize MCP token validation against environment-specific AuthKit domains
- support staging and production AuthKit domains without code changes
- verify resource-indicator and `aud` claim behavior end to end
- finalize Convex auth trust model for the WorkOS token shapes we use in production
- add better auth diagnostics for:
  - missing audience
  - wrong domain
  - expired token
  - missing org context
- document exact WorkOS dashboard configuration for:
  - staging
  - production

Acceptance:
- browser and MCP sessions resolve to the same actor context in both staging and production

## 2. Billing implementation
Status: **Partially implemented**

Goal:
- make billing real while keeping Paddle and Polar swappable

TODO:
- replace URL-template-only checkout behavior with real provider-backed session creation where needed
- harden Paddle webhook parsing against exact event payloads
- harden Polar webhook parsing against exact event payloads
- add idempotency / dedupe handling for billing webhooks
- persist:
  - customer ID
  - subscription ID
  - plan ID
  - subscription status
  - renewal dates
- sync organization entitlements from billing state
- add billing success and cancel UX
- add billing portal launch and return flow
- expose billing status cleanly in MCP and browser
- decide provider selection behavior:
  - default provider
  - backup provider
  - failover expectations

Acceptance:
- an org can complete checkout, return to DeployTitan, and show correct billing status without manual admin intervention

## 3. Onboarding engine
Status: **Partially implemented**

Goal:
- make onboarding feel guided, resumable, and low-friction

TODO:
- expand onboarding state machine to support:
  - skip
  - defer
  - blocked
  - resume
- add explicit step completion for:
  - GitHub
  - Slack
  - Grafana
  - billing
- persist and show blocker reasons
- make MCP onboarding guide the canonical orchestration layer
- add “next best action” logic that is more precise than checklist status alone
- add stronger browser continuation flow:
  - signed continuation token usage
  - step-specific return pages
  - success/failure messaging
- support “start from one prompt” guided experience in MCP

Acceptance:
- a first-time user can move from sign-in to release-ready using MCP plus a few browser handoffs without needing external docs

## 4. GitHub integration hardening
Status: **Early foundation only**

Goal:
- make PR discovery and GitHub setup reliable enough for real release tracking

TODO:
- replace placeholder GitHub install continuation behavior with a proper setup completion path
- harden install-to-project binding
- improve repository collision handling
- improve PR inventory synchronization and filtering
- improve live operator feedback when:
  - no repos are linked
  - PRs are missing
  - installation permissions are incomplete

Acceptance:
- release managers can connect GitHub, see PRs, and reliably create release packets from them

## 5. Slack integration hardening
Status: **Scaffold only**

Goal:
- make Slack approvals and notifications production-safe

TODO:
- add Slack request signature verification
- add richer interactive approval messages
- add reminder messaging polish
- add failure and retry handling
- add channel targeting and project-level Slack config
- improve stakeholder feedback after approval/rejection

Acceptance:
- stakeholders can approve from Slack reliably and DeployTitan persists the correct state every time

## 6. Grafana monitoring hardening
Status: **Scaffold only**

Goal:
- make post-release monitoring deterministic and useful

TODO:
- add dedicated Grafana setup path
- support project-level metric definitions
- harden parsing of actual Grafana response shapes
- support baseline + threshold configuration
- improve alert payloads and summary output
- add troubleshooting guidance when monitoring is misconfigured

Acceptance:
- a release can enter monitoring and produce a meaningful health result plus Slack alert if thresholds are breached

## 7. Embedded help and product guidance
Status: **Foundation implemented**

Goal:
- eliminate the need for external docs during normal onboarding and setup

TODO:
- expand help corpus for:
  - WorkOS setup
  - GitHub setup
  - Slack setup
  - Grafana setup
  - billing
  - troubleshooting
  - permissions and security
- add article-to-step mapping so onboarding can surface exact help automatically
- make MCP answers cite the relevant help article slug internally
- add more operational troubleshooting content

Acceptance:
- common user questions can be answered directly from the embedded help corpus through MCP

## 8. Release tracker workflow polish
Status: **Partially implemented**

Goal:
- make the MVP feel production-usable for release managers

TODO:
- improve release packet defaults and templates
- support saved stakeholder groups / approver presets
- improve merge-run reporting
- improve timeline clarity
- improve status naming consistency across MCP and browser
- make “first release packet” creation smoother from MCP

Acceptance:
- release managers can set up, create a release packet, request approvals, merge, and monitor without confusion

## 9. Reliability and security
Status: **Mostly not started**

Goal:
- make the MVP safe and operable in production

TODO:
- add stronger webhook verification
- add idempotency for critical side effects
- add audit coverage for onboarding and billing events
- review secret handling and env requirements
- add rate limiting or abuse mitigation for public routes where appropriate
- add operator-facing diagnostics for broken setups

Acceptance:
- core external callbacks and critical state transitions are safe to run in production

## 10. Test development
Status: **Initial repo tests only**

This workstream should expand **after each feature slice**, not only at the very end.

### Unit / backend tests

- onboarding state transitions
- billing account upsert logic
- billing webhook event handling
- Slack approval mutation behavior
- monitoring session progression
- help search behavior

### Route / integration tests

- MCP initialization and tool routing
- billing checkout route
- billing portal route
- Paddle webhook route
- Polar webhook route
- onboarding continuation route
- Slack action route

### End-to-end scenarios

- sign in with WorkOS
- create org
- create project
- connect GitHub
- launch billing checkout
- resume onboarding
- create release packet
- request approvals

### Production-readiness scripts

- scripted environment validation
- auth configuration doctor
- billing configuration doctor
- integration readiness checks

Acceptance:
- every critical onboarding and release-tracker flow has test coverage beyond manual clicking

## Recommended execution order

### Phase 2A

- Auth finalization
- Billing webhook hardening
- Onboarding state machine refinement

### Phase 2B

- GitHub setup completion flow
- Slack production hardening
- Grafana setup + monitoring hardening

### Phase 2C

- Help corpus expansion
- Release tracker polish
- Reliability and security pass
- Test suite expansion

## Tracking method

Use this file as the main execution tracker.

Suggested rule:
- when a section’s acceptance criteria are met, mark the workstream complete
- update the completion estimate at the top after each meaningful slice
- keep tests as part of each phase, not as a final-only task
