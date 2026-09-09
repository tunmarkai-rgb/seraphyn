const { test } = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const path = require('node:path')

const { extractDocxText, isDocx } = require(path.resolve(__dirname, '../lib/docx-text'))

// Builds a minimal single-entry ZIP so the tests do not depend on a checked-in
// binary fixture. Mirrors the layout extractDocxText walks: local header, then
// central directory, then end-of-central-directory.
function makeZip(entries) {
  const files = []
  const chunks = []
  let offset = 0

  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const raw = Buffer.from(content, 'utf8')
    const deflated = zlib.deflateRawSync(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)              // method: deflate
    local.writeUInt32LE(deflated.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    files.push({ nameBuf, deflated, raw, offset })
    chunks.push(local, nameBuf, deflated)
    offset += local.length + nameBuf.length + deflated.length
  }

  const centralStart = offset
  for (const f of files) {
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(8, 10)                 // method: deflate
    c.writeUInt32LE(f.deflated.length, 20)
    c.writeUInt32LE(f.raw.length, 24)
    c.writeUInt16LE(f.nameBuf.length, 28)
    c.writeUInt32LE(f.offset, 42)
    chunks.push(c, f.nameBuf)
    offset += c.length + f.nameBuf.length
  }

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(offset - centralStart, 12)
  eocd.writeUInt32LE(centralStart, 16)
  chunks.push(eocd)

  return Buffer.concat(chunks)
}

const DOC_XML = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>Amara Okonkwo, BSN, RN</w:t></w:r></w:p>
<w:p><w:r><w:t>ICU &amp; Critical Care</w:t></w:r><w:tab/><w:r><w:t>7 years</w:t></w:r></w:p>
<w:p><w:r><w:t>Licence #041-388217</w:t></w:r></w:p>
</w:body></w:document>`

test('extracts paragraph text from a docx', () => {
  const text = extractDocxText(makeZip([['word/document.xml', DOC_XML]]))
  assert.match(text, /Amara Okonkwo, BSN, RN/)
  assert.match(text, /041-388217/)
})

test('paragraphs become separate lines rather than running together', () => {
  const text = extractDocxText(makeZip([['word/document.xml', DOC_XML]]))
  const lines = text.split('\n').filter(Boolean)
  assert.equal(lines[0], 'Amara Okonkwo, BSN, RN')
  assert.ok(lines.length >= 3, `expected 3+ lines, got ${lines.length}`)
})

test('decodes XML entities and tabs', () => {
  const text = extractDocxText(makeZip([['word/document.xml', DOC_XML]]))
  assert.match(text, /ICU & Critical Care/, 'entity not decoded')
  assert.ok(text.includes('\t'), 'w:tab not converted')
  assert.equal(text.includes('&amp;'), false)
  assert.equal(/<[^>]+>/.test(text), false, 'raw XML tags survived')
})

test('finds document.xml regardless of its position in the archive', () => {
  const zip = makeZip([
    ['[Content_Types].xml', '<Types/>'],
    ['word/styles.xml', '<styles/>'],
    ['word/document.xml', DOC_XML]
  ])
  assert.match(extractDocxText(zip), /Amara Okonkwo/)
})

// The input is an uploaded file, so every rejection path must throw a clear
// error rather than crash or return junk -- the route treats a throw as
// "not extractable" and still stores the file.
test('rejects a non-zip buffer', () => {
  assert.throws(() => extractDocxText(Buffer.from('%PDF-1.4 not a zip at all')), /ZIP container/)
})

test('rejects a zip that is not a Word document', () => {
  const zip = makeZip([['notes.txt', 'hello']])
  assert.throws(() => extractDocxText(zip), /not found/)
})

test('rejects a truncated file and a non-buffer', () => {
  assert.throws(() => extractDocxText(Buffer.alloc(4)), /too small/)
  assert.throws(() => extractDocxText('a string'), /expects a Buffer/)
})

test('isDocx matches only the docx extension', () => {
  assert.equal(isDocx('resume.docx'), true)
  assert.equal(isDocx('RESUME.DOCX'), true)
  assert.equal(isDocx('resume.doc'), false)
  assert.equal(isDocx('resume.pdf'), false)
  assert.equal(isDocx(null), false)
})
