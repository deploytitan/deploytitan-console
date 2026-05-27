/**
 * useDemoMode — returns true when there is no real Zero data for the current
 * project/org. Used to decide whether to render demo fixtures.
 *
 * Strategy: if serviceRows from Zero is an empty array AND the query has
 * settled (not undefined), we show demo data.
 */
import { DEMO_SERVICES, DEMO_PR_RISKS, DEMO_INCIDENTS } from '../lib/demo-data'

export { DEMO_SERVICES, DEMO_PR_RISKS, DEMO_INCIDENTS }

/**
 * Returns true when `rows` is a settled empty array (Zero returned []).
 * `undefined` means still loading; we don't show demo during that window.
 */
export function isDemoMode(rows: unknown[] | undefined): boolean {
  return Array.isArray(rows) && rows.length === 0
}
