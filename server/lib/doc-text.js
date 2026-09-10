// Best-effort text extractor for legacy Word 97-2003 (.doc) files.
//
// A .doc is an OLE Compound File Binary container, not a ZIP, so the .docx
// reader cannot touch it. This walks the CFB structure far enough to read the
// WordDocument stream and pull body text out of it.
//
// THIS IS BEST EFFORT AND IS NOT VERIFIED AGAINST REAL WORD OUTPUT. The unit
// tests build synthetic containers, which exercise the CFB walk and the FIB
// read but not the quirks of documents Word actually writes -- particularly
// fast-saved ("complex") files, which scatter text into pieces indexed by a
// piece table in the Table stream.
//
// Because of that, every result is scored by extractionConfidence() and a low
// score throws. Callers must treat a throw as "not extractable" and leave the
// nurse's profile alone: a wrong extraction here would be written to their
// record as fact, which is worse than no extraction at all. The upload UI
// steers nurses to PDF or DOCX for this reason.

const SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const FREE_SECT = 0xffffffff
const END_OF_CHAIN = 0xfffffffe
const DIR_ENTRY_SIZE = 128
const STREAM_TYPE = 2
const ROOT_TYPE = 5
const FIB_MAGIC = 0xa5ec
const MIN_CONFIDENCE = 0.55

function isDoc(filename) {
  return /\.doc$/i.test(String(filename || ''))
}

function looksLikeDoc(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 512 && buffer.subarray(0, 8).equals(SIGNATURE)
}

function readHeader(buf) {
  return {
    sectorSize: 1 << buf.readUInt16LE(30),
    miniSectorSize: 1 << buf.readUInt16LE(32),
    numFatSectors: buf.readUInt32LE(44),
    firstDirSector: buf.readUInt32LE(48),
    miniCutoff: buf.readUInt32LE(56),
    firstMiniFatSector: buf.readUInt32LE(60),
    firstDifatSector: buf.readUInt32LE(68)
  }
}

const sectorOffset = (sector, sectorSize) => 512 + sector * sectorSize

function readFat(buf, h) {
  const perSector = h.sectorSize / 4
  const difat = []

  for (let i = 0; i < 109; i++) {
    const s = buf.readUInt32LE(76 + i * 4)
    if (s !== FREE_SECT) difat.push(s)
  }

  // Files large enough to need more than 109 FAT sectors chain extra DIFAT
  // sectors; the last slot of each points at the next.
  let next = h.firstDifatSector
  let guard = 0
  while (next !== END_OF_CHAIN && next !== FREE_SECT && guard++ < 4096) {
    const base = sectorOffset(next, h.sectorSize)
    if (base + h.sectorSize > buf.length) break
    for (let i = 0; i < perSector - 1; i++) {
      const s = buf.readUInt32LE(base + i * 4)
      if (s !== FREE_SECT) difat.push(s)
    }
    next = buf.readUInt32LE(base + (perSector - 1) * 4)
  }

  const fat = []
  for (const fatSector of difat) {
    const base = sectorOffset(fatSector, h.sectorSize)
    if (base + h.sectorSize > buf.length) break
    for (let i = 0; i < perSector; i++) fat.push(buf.readUInt32LE(base + i * 4))
  }
  return fat
}

function chain(fat, start, limit = 1 << 20) {
  const out = []
  const seen = new Set()
  let s = start
  while (s !== END_OF_CHAIN && s !== FREE_SECT && s < fat.length && out.length < limit) {
    if (seen.has(s)) break
    seen.add(s)
    out.push(s)
    s = fat[s]
  }
  return out
}

function readChain(buf, h, fat, start, size) {
  const parts = []
  for (const s of chain(fat, start)) {
    const off = sectorOffset(s, h.sectorSize)
    if (off + h.sectorSize > buf.length) break
    parts.push(buf.subarray(off, off + h.sectorSize))
  }
  const joined = Buffer.concat(parts)
  return size && size < joined.length ? joined.subarray(0, size) : joined
}

function readDirectory(buf, h, fat) {
  const dir = readChain(buf, h, fat, h.firstDirSector, 0)
  const entries = []
  for (let off = 0; off + DIR_ENTRY_SIZE <= dir.length; off += DIR_ENTRY_SIZE) {
    const nameLen = dir.readUInt16LE(off + 64)
    if (nameLen < 2) continue
    entries.push({
      name: dir.toString('utf16le', off, off + nameLen - 2),
      type: dir.readUInt8(off + 66),
      start: dir.readUInt32LE(off + 116),
      size: dir.readUInt32LE(off + 120)
    })
  }
  return entries
}

// Streams below the cutoff live inside the mini stream, which is itself stored
// in the root entry's chain and indexed by a separate mini-FAT.
function readMiniStream(buf, h, fat, entries, entry) {
  const root = entries.find((e) => e.type === ROOT_TYPE)
  if (!root) return Buffer.alloc(0)

  const miniStream = readChain(buf, h, fat, root.start, root.size)
  const miniFatRaw = readChain(buf, h, fat, h.firstMiniFatSector, 0)
  const miniFat = []
  for (let i = 0; i + 4 <= miniFatRaw.length; i += 4) miniFat.push(miniFatRaw.readUInt32LE(i))

  const parts = []
  for (const s of chain(miniFat, entry.start)) {
    const off = s * h.miniSectorSize
    if (off + h.miniSectorSize > miniStream.length) break
    parts.push(miniStream.subarray(off, off + h.miniSectorSize))
  }
  const joined = Buffer.concat(parts)
  return entry.size < joined.length ? joined.subarray(0, entry.size) : joined
}

function readStream(buf, h, fat, entries, name) {
  const entry = entries.find((e) => e.name === name && e.type === STREAM_TYPE)
  if (!entry) return null
  return entry.size < h.miniCutoff
    ? readMiniStream(buf, h, fat, entries, entry)
    : readChain(buf, h, fat, entry.start, entry.size)
}

// Windows-1252 differs from latin1 only in 0x80-0x9F, which is exactly where
// Word puts smart quotes, dashes and bullets.
const CP1252_HIGH = {
  130: '‚', 131: 'ƒ', 132: '„', 133: '…', 134: '†',
  135: '‡', 136: 'ˆ', 137: '‰', 138: 'Š', 139: '‹',
  140: 'Œ', 142: 'Ž', 145: '‘', 146: '’', 147: '“',
  148: '”', 149: '•', 150: '–', 151: '—', 152: '˜',
  153: '™', 154: 'š', 155: '›', 156: 'œ', 158: 'ž',
  159: 'Ÿ'
}

function decodeCp1252(buf) {
  let out = ''
  for (const byte of buf) {
    out += byte >= 128 && byte <= 159
      ? (CP1252_HIGH[byte] || ' ')
      : String.fromCharCode(byte)
  }
  return out
}

// Character codes are compared numerically rather than written as escapes in a
// regex, so the control characters cannot be mangled by an editor or shell.
const CR = 13
const CELL_END = 7
const SOFT_BREAK = 11
const PAGE_BREAK = 12
const LF = 10
const TAB = 9

function tidy(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code === CR || code === CELL_END || code === SOFT_BREAK || code === PAGE_BREAK) {
      out += '\n'
    } else if (code === LF || code === TAB) {
      out += text[i]
    } else if (code < 32 || code === 0xfffe || code === 0xffff) {
      // Field marks and formatting noise.
      out += ' '
    } else {
      out += text[i]
    }
  }
  return out
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Scores how much the result reads as prose rather than binary noise, 0..1.
// The threshold is the caller's, but extractDocText enforces MIN_CONFIDENCE.
function extractionConfidence(text) {
  if (!text || text.length < 80) return 0

  let letters = 0
  let printable = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) letters++
    if (code === LF || code === TAB || (code >= 32 && code <= 126) || (code >= 160 && code <= 591)) {
      printable++
    }
  }

  const tokens = text.split(/\s+/).filter(Boolean)
  const words = tokens.filter((w) => /^[A-Za-z][A-Za-z'.,-]*$/.test(w))

  const printableRatio = printable / text.length
  if (printableRatio < 0.9) return 0

  const letterRatio = letters / text.length
  const wordRatio = words.length / Math.max(1, tokens.length)

  return Math.min(1, Math.min(letterRatio / 0.55, 1) * 0.4 + printableRatio * 0.3 + wordRatio * 0.3)
}

function extractDocText(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('extractDocText expects a Buffer')
  if (!looksLikeDoc(buffer)) throw new Error('Not an OLE compound file (missing .doc signature)')

  const h = readHeader(buffer)
  if (!h.sectorSize || h.sectorSize > 0x10000) throw new Error('Unreasonable sector size')

  const fat = readFat(buffer, h)
  if (!fat.length) throw new Error('Could not read the file allocation table')

  const entries = readDirectory(buffer, h, fat)
  const wordDoc = readStream(buffer, h, fat, entries, 'WordDocument')
  if (!wordDoc || wordDoc.length < 64) throw new Error('WordDocument stream not found')
  if (wordDoc.readUInt16LE(0) !== FIB_MAGIC) throw new Error('WordDocument stream has no valid FIB')

  const fcMin = wordDoc.readUInt32LE(24)
  const fcMac = wordDoc.readUInt32LE(28)

  let best = ''
  if (fcMac > fcMin && fcMac <= wordDoc.length) {
    best = tidy(decodeCp1252(wordDoc.subarray(fcMin, fcMac)))
  }

  // Fast-saved documents do not respect fcMin/fcMac. Scanning from fcMin to the
  // end of the stream recovers the text in many of those, so keep whichever
  // reads better.
  if (extractionConfidence(best) < MIN_CONFIDENCE && fcMin < wordDoc.length) {
    const scanned = tidy(decodeCp1252(wordDoc.subarray(fcMin)))
    if (extractionConfidence(scanned) > extractionConfidence(best)) best = scanned
  }

  const confidence = extractionConfidence(best)
  if (confidence < MIN_CONFIDENCE) {
    throw new Error(
      `Extracted text did not read as prose (confidence ${confidence.toFixed(2)}); ` +
      'ask for the resume as PDF or DOCX'
    )
  }

  return best
}

module.exports = { extractDocText, isDoc, looksLikeDoc, extractionConfidence, MIN_CONFIDENCE }
