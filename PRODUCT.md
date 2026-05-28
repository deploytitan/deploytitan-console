# Product

## Register

brand

## Users

Two simultaneous audiences who both land on the same site:

**Self-serve engineers** (staff/principal engineers, platform engineers, SREs): They arrive mid-evaluation, often from a GitHub link or word-of-mouth. They want proof the tool is serious, fast access to docs or a CLI install command, and enough technical depth to trust it before they try it. They're skeptical of marketing language; credibility comes from specificity.

**Leadership (engineering managers, VPs, CTOs)**: They arrive after an engineer has flagged the tool, or they're doing their own due diligence on deployment risk. They need a coherent capability story, reliability proof (social proof, metrics, clear product scope), and a clear path to a demo or a conversation. They're evaluating risk, not features.

The site must speak fluently to both without alienating either. Engineers spot pandering; leaders spot amateur positioning.

## Product Purpose

DeployTitan is release coordination and deployment safety software for distributed engineering teams. The core product is Titan Rollouts: a release coordination layer that sits above GitHub, CI/CD, and observability tools to model the release lifecycle those systems do not manage well.

The product solves multi-repo release coordination, deployment freeze chaos, release dependency management, release visibility, rollback coordination, and release approvals. It is not a traffic routing platform, service mesh replacement, CI/CD replacement, or multi-cloud DR layer.

Product structure: Titan Rollouts is the single core product now. Titan Foresight (deployment-aware risk intelligence) is the next layer. Titan Phoenix (enterprise recovery) is a future roadmap item.

Success means: engineering teams coordinate complex multi-service releases without manual Slack threads, spreadsheets, and release post-mortems. The primary goal of the landing site is demo booking conversion for teams with real release coordination overhead.

## Brand Personality

**Precise. Confident. Calm.**

The tone is that of the best engineer in the room: speaks with authority, doesn't over-explain, earns trust through specificity rather than enthusiasm. Never exclamatory. Never corporate-bland. The voice is direct, competent, and measured. It knows deployment safety is serious work and treats it that way.

## Anti-references

- **Generic SaaS cream + purple**: Notion/Linear/Loom aesthetic. Soft pastels, friendly rounded corners, "everyone-welcome" copy. DeployTitan is not a productivity tool; it's infrastructure. The design should feel engineered, not approachable.
- **Dark neon DevOps**: Terminal-green on black, aggressive gradients, the "we're hackers" aesthetic of 2018-era ops tooling. DeployTitan is enterprise-capable, not scrappy.
- **Enterprise boring**: Navy blue dashboards, bullet-list feature pages, stock photo heroes, corporate sans-serif in grey. Authoritative does not mean boring.

## Design Principles

1. **Specificity earns trust.** Concrete product names, real capability descriptions, and precise language outperform category-speak and superlatives. "Instant rollback in under 30 seconds" beats "ship with confidence."
2. **The interface demonstrates the product.** Animations, live demos, and interactive elements should mirror what the product does: precision, control, observability. Don't just describe deployment safety; show it.
3. **Dual-track legibility.** Every page should yield value to an engineer scanning for technical depth AND a leader scanning for capability scope and credibility. Neither should feel patronized.
4. **Calm authority over excitement.** No hype, no urgency tactics. DeployTitan earns attention through competence. The tone is assured, not eager.
5. **Ship or stay home.** Every design decision should serve the conversion funnel: demo booking. Secondary actions exist but never compete with the primary.

## Accessibility & Inclusion

WCAG 2.1 AAA where feasible. Reduced-motion support is essential: all animations must respect `prefers-reduced-motion`. Sufficient color contrast for both light and dark modes. Keyboard navigation must be fully functional.
