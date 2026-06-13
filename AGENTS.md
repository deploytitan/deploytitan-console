<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read
the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployments

Regarding deployments which requires any updates from zero-schema or we had to do any db schema backend changes, please
refer to the guidelines at deploytitan-monorepo/docs/deployment/zero-postgres-deployment.md file.
Either you can find this file in the deploytitan-monorepo repo or you can find it in the Github origin.

## Design Tokens & Contrast

- Do not use arbitrary hex color values in components, pages, or local CSS overrides. Raw color values belong only in design token declarations such as `src/index.css` or `@deploytitan/design-tokens`.
- Use the standard Tailwind text color tokens for text hierarchy: `text-foreground`, `text-muted-foreground`, `text-text-tertiary`, and `text-text-disabled`.
- Use `text-primary-accessible` for amber text on light surfaces. Use `text-primary` for non-text accents or dark-mode amber text where contrast is already sufficient.
- Use signal text tokens for readable status copy: `text-signal-success-text`, `text-signal-warning-text`, `text-signal-danger-text`, and `text-signal-deploy-text`. Reserve `text-signal-success`, `text-signal-warning`, `text-signal-danger`, and `text-signal-deploy` for icons, fills, borders, and non-text marks.
- Avoid opacity-suffixed text utilities such as `text-muted-foreground/40` or `text-foreground/60`. If the hierarchy is too strong, add or adjust a semantic token instead of weakening contrast per component.
- Dark mode should come from token overrides on `.dark`; do not add arbitrary dark-mode text variable utilities or one-off dark hex classes when the base token already themes correctly.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
