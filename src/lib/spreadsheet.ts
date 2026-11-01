import * as XLSX from 'xlsx'

const CHASSIS_HEADERS = new Set([
  'chassis',
  'chassisno',
  'chassis no',
  'chassis_no',
  'chassis number',
  'vin',
])

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
}

export interface ParseChassisResult {
  chassisNos: string[]
  warnings: string[]
}

export function parseChassisFromSpreadsheet(buffer: ArrayBuffer): ParseChassisResult {
  const warnings: string[] = []
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { chassisNos: [], warnings: ['Spreadsheet has no sheets'] }
  }
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown as unknown[][]

  if (rows.length === 0) {
    return { chassisNos: [], warnings: ['Sheet is empty'] }
  }

  const headerRow = rows[0].map(normalizeHeader)
  let colIndex = headerRow.findIndex((h) => CHASSIS_HEADERS.has(h))
  let dataStart = 1

  if (colIndex < 0) {
    colIndex = 0
    dataStart = 0
    warnings.push(
      'No chassis/VIN header found — using first column (including first row if it looks like data)',
    )
    // If first cell looks like a header word, skip it
    const first = normalizeHeader(rows[0][0])
    if (first === 'chassis' || first.includes('chassis') || first === 'vin') {
      dataStart = 1
    }
  }

  const seen = new Set<string>()
  const chassisNos: string[] = []
  let dupes = 0

  for (let i = dataStart; i < rows.length; i++) {
    const raw = String(rows[i]?.[colIndex] ?? '')
      .trim()
      .toUpperCase()
    if (!raw) continue
    if (seen.has(raw)) {
      dupes += 1
      continue
    }
    seen.add(raw)
    chassisNos.push(raw)
  }

  if (dupes > 0) {
    warnings.push(`Removed ${dupes} duplicate chassis value(s) in file`)
  }

  return { chassisNos, warnings }
}

export function downloadBatchTemplate(): void {
  const csv = 'chassisNo\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'batch-in-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}
