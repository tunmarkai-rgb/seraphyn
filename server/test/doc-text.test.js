const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  extractDocText, isDoc, looksLikeDoc, extractionConfidence
} = require(path.resolve(__dirname, '../lib/doc-text'))

const SECTOR = 512
const FREE = 0xffffffff
const EOC = 0xfffffffe

// Builds a minimal OLE compound file with one WordDocument stream, so the tests
// do not depend on a checked-in binary. This exercises the CFB walk, the FIB
// read and the decode -- it does NOT reproduce the quirks of real Word output,
// which is why the module is documented as best effort.
function makeDoc(bodyText, { fibMagic = 0xa5ec } = {}) {
  const fib = Buffer.alloc(64)
  fib.writeUInt16LE(fibMagic, 0)

  const body = Buffer.from(bodyText, 'latin1')
  const stream = Buffer.concat([fib, body])
  fib.writeUInt32LE(64, 24)                       // fcMin: text starts after FIB
  fib.writeUInt32LE(64 + body.length, 28)         // fcMac
  stream.set(fib, 0)

  // Layout: sector 0 = FAT, 1 = directory, 2.. = the WordDocument stream.
  const streamSectors = Math.max(1, Math.ceil(stream.length / SECTOR))
  const totalSectors = 2 + streamSectors

  const header = Buffer.alloc(SECTOR, 0)
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0)
  header.writeUInt16LE(9, 30)     // sector shift -> 512
  header.writeUInt16LE(6, 32)     // mini sector shift -> 64
  header.writeUInt32LE(1, 44)     // one FAT sector
  header.writeUInt32LE(1, 48)     // directory starts at sector 1
  // Real WordDocument streams always exceed the usual 4096-byte mini cutoff and
  // so use the regular FAT. A low cutoff makes these small fixtures take that
  // same path rather than the mini-stream one.
  header.writeUInt32LE(64, 56)
  header.writeUInt32LE(EOC, 60)   // no mini FAT
  header.writeUInt32LE(EOC, 68)   // no extra DIFAT
  header.writeUInt32LE(0, 76)     // FAT lives in sector 0
  for (let i = 1; i < 109; i++) header.writeUInt32LE(FREE, 76 + i * 4)

  const fat = Buffer.alloc(SECTOR, 0xff)
  fat.writeUInt32LE(EOC, 0)       // FAT sector itself
  fat.writeUInt32LE(EOC, 4)       // directory
  for (let i = 0; i < streamSectors; i++) {
    fat.writeUInt32LE(i === streamSectors - 1 ? EOC : 3 + i, (2 + i) * 4)
  }
  for (let i = totalSectors; i < SECTOR / 4; i++) fat.writeUInt32LE(FREE, i * 4)

  const dir = Buffer.alloc(SECTOR, 0)
  const entry = (slot, name, type, start, size) => {
    const off = slot * 128
    const nameBuf = Buffer.from(name + '\0', 'utf16le')
    nameBuf.copy(dir, off)
    dir.writeUInt16LE(nameBuf.length, off + 64)
    dir.writeUInt8(type, off + 66)
    dir.writeUInt32LE(start, off + 116)
    dir.writeUInt32LE(size, off + 120)
  }
  entry(0, 'Root Entry', 5, FREE, 0)
  entry(1, 'WordDocument', 2, 2, stream.length)
  entry(2, '1Table', 2, FREE, 0)
  entry(3, 'unused', 0, FREE, 0)

  const streamPadded = Buffer.alloc(streamSectors * SECTOR, 0)
  stream.copy(streamPadded, 0)

  return Buffer.concat([header, fat, dir, streamPadded])
}

const RESUME = [
  'Amara Okonkwo, BSN, RN\r',
  'Chicago, IL 60614 | (312) 555-0182 | amara.okonkwo@example.com\r',
  'Illinois RN License 041-388217\r',
  'Critical care registered nurse with seven years of bedside experience in ',
  'adult medical surgical intensive care and cardiothoracic step down units.\r',
  'Certifications: BLS, ACLS, PALS, CCRN\r'
].join('')

test('extracts body text from a doc stream', () => {
  const text = extractDocText(makeDoc(RESUME))
  assert.match(text, /Amara Okonkwo, BSN, RN/)
  assert.match(text, /041-388217/)
  assert.match(text, /amara\.okonkwo@example\.com/)
})

test('carriage returns become line breaks', () => {
  const lines = extractDocText(makeDoc(RESUME)).split('\n').filter(Boolean)
  assert.equal(lines[0], 'Amara Okonkwo, BSN, RN')
  assert.ok(lines.length >= 4, `expected several lines, got ${lines.length}`)
})

test('decodes cp1252 punctuation Word actually writes', () => {
  // 0x92 is a right single quote, 0x96 an en dash -- latin1 would mangle both.
  const body = 'Nurses duties  including triage, and enough surrounding prose '
    + 'to clear the minimum length that the confidence score requires here.\r'
  const text = extractDocText(makeDoc(body))
  assert.match(text, /Nurse’s duties – including triage/)
})

// The input is an uploaded file, so every rejection must be a clear throw.
test('rejects a file that is not an OLE container', () => {
  assert.throws(() => extractDocText(Buffer.alloc(600)), /OLE compound file/)
  assert.throws(() => extractDocText(Buffer.from('PK zip')), /OLE compound file/)
})

test('rejects a container whose FIB magic is wrong', () => {
  assert.throws(() => extractDocText(makeDoc(RESUME, { fibMagic: 0x1234 })), /valid FIB/)
})

test('rejects binary noise rather than returning garbage', () => {
  // A well-formed container whose "text" is random bytes must not pass: a bad
  // extraction would be written to a nurse's profile as fact.
  let noise = ''
  for (let i = 0; i < 4000; i++) noise += String.fromCharCode(1 + (i * 7919) % 255)
  assert.throws(() => extractDocText(makeDoc(noise)), /did not read as prose/)
})

test('rejects a non-buffer', () => {
  assert.throws(() => extractDocText('a string'), /expects a Buffer/)
})

test('confidence scores prose above noise', () => {
  const prose = 'Registered nurse with seven years of critical care experience across '
    + 'intensive care and step down units, seeking per diem night shifts in Chicago.'
  let noise = ''
  for (let i = 0; i < 400; i++) noise += String.fromCharCode(1 + (i * 7919) % 255)
  assert.ok(extractionConfidence(prose) > 0.7, 'prose scored too low')
  assert.equal(extractionConfidence(noise), 0)
  assert.equal(extractionConfidence(''), 0)
  assert.equal(extractionConfidence('too short'), 0)
})

// The synthetic containers above cover the CFB walk, but only real Word output
// proves the reader survives what Word actually writes. These two fixtures were
// produced by Word 16 saving as "Word 97-2003 Document".
const fs = require('node:fs')
const FIXTURES = path.resolve(__dirname, 'fixtures')

test('reads a resume saved by real Word as .doc', () => {
  const text = extractDocText(fs.readFileSync(path.join(FIXTURES, 'real-word97.doc')))
  assert.match(text, /Priya Raman, RN/)
  assert.match(text, /priya\.raman@example\.com/)
  assert.match(text, /95511234/, 'licence number lost')
  assert.match(text, /TNCC/)
  assert.ok(extractionConfidence(text) > 0.8, 'real Word output scored low')
})

test('reads headings and table cells from real Word output', () => {
  // Resumes are often laid out in tables; cell text lives in ordinary
  // paragraphs, and the heading above the table must survive too.
  const text = extractDocText(fs.readFileSync(path.join(FIXTURES, 'real-word97-table.doc')))
  assert.match(text, /Marcus Bell, BSN, RN/, 'heading before the table was lost')
  assert.match(text, /marcus\.bell@example\.com/)
  assert.match(text, /60112233/)
  assert.match(text, /Operating Room/)
})

test('isDoc and looksLikeDoc discriminate correctly', () => {
  assert.equal(isDoc('resume.doc'), true)
  assert.equal(isDoc('RESUME.DOC'), true)
  assert.equal(isDoc('resume.docx'), false)
  assert.equal(looksLikeDoc(makeDoc(RESUME)), true)
  assert.equal(looksLikeDoc(Buffer.alloc(600)), false)
})
