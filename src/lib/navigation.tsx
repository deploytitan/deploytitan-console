'use client'

import NextLink from 'next/link'
import { useParams as useNextParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { forwardRef, useEffect, useMemo } from 'react'

type Params = Record<string, string | number | undefined | null>
type SearchValue = string | number | boolean | undefined | null
type Search = Record<string, SearchValue>

type HookOptions = Record<string, unknown>

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to?: string
  href?: string
  params?: Params
  search?: Search
  children?: ReactNode
}

function compilePath(input: string, params?: Params): string {
  let pathname = input
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      pathname = pathname.replaceAll('$' + key, encodeURIComponent(String(value ?? '')))
      pathname = pathname.replaceAll('[' + key + ']', encodeURIComponent(String(value ?? '')))
    }
  }
  return pathname
}

function withSearch(pathname: string, search?: Search): string {
  if (!search) return pathname
  const [base, existing = ''] = pathname.split('?')
  const params = new URLSearchParams(existing)
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === false) params.delete(key)
    else params.set(key, String(value))
  }
  const query = params.toString()
  return query ? base + '?' + query : base
}

export function routeHref(input: { to?: string; href?: string; params?: Params; search?: Search }): string {
  return withSearch(compilePath(input.href ?? input.to ?? '/', input.params), input.search)
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, href, params, search, ...props },
  ref,
) {
  return <NextLink ref={ref} href={routeHref({ to, href, params, search })} {...props} />
})

export function Navigate({
  to,
  href,
  params,
  search,
  replace,
}: {
  to?: string
  href?: string
  params?: Params
  search?: Search
  replace?: boolean
}) {
  const router = useRouter()
  const target = routeHref({ to, href, params, search })

  useEffect(() => {
    if (replace) router.replace(target)
    else router.push(target)
  }, [replace, router, target])

  return null
}

export function useNavigate(_options?: HookOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    input:
      | string
      | {
          to?: string
          href?: string
          params?: Params
          search?: Search | ((prev: Record<string, string>) => Search)
          replace?: boolean
        },
  ) => {
    if (typeof input === 'string') {
      router.push(input)
      return
    }

    const prev = Object.fromEntries(searchParams.entries())
    const search = typeof input.search === 'function' ? input.search(prev) : input.search
    const target = routeHref({
      to: input.to ?? pathname,
      href: input.href,
      params: input.params,
      search,
    })

    if (input.replace) router.replace(target)
    else router.push(target)
  }
}

export function useParams(_options?: HookOptions): Record<string, string> {
  return useNextParams() as Record<string, string>
}

export function useSearch(_options?: HookOptions): Record<string, string> {
  const searchParams = useSearchParams()
  return useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams])
}

export function useLocation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  return { pathname, search: search ? '?' + search : '', href: search ? pathname + '?' + search : pathname }
}

export function useMatchRoute() {
  const pathname = usePathname()
  return ({ to, params, fuzzy }: { to: string; params?: Params; fuzzy?: boolean }) => {
    const target = compilePath(to, params)
    return fuzzy ? pathname.startsWith(target) : pathname === target
  }
}
