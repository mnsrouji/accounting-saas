'use server'

import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { GlobalSearchService, SearchResultItem } from '@/lib/services/global-search-service'

export async function globalSearchAction(
  businessId: string,
  query: string
): Promise<{ success: boolean; results: SearchResultItem[]; error?: string }> {
  try {
    // 1. Verify user belongs to requested business
    await requireBusinessAccess(businessId)

    // 2. Perform search scoped to businessId
    const results = await GlobalSearchService.search(businessId, query)
    return { success: true, results }
  } catch (error: any) {
    return { success: false, results: [], error: error.message || 'Search failed' }
  }
}
