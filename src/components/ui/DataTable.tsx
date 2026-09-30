'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Eye,
  SlidersHorizontal,
  Package,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency, formatDate } from '@/utils/decimal'

export interface Column<T> {
  key: string
  header: string
  accessor: (row: T) => React.ReactNode
  sortable?: boolean
  sortValue?: (row: T) => string | number | Date
  filterable?: boolean
  filterOptions?: { label: string; value: string }[]
  hideable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchKey?: (row: T) => string
  searchPlaceholder?: string
  statusKey?: (row: T) => string
  statusOptions?: { label: string; value: string }[]
  dateKey?: (row: T) => Date | string | null
  emptyTitle?: string
  emptySubtext?: string
  emptyAction?: React.ReactNode
  isLoading?: boolean
  error?: string | null
  rowsPerPageDefault?: number
  currencyCode?: string
}

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  searchKey,
  searchPlaceholder,
  statusKey,
  statusOptions,
  dateKey,
  emptyTitle,
  emptySubtext,
  emptyAction,
  isLoading = false,
  error = null,
  rowsPerPageDefault = 10,
  currencyCode = 'USD',
}: DataTableProps<T>) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const tAllStatuses = isAr ? 'جميع الحالات' : isTr ? 'Tüm Durumlar' : 'All Statuses'
  const tColumns = isAr ? 'الأعمدة' : isTr ? 'Sütunlar' : 'Columns'
  const tToggleVisibility = isAr ? 'إظهار / إخفاء الأعمدة' : isTr ? 'Sütun Görünürlüğü' : 'Toggle Visibility'
  const defaultPlaceholder = isAr ? 'بحث في السجلات...' : isTr ? 'Kayıtlarda ara...' : 'Search records...'
  const effectivePlaceholder = searchPlaceholder || defaultPlaceholder
  const effectiveEmptyTitle = emptyTitle || (isAr ? 'لا توجد بيانات مسجلة' : isTr ? 'Kayıt bulunamadı' : 'No records found')
  const effectiveEmptySubtext = emptySubtext || (isAr ? 'لم يتم العثور على سجلات تطابق عوامل التصفية الحالية.' : isTr ? 'Mevcut filtrelerle eşleşen veri bulunamadı.' : 'No data matching your current filters.')
  const tPerPage = (n: number) => isAr ? `${n} لكل صفحة` : isTr ? `Sayfa başına ${n}` : `${n} per page`
  const tPageOf = (cur: number, tot: number) => isAr ? `صفحة ${cur} من ${tot}` : isTr ? `Sayfa ${cur} / ${tot}` : `Page ${cur} of ${tot}`
  const tShowingEntries = (from: number, to: number, total: number) => isAr ? `عرض من ${from} إلى ${to} من إجمالي ${total} سجل` : isTr ? `Toplam ${total} kayıttan ${from} - ${to} arası` : `Showing ${from} to ${to} of ${total} entries`

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(rowsPerPageDefault)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    columns.forEach((col) => {
      initial[col.key] = true
    })
    return initial
  })
  const [showColMenu, setShowColMenu] = useState(false)

  // 1. Filter by search query and status
  const filteredData = useMemo(() => {
    let result = [...data]

    if (searchQuery.trim() && searchKey) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((row) => searchKey(row).toLowerCase().includes(q))
    }

    if (selectedStatus !== 'all' && statusKey) {
      result = result.filter((row) => statusKey(row) === selectedStatus)
    }

    return result
  }, [data, searchQuery, searchKey, selectedStatus, statusKey])

  // 2. Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData

    const col = columns.find((c) => c.key === sortKey)
    if (!col || !col.sortValue) return filteredData

    return [...filteredData].sort((a, b) => {
      const valA = col.sortValue!(a)
      const valB = col.sortValue!(b)

      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (valA instanceof Date && valB instanceof Date) {
        return sortDirection === 'asc'
          ? valA.getTime() - valB.getTime()
          : valB.getTime() - valA.getTime()
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()

      if (sortDirection === 'asc') {
        return strA.localeCompare(strB)
      } else {
        return strB.localeCompare(strA)
      }
    })
  }, [filteredData, sortKey, sortDirection, columns])

  // 3. Paginate
  const totalItems = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortKey(null)
        setSortDirection('asc')
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const activeColumns = columns.filter((col) => visibleColumns[col.key] !== false)

  if (error) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-danger)' }}>
        <p style={{ fontWeight: 600 }}>Error loading table data</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Controls Bar */}
      <div
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {/* Search Input */}
        {searchKey ? (
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '380px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                insetInlineStart: '0.75rem',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder={effectivePlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              style={{ paddingInlineStart: '2.25rem', height: 38, fontSize: '0.8125rem' }}
            />
          </div>
        ) : (
          <div />
        )}

        {/* Filters & Column Visibility */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {statusKey && statusOptions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                className="form-control"
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value)
                  setCurrentPage(1)
                }}
                style={{ height: 38, padding: '0 0.75rem', fontSize: '0.8125rem' }}
              >
                <option value="all">{tAllStatuses}</option>
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Column menu toggle */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowColMenu((o) => !o)}
              style={{ height: 38, padding: '0 0.75rem' }}
              title={tToggleVisibility}
            >
              <SlidersHorizontal size={14} />
              <span style={{ fontSize: '0.8125rem' }}>{tColumns}</span>
            </button>

            {showColMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  insetInlineEnd: 0,
                  width: 190,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 40,
                  padding: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem', padding: '0 0.25rem' }}>
                  {tToggleVisibility}
                </div>
                {columns
                  .filter((c) => c.hideable !== false)
                  .map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key] !== false}
                        onChange={() => toggleColumn(col.key)}
                      />
                      {col.header}
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && col.sortValue && handleSort(col.key)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span style={{ color: sortKey === col.key ? 'var(--color-brand-500)' : 'var(--text-muted)' }}>
                        {sortKey === col.key ? (
                          sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ChevronsUpDown size={12} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {activeColumns.map((col) => (
                    <td key={col.key} style={{ padding: '0.875rem 1.25rem' }}>
                      <div
                        style={{
                          height: 16,
                          background: 'var(--border-color)',
                          borderRadius: 4,
                          width: '70%',
                          opacity: 0.6,
                          animation: 'pulse 1.5s infinite ease-in-out',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={activeColumns.length}>
                  <div className="empty-state" style={{ padding: '3rem 1rem' }}>
                    <div className="empty-state-icon">
                      <Package size={28} />
                    </div>
                    <p className="empty-state-title">{effectiveEmptyTitle}</p>
                    <p className="empty-state-text">{effectiveEmptySubtext}</p>
                    {emptyAction && <div style={{ marginTop: '0.5rem' }}>{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              paginatedData.map((row, idx) => (
                <tr
                  key={(row.id as string) || idx}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background 100ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-page)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {activeColumns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '0.875rem 1.25rem',
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                        verticalAlign: 'middle',
                      }}
                    >
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && totalItems > 0 && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            {tShowingEntries(
              (currentPage - 1) * pageSize + 1,
              Math.min(currentPage * pageSize, totalItems),
              totalItems
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select
              className="form-control"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              style={{ height: 32, padding: '0 0.5rem', fontSize: '0.8125rem' }}
            >
              <option value={5}>{tPerPage(5)}</option>
              <option value={10}>{tPerPage(10)}</option>
              <option value={25}>{tPerPage(25)}</option>
              <option value={50}>{tPerPage(50)}</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              style={{ height: 32, width: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isAr ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <span>
              {tPageOf(currentPage, totalPages)}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              style={{ height: 32, width: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isAr ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
