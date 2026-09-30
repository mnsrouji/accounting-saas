'use client'

import { useState, useEffect, useTransition } from 'react'
import { Search, Loader2, FileText, User, ShoppingBag, CreditCard, DollarSign, Package, BookOpen, X } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { globalSearchAction } from '@/actions/search/search-actions'
import { SearchResultItem } from '@/lib/services/global-search-service'

const TYPE_ICONS: Record<string, any> = {
  customer: User,
  supplier: User,
  sale: FileText,
  purchase: ShoppingBag,
  payment: CreditCard,
  product: Package,
  expense: DollarSign,
  journal_entry: BookOpen,
}

export function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const params = useParams()
  const businessId = params.businessId as string
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearchAction(businessId, query)
        if (res.success) {
          setResults(res.results)
        }
      })
    }, 250)

    return () => clearTimeout(timer)
  }, [query, businessId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        isOpen ? onClose() : null
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mx-4">
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-slate-500 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, invoices, payments, products, expenses..."
            className="w-full py-4 text-base bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            autoFocus
          />
          {isPending && <Loader2 className="w-5 h-5 text-slate-400 animate-spin mr-2" />}
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length >= 2 && results.length === 0 && !isPending && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              No business records found for &quot;{query}&quot;
            </div>
          )}

          {results.map((item) => {
            const IconComponent = TYPE_ICONS[item.type] || FileText
            return (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => {
                  router.push(item.url)
                  onClose()
                }}
                className="w-full flex items-center justify-between p-3 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{item.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {item.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</div>
                  </div>
                </div>

                <div className="text-right">
                  {item.amount && <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.amount}</div>}
                  {item.date && <div className="text-xs text-slate-400">{item.date}</div>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <div>Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded text-[10px]">ESC</kbd> to close</div>
          <div>Strictly Isolated Tenant Data</div>
        </div>
      </div>
    </div>
  )
}
