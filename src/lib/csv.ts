function escapeCell(value: unknown): string {
  if (value == null) return ''
  const str =
    typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns?: string[],
): string {
  if (rows.length === 0) {
    return (columns ?? []).join(',')
  }
  const cols = columns ?? Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set<string>()),
  )
  const lines = [cols.join(',')]
  for (const row of rows) {
    lines.push(cols.map((c) => escapeCell(row[c])).join(','))
  }
  return lines.join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadAllCsvZipLike(
  files: { name: string; csv: string }[],
): void {
  // Without a zip dependency: download each file sequentially.
  files.forEach((f, i) => {
    window.setTimeout(() => downloadCsv(f.name, f.csv), i * 250)
  })
}
