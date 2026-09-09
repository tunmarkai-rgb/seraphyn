// Minimal DOCX text extractor.
//
// The resume parser handles pdf/rtf/txt because n8n's Extract from File node
// has no DOCX operation, yet the profile upload accepts .docx and nurses use
// it. Rather than add a dependency or put LibreOffice on a 2GB droplet, this
// pulls the text out directly: a .docx is a ZIP, and the body text lives in
// word/document.xml.
//
// Scope: body paragraphs, including text inside tables (table cells contain
// ordinary <w:p> runs). Headers and footers live in separate parts and are NOT
// extracted -- a resume with its contact details only in a page header will
// come back without them.

const zlib = require('zlib')

const EOCD_SIG = 0x06054b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50
const TARGET = 'word/document.xml'

// Locates the End of Central Directory record, scanning back from the end
// because it is followed by a variable-length comment.
function findEocd(buf) {
  const maxComment = 0xffff
  const start = Math.max(0, buf.length - maxComment - 22)
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}

function findEntry(buf, eocd, name) {
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CENTRAL_SIG) return null

    const method = buf.readUInt16LE(p + 10)
    const compressedSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const entryName = buf.toString('utf8', p + 46, p + 46 + nameLen)

    if (entryName === name) return { method, compressedSize, localOffset }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

function readEntry(buf, entry) {
  const o = entry.localOffset
  if (buf.readUInt32LE(o) !== LOCAL_SIG) throw new Error('Bad local file header')

  // Name and extra lengths are read from the LOCAL header: they can differ
  // from the central directory's copy.
  const nameLen = buf.readUInt16LE(o + 26)
  const extraLen = buf.readUInt16LE(o + 28)
  const start = o + 30 + nameLen + extraLen
  const data = buf.subarray(start, start + entry.compressedSize)

  if (entry.method === 0) return data
  if (entry.method === 8) return zlib.inflateRawSync(data)
  throw new Error(`Unsupported ZIP compression method ${entry.method}`)
}

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'"
}

function decodeEntities(text) {
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
}

function xmlToText(xml) {
  return decodeEntities(
    xml
      // Structural breaks become whitespace before tags are stripped, otherwise
      // every paragraph runs together into one line.
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Returns the document's plain text, or throws if the buffer is not a readable
// .docx. Callers should treat a throw as "not extractable" rather than fatal.
function extractDocxText(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('extractDocxText expects a Buffer')
  if (buffer.length < 22) throw new Error('File is too small to be a .docx')

  const eocd = findEocd(buffer)
  if (eocd === -1) throw new Error('Not a ZIP container (no end-of-central-directory record)')

  const entry = findEntry(buffer, eocd, TARGET)
  if (!entry) throw new Error(`${TARGET} not found; the file is a ZIP but not a Word document`)

  return xmlToText(readEntry(buffer, entry).toString('utf8'))
}

function isDocx(filename) {
  return /\.docx$/i.test(String(filename || ''))
}

module.exports = { extractDocxText, isDocx }
