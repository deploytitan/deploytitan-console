/**
 * useBillingProducts — fetches available plans + add-ons via the API proxy.
 *
 * The API endpoint (GET /billing/products) holds the Polar secret token
 * server-side. This hook calls through with the user's JWT and falls back
 * to the canonical plan definitions when the endpoint is unavailable.
 */

import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api'
import type { BillingProductsResponse } from '../lib/billing'
import { CANONICAL_PLANS, CANONICAL_ADDONS } from '../lib/billing'
import { logFrontendEvent } from '../lib/frontendTelemetry'

const FALLBACK: BillingProductsResponse = {
  products: CANONICAL_PLANS,
  addOns: CANONICAL_ADDONS,
}

export function useBillingProducts() {
  return useQuery<BillingProductsResponse, Error>({
    queryKey: ['billing', 'products'],
    queryFn: () =>
      apiRequest<BillingProductsResponse>('/billing/products').catch((err) => {
        console.error('[useBillingProducts] failed to fetch billing products, using fallback', err)
        logFrontendEvent({ level: 'error', message: 'billing.products.fetch.failed', context: { error: err } })
        return FALLBACK
      }),
    staleTime: 1000 * 60 * 60, // 1 hour — plans change rarely
    retry: 1,
    placeholderData: FALLBACK,
  })
}
