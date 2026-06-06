const path = require('path')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { supabase } = require('../config/supabase')
const { sendPortalEmail } = require('./mail')
const { AGREEMENT_TEMPLATES } = require('./agreement-templates')

const CONTRACT_DEFINITIONS = [
  {
    documentType: 'direct_hire',
    title: 'Direct Hire Agreement',
    fileName: 'Seraphyn Care Direct Hire Agreement  (1).pdf',
    generatedFileBase: 'Seraphyn-Direct-Hire-Agreement'
  },
  {
    documentType: 'staffing_boss',
    title: 'Per Diem Staffing Agreement',
    fileName: 'Seraphyn_Care_Solutions_Staffing_Agreement_BOSS.pdf',
    generatedFileBase: 'Seraphyn-Per-Diem-Staffing-Agreement'
  }
]

const PAGE = {
  width: 612,
  height: 792,
  marginX: 54,
  top: 720,
  bottom: 58
}

const COLORS = {
  navy: rgb(0.17, 0.24, 0.31),
  slate: rgb(0.34, 0.39, 0.45),
  muted: rgb(0.48, 0.53, 0.58),
  gold: rgb(0.74, 0.56, 0.25),
  border: rgb(0.78, 0.81, 0.84),
  warm: rgb(0.97, 0.96, 0.93)
}

let extendedContractsSchemaSupport = null

async function supportsExtendedContractsSchema() {
  if (extendedContractsSchemaSupport !== null) {
    return extendedContractsSchemaSupport
  }

  const { error } = await supabase
    .from('contracts')
    .select('document_type')
    .limit(1)

  if (error && /document_type.*does not exist/i.test(error.message)) {
    extendedContractsSchemaSupport = false
    return false
  }

  extendedContractsSchemaSupport = true
  return true
}

function getPortalTemplateUrl(documentType) {
  return `portal-template:${documentType}`
}

function getContractSourcePath(fileName) {
  return path.resolve(__dirname, '..', '..', fileName)
}

function extractBase64Payload(dataUrl = '') {
  const parts = String(dataUrl || '').split(',')
  return parts.length > 1 ? parts[1] : parts[0]
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ|â€�/g, '"')
    .replace(/â€“|â€”/g, '-')
    .replace(/â€¢/g, '-')
    .replace(/Â·/g, '-')
    .replace(/Â/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeFileSegment(value = '') {
  return cleanText(value)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'Employer'
}

function formatDateForFile(isoString) {
  return String(isoString || new Date().toISOString()).slice(0, 10)
}

function buildGeneratedFileName({ contract, employer, signedAt }) {
  const org = sanitizeFileSegment(employer.org_name || employer.contact_name || 'Employer')
  return `${contract.generatedFileBase}-${org}-${formatDateForFile(signedAt)}.pdf`
}

function buildFieldValues({ employer, signerName, signerTitle, signerEmail, fieldValues, signedAt }) {
  return {
    organizationName: fieldValues.organizationName || employer.org_name || '',
    organizationType: fieldValues.organizationType || employer.org_type || '',
    contactName: fieldValues.contactName || employer.contact_name || '',
    contactTitle: fieldValues.contactTitle || employer.contact_title || '',
    contactEmail: fieldValues.contactEmail || signerEmail || '',
    signerName: fieldValues.signerName || signerName || '',
    signerTitle: fieldValues.signerTitle || signerTitle || '',
    signerInitials: fieldValues.signerInitials || '',
    effectiveDate: fieldValues.effectiveDate || signedAt.slice(0, 10)
  }
}

function wrapText(text, font, size, maxWidth) {
  const words = cleanText(text).split(' ').filter(Boolean)
  const lines = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate
      continue
    }

    if (line) lines.push(line)
    line = word
  }

  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function createPdfRenderer({ pdfDoc, fonts }) {
  const pages = []
  let page = null
  let y = PAGE.top

  function drawHeader(targetPage) {
    targetPage.drawText('Seraphyn', {
      x: PAGE.marginX,
      y: 754,
      size: 18,
      font: fonts.bold,
      color: COLORS.navy
    })
    targetPage.drawText('HEALTHCARE STAFFING', {
      x: PAGE.marginX,
      y: 740,
      size: 8,
      font: fonts.regular,
      color: COLORS.gold
    })
    targetPage.drawLine({
      start: { x: PAGE.marginX, y: 726 },
      end: { x: PAGE.width - PAGE.marginX, y: 726 },
      thickness: 0.8,
      color: COLORS.border
    })
  }

  function addPage() {
    page = pdfDoc.addPage([PAGE.width, PAGE.height])
    pages.push(page)
    y = PAGE.top
    drawHeader(page)
  }

  function ensureSpace(requiredHeight) {
    if (!page || y - requiredHeight < PAGE.bottom) {
      addPage()
    }
  }

  function drawTextBlock(text, options = {}) {
    const {
      size = 10,
      font = fonts.regular,
      color = COLORS.slate,
      lineHeight = size + 5,
      gapAfter = 8,
      x = PAGE.marginX,
      maxWidth = PAGE.width - PAGE.marginX * 2
    } = options

    const lines = wrapText(text, font, size, maxWidth)
    for (const line of lines) {
      ensureSpace(lineHeight)
      page.drawText(line, { x, y, size, font, color })
      y -= lineHeight
    }
    y -= gapAfter
  }

  function drawHeading(text) {
    ensureSpace(28)
    y -= 6
    page.drawText(cleanText(text), {
      x: PAGE.marginX,
      y,
      size: 12,
      font: fonts.bold,
      color: COLORS.navy
    })
    y -= 16
    page.drawLine({
      start: { x: PAGE.marginX, y },
      end: { x: PAGE.width - PAGE.marginX, y },
      thickness: 0.6,
      color: COLORS.border
    })
    y -= 12
  }

  function drawKeyValue(label, value, x, valueX, rowY, width = 170) {
    page.drawText(cleanText(label).toUpperCase(), {
      x,
      y: rowY + 12,
      size: 7,
      font: fonts.bold,
      color: COLORS.muted
    })
    const lines = wrapText(value || '-', fonts.regular, 9, width)
    page.drawText(lines[0] || '-', {
      x: valueX,
      y: rowY,
      size: 9,
      font: fonts.regular,
      color: COLORS.navy
    })
  }

  function drawInfoBox(title, rows) {
    const rowHeight = 34
    const boxHeight = 34 + Math.ceil(rows.length / 2) * rowHeight
    ensureSpace(boxHeight + 16)

    page.drawRectangle({
      x: PAGE.marginX,
      y: y - boxHeight + 8,
      width: PAGE.width - PAGE.marginX * 2,
      height: boxHeight,
      color: COLORS.warm,
      borderColor: COLORS.border,
      borderWidth: 0.6
    })

    page.drawText(cleanText(title), {
      x: PAGE.marginX + 14,
      y: y - 12,
      size: 12,
      font: fonts.bold,
      color: COLORS.navy
    })

    let rowY = y - 44
    rows.forEach((row, index) => {
      const left = index % 2 === 0
      if (index > 0 && left) rowY -= rowHeight
      const labelX = left ? PAGE.marginX + 14 : PAGE.marginX + 270
      const valueX = labelX
      drawKeyValue(row.label, row.value, labelX, valueX, rowY, 210)
    })

    y -= boxHeight + 12
  }

  function drawSignatureImage(signatureImage) {
    ensureSpace(120)
    const scaled = signatureImage.scale(0.22)
    page.drawImage(signatureImage, {
      x: PAGE.marginX,
      y: y - 78,
      width: Math.min(scaled.width, 240),
      height: Math.min(scaled.height, 62)
    })
    y -= 86
    page.drawLine({
      start: { x: PAGE.marginX, y },
      end: { x: PAGE.marginX + 240, y },
      thickness: 0.7,
      color: COLORS.border
    })
    y -= 12
  }

  function drawFooterNumbers() {
    pages.forEach((targetPage, index) => {
      targetPage.drawLine({
        start: { x: PAGE.marginX, y: 42 },
        end: { x: PAGE.width - PAGE.marginX, y: 42 },
        thickness: 0.5,
        color: COLORS.border
      })
      targetPage.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: PAGE.width - PAGE.marginX - 70,
        y: 26,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted
      })
      targetPage.drawText('Generated by the Seraphyn portal', {
        x: PAGE.marginX,
        y: 26,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted
      })
    })
  }

  addPage()

  return {
    drawTextBlock,
    drawHeading,
    drawInfoBox,
    drawSignatureImage,
    drawFooterNumbers,
    ensureSpace,
    get page() {
      return page
    },
    get y() {
      return y
    },
    set y(value) {
      y = value
    }
  }
}

async function generateSignedAgreementPdf({
  contract,
  template,
  employer,
  signerName,
  signerTitle,
  signerEmail,
  signatureDataUrl,
  agreementFieldValues,
  acknowledgementIndexes,
  signedAt,
  ipAddress,
  userAgent
}) {
  const pdfDoc = await PDFDocument.create()
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  }
  const signatureImage = await pdfDoc.embedPng(Buffer.from(extractBase64Payload(signatureDataUrl), 'base64'))
  const renderer = createPdfRenderer({ pdfDoc, fonts })
  const maxWidth = PAGE.width - PAGE.marginX * 2

  renderer.drawTextBlock(template.title || contract.title, {
    size: 22,
    font: fonts.bold,
    color: COLORS.navy,
    lineHeight: 27,
    gapAfter: 4
  })

  if (template.subtitle) {
    renderer.drawTextBlock(template.subtitle, {
      size: 11,
      font: fonts.bold,
      color: COLORS.gold,
      lineHeight: 15,
      gapAfter: 12
    })
  }

  renderer.drawTextBlock(template.intro || '', {
    size: 10,
    color: COLORS.slate,
    lineHeight: 15,
    gapAfter: 14
  })

  renderer.drawInfoBox('Client and Signing Information', [
    { label: 'Organization', value: agreementFieldValues.organizationName },
    { label: 'Organization Type', value: agreementFieldValues.organizationType },
    { label: 'Contact Name', value: agreementFieldValues.contactName },
    { label: 'Contact Title', value: agreementFieldValues.contactTitle },
    { label: 'Contact Email', value: agreementFieldValues.contactEmail },
    { label: 'Effective Date', value: agreementFieldValues.effectiveDate },
    { label: 'Signer Name', value: agreementFieldValues.signerName || signerName },
    { label: 'Signer Title', value: agreementFieldValues.signerTitle || signerTitle }
  ])

  for (const section of template.sections || []) {
    renderer.drawHeading(section.heading)
    for (const paragraph of section.paragraphs || []) {
      renderer.drawTextBlock(paragraph, {
        size: 9.2,
        lineHeight: 13.5,
        gapAfter: 7,
        maxWidth
      })
    }
  }

  renderer.drawHeading('Acknowledgements')
  ;(template.acknowledgements || []).forEach((acknowledgement, index) => {
    const checked = acknowledgementIndexes.includes(index) ? '[x]' : '[ ]'
    renderer.drawTextBlock(`${checked} ${acknowledgement}`, {
      size: 9.5,
      lineHeight: 14,
      gapAfter: 6
    })
  })

  renderer.drawHeading('Electronic Execution')
  renderer.drawTextBlock(
    'By signing below, the signer confirms that they are authorized to execute this agreement electronically on behalf of the Client and that the completed fields and acknowledgements above are true and accepted.',
    { size: 9.5, lineHeight: 14, gapAfter: 10 }
  )

  renderer.drawSignatureImage(signatureImage)
  renderer.drawInfoBox('Execution Record', [
    { label: 'Signature', value: agreementFieldValues.signerName || signerName },
    { label: 'Title', value: agreementFieldValues.signerTitle || signerTitle || 'Not provided' },
    { label: 'Initials', value: agreementFieldValues.signerInitials },
    { label: 'Signed At UTC', value: signedAt },
    { label: 'Signer Email', value: signerEmail },
    { label: 'IP Address', value: ipAddress || 'Unavailable' },
    { label: 'User Agent', value: userAgent || 'Unavailable' }
  ])

  renderer.drawTextBlock(
    'This PDF was generated from the completed portal agreement shown to the signer in Seraphyn. It is not an appended signature page on a blank source form.',
    { size: 8.5, font: fonts.italic, color: COLORS.muted, lineHeight: 12, gapAfter: 0 }
  )

  renderer.drawFooterNumbers()
  return pdfDoc.save()
}

async function uploadSignedContract({ employerId, documentType, generatedFileName, bytes }) {
  const timestamp = Date.now()
  const safeName = sanitizeFileSegment(String(generatedFileName || '').replace(/\.pdf$/i, ''))
  const storagePath = `${employerId}/${documentType}-${timestamp}-${safeName}.pdf`
  const { error } = await supabase
    .storage
    .from('contracts')
    .upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (error) throw error
  return storagePath
}

async function upsertContractRecord({
  employerId,
  documentType,
  title,
  sourceFileName,
  signedStoragePath,
  signedAt,
  signerName,
  signerTitle,
  signerEmail,
  audit
}) {
  const useExtendedSchema = await supportsExtendedContractsSchema()
  const templateUrl = getPortalTemplateUrl(documentType)
  const { data: existing } = await supabase
    .from('contracts')
    .select('id')
    .eq('employer_id', employerId)
    .eq('template_url', templateUrl)
    .maybeSingle()

  const payload = {
    employer_id: employerId,
    template_url: templateUrl,
    signed_url: signedStoragePath,
    status: 'signed',
    signed_at: signedAt,
    sent_at: signedAt,
    updated_at: signedAt
  }

  if (useExtendedSchema) {
    payload.document_type = documentType
    payload.title = title
    payload.source_file_name = sourceFileName
    payload.signed_storage_path = signedStoragePath
    payload.signature_provider = 'portal-native'
    payload.signed_by_name = signerName
    payload.signed_by_email = signerEmail
    payload.signed_by_title = signerTitle || null
    payload.signature_audit = audit
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('contracts')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function signEmployerContracts({
  employer,
  signerName,
  signerTitle,
  signerEmail,
  signatureDataUrl,
  agreementFields = {},
  ipAddress,
  userAgent
}) {
  const signedAt = new Date().toISOString()
  const results = []

  for (const contract of CONTRACT_DEFINITIONS) {
    const fieldValues = agreementFields?.[contract.documentType] || {}
    const template = AGREEMENT_TEMPLATES[contract.documentType]
    if (!template) {
      throw new Error(`Missing agreement template for ${contract.documentType}`)
    }

    const agreementFieldValues = buildFieldValues({
      employer,
      signerName,
      signerTitle,
      signerEmail,
      fieldValues,
      signedAt
    })
    const acknowledgementIndexes = Array.isArray(fieldValues.acknowledgements)
      ? fieldValues.acknowledgements
      : []

    const signedBytes = await generateSignedAgreementPdf({
      contract,
      template,
      employer,
      signerName,
      signerTitle,
      signerEmail,
      signatureDataUrl,
      agreementFieldValues,
      acknowledgementIndexes,
      signedAt,
      ipAddress,
      userAgent
    })
    const generatedFileName = buildGeneratedFileName({ contract, employer, signedAt })

    const storagePath = await uploadSignedContract({
      employerId: employer.id,
      documentType: contract.documentType,
      generatedFileName,
      bytes: Buffer.from(signedBytes)
    })

    const audit = {
      signedAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      generatedFrom: 'portal-template',
      generatedFileName,
      agreementFields: fieldValues
    }

    const record = await upsertContractRecord({
      employerId: employer.id,
      documentType: contract.documentType,
      title: contract.title,
      sourceFileName: getPortalTemplateUrl(contract.documentType),
      signedStoragePath: storagePath,
      signedAt,
      signerName,
      signerTitle,
      signerEmail,
      audit
    })

    results.push({
      ...contract,
      generatedFileName,
      storagePath,
      record,
      signedBytes: Buffer.from(signedBytes)
    })
  }

  await supabase
    .from('employer_profiles')
    .update({
      contract_signed: true,
      contract_signed_at: signedAt,
      onboarding_stage: 'contract',
      updated_at: signedAt
    })
    .eq('id', employer.id)

  return {
    signedAt,
    contracts: results
  }
}

async function getContractDownloadUrl(storagePath) {
  const { data, error } = await supabase
    .storage
    .from('contracts')
    .createSignedUrl(storagePath, 60 * 10)

  if (error) throw error
  return data?.signedUrl || ''
}

async function sendSignedContractEmail({ employerEmail, ccEmail, employerName, contracts }) {
  const attachments = contracts.map((contract) => ({
    filename: contract.generatedFileName || `${contract.title}.pdf`,
    content: contract.signedBytes.toString('base64')
  }))

  return sendPortalEmail({
    to: employerEmail,
    cc: ccEmail,
    subject: 'Your signed Seraphyn agreements',
    text: `Hello ${employerName || 'there'},\n\nAttached are your signed Seraphyn agreements for your records.\n\nRegards,\nSeraphyn Care Solutions`,
    html: `<p>Hello ${employerName || 'there'},</p><p>Attached are your signed Seraphyn agreements for your records.</p><p>Regards,<br/>Seraphyn Care Solutions</p>`,
    attachments
  })
}

module.exports = {
  CONTRACT_DEFINITIONS,
  getContractSourcePath,
  getContractDownloadUrl,
  signEmployerContracts,
  sendSignedContractEmail
}
