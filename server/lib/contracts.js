const fs = require('fs')
const path = require('path')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { supabase } = require('../config/supabase')
const { sendPortalEmail } = require('./mail')

const CONTRACT_DEFINITIONS = [
  {
    documentType: 'direct_hire',
    title: 'Direct Hire Agreement',
    fileName: 'Seraphyn Care Direct Hire Agreement  (1).pdf'
  },
  {
    documentType: 'staffing_boss',
    title: 'Per Diem Staffing Agreement',
    fileName: 'Seraphyn_Care_Solutions_Staffing_Agreement_BOSS.pdf'
  }
]

function getContractSourcePath(fileName) {
  return path.resolve(__dirname, '..', '..', fileName)
}

function extractBase64Payload(dataUrl = '') {
  const parts = String(dataUrl || '').split(',')
  return parts.length > 1 ? parts[1] : parts[0]
}

async function appendSignatureAuditPage({
  pdfBytes,
  title,
  employer,
  signerName,
  signerTitle,
  signerEmail,
  signatureDataUrl,
  signedAt,
  ipAddress,
  userAgent
}) {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const page = pdfDoc.addPage([612, 792])
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const signatureImage = await pdfDoc.embedPng(Buffer.from(extractBase64Payload(signatureDataUrl), 'base64'))
  const signatureDims = signatureImage.scale(0.4)
  let y = 744

  page.drawText(title, {
    x: 48,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.17, 0.24, 0.31)
  })
  y -= 34

  const lines = [
    `Organization: ${employer.org_name || ''}`,
    `Signer Name: ${signerName}`,
    `Signer Title: ${signerTitle || 'Not provided'}`,
    `Signer Email: ${signerEmail}`,
    `Signed At (UTC): ${signedAt}`,
    `IP Address: ${ipAddress || 'Unavailable'}`,
    `User Agent: ${userAgent || 'Unavailable'}`
  ]

  for (const line of lines) {
    page.drawText(line, {
      x: 48,
      y,
      size: 11,
      font,
      color: rgb(0.22, 0.29, 0.35)
    })
    y -= 22
  }

  y -= 8
  page.drawText('Electronic Signature', {
    x: 48,
    y,
    size: 13,
    font: boldFont,
    color: rgb(0.17, 0.24, 0.31)
  })
  y -= 100

  page.drawImage(signatureImage, {
    x: 48,
    y,
    width: Math.min(signatureDims.width, 240),
    height: Math.min(signatureDims.height, 80)
  })

  y -= 28
  page.drawLine({
    start: { x: 48, y },
    end: { x: 288, y },
    thickness: 1,
    color: rgb(0.7, 0.75, 0.8)
  })
  y -= 18

  page.drawText(
    'This agreement was executed electronically inside the Seraphyn portal. The attached signature image and audit data form the electronic execution record.',
    {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.38, 0.43, 0.48),
      maxWidth: 516,
      lineHeight: 14
    }
  )

  return pdfDoc.save()
}

async function uploadSignedContract({ employerId, documentType, fileName, bytes }) {
  const timestamp = Date.now()
  const storagePath = `${employerId}/${documentType}-${timestamp}.pdf`
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
  const { data: existing } = await supabase
    .from('contracts')
    .select('id')
    .eq('employer_id', employerId)
    .eq('document_type', documentType)
    .maybeSingle()

  const payload = {
    employer_id: employerId,
    document_type: documentType,
    title,
    template_url: `portal-template:${documentType}`,
    source_file_name: sourceFileName,
    signed_storage_path: signedStoragePath,
    signed_url: signedStoragePath,
    status: 'signed',
    signed_at: signedAt,
    sent_at: signedAt,
    signature_provider: 'portal-native',
    signed_by_name: signerName,
    signed_by_email: signerEmail,
    signed_by_title: signerTitle || null,
    signature_audit: audit,
    updated_at: signedAt
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
  ipAddress,
  userAgent
}) {
  const signedAt = new Date().toISOString()
  const results = []

  for (const contract of CONTRACT_DEFINITIONS) {
    const sourceBytes = fs.readFileSync(getContractSourcePath(contract.fileName))
    const signedBytes = await appendSignatureAuditPage({
      pdfBytes: sourceBytes,
      title: contract.title,
      employer,
      signerName,
      signerTitle,
      signerEmail,
      signatureDataUrl,
      signedAt,
      ipAddress,
      userAgent
    })

    const storagePath = await uploadSignedContract({
      employerId: employer.id,
      documentType: contract.documentType,
      fileName: contract.fileName,
      bytes: Buffer.from(signedBytes)
    })

    const audit = {
      signedAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    }

    const record = await upsertContractRecord({
      employerId: employer.id,
      documentType: contract.documentType,
      title: contract.title,
      sourceFileName: contract.fileName,
      signedStoragePath: storagePath,
      signedAt,
      signerName,
      signerTitle,
      signerEmail,
      audit
    })

    results.push({
      ...contract,
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
    filename: `${contract.title}.pdf`,
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
