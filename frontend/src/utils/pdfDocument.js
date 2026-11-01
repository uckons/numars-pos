const PAGE = { width: 595.28, height: 841.89, margin: 42 }

const clean = (value) => String(value ?? '-')
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '')

const escapePdf = (value) => clean(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')

const wrap = (value, maxChars) => {
  const words = clean(value).split(/\s+/)
  const lines = []
  let current = ''
  words.forEach((word) => {
    if (!current) current = word
    else if (`${current} ${word}`.length <= maxChars) current += ` ${word}`
    else {
      lines.push(current)
      current = word
    }
  })
  if (current) lines.push(current)
  return lines.length ? lines : ['-']
}

class PdfLayout {
  constructor(title, subtitle, metadata) {
    this.title = title
    this.subtitle = subtitle
    this.metadata = metadata
    this.pages = []
    this.newPage()
  }

  newPage() {
    this.commands = []
    this.pages.push(this.commands)
    this.y = PAGE.height - PAGE.margin
    this.text('NUMARS POS', PAGE.margin, this.y, 10, true)
    this.text(this.title, PAGE.margin, this.y - 22, 17, true)
    this.y -= 42
    if (this.subtitle) this.line(this.subtitle, 9)
    if (this.metadata) this.line(this.metadata, 8)
    this.y -= 8
    this.rule()
  }

  ensure(height) {
    if (this.y - height < PAGE.margin + 22) this.newPage()
  }

  text(value, x, y, size = 9, bold = false) {
    this.commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdf(value)}) Tj ET`)
  }

  line(value, size = 9, bold = false) {
    wrap(value, Math.floor(100 * 9 / size)).forEach((part) => {
      this.ensure(size + 5)
      this.text(part, PAGE.margin, this.y, size, bold)
      this.y -= size + 4
    })
  }

  rule() {
    this.commands.push(`${PAGE.margin} ${this.y} m ${PAGE.width - PAGE.margin} ${this.y} l S`)
    this.y -= 14
  }

  heading(value) {
    this.ensure(26)
    this.text(value, PAGE.margin, this.y, 11, true)
    this.y -= 18
  }

  table(columns, rows) {
    const usable = PAGE.width - (PAGE.margin * 2)
    const widths = columns.map((column) => usable * (column.width || (1 / columns.length)))
    const drawRow = (cells, header = false) => {
      const wrapped = cells.map((cell, index) => wrap(cell, Math.max(8, Math.floor(widths[index] / 5.2))))
      const rowHeight = Math.max(...wrapped.map((lines) => lines.length)) * 11 + 8
      this.ensure(rowHeight)
      let x = PAGE.margin
      wrapped.forEach((lines, index) => {
        this.commands.push(`${x.toFixed(2)} ${(this.y - rowHeight + 4).toFixed(2)} ${widths[index].toFixed(2)} ${rowHeight.toFixed(2)} re S`)
        lines.forEach((part, lineIndex) => this.text(part, x + 4, this.y - 11 - (lineIndex * 11), 8, header))
        x += widths[index]
      })
      this.y -= rowHeight
    }
    drawRow(columns.map((column) => column.label), true)
    rows.forEach((row) => drawRow(columns.map((column) => row[column.key])))
    this.y -= 12
  }
}

export const buildPdf = (pages) => {
  const objects = []
  const add = (body) => { objects.push(body); return objects.length }
  const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  const pageRefs = []
  const contentRefs = []
  pages.forEach((commands, index) => {
    commands.push(`BT /F1 8 Tf 1 0 0 1 500 24 Tm (Halaman ${index + 1} / ${pages.length}) Tj ET`)
    const stream = commands.join('\n')
    contentRefs.push(add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`))
    pageRefs.push(add(''))
  })
  const pagesRef = add(`<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] >>`)
  pageRefs.forEach((ref, index) => {
    objects[ref - 1] = `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentRefs[index]} 0 R >>`
  })
  const catalogRef = add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`)
  let pdf = '%PDF-1.4\n%NUMARS\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}

export const downloadPdf = ({ title, subtitle = '', metadata = '', sections = [], filename = 'document.pdf' }) => {
  const layout = new PdfLayout(title, subtitle, metadata)
  sections.forEach((section) => {
    layout.heading(section.title)
    if (section.lines) section.lines.forEach((line) => layout.line(line.value ?? line, line.size || 9, line.bold || false))
    if (section.columns && section.rows) layout.table(section.columns, section.rows)
  })
  const blob = new Blob([buildPdf(layout.pages)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
