const { Resend } = require('resend')

function getMailer() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return null
  }

  return new Resend(apiKey)
}

function getFromAddress() {
  return process.env.PORTAL_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || ''
}

async function sendPortalEmail({ to, cc, subject, text, html, attachments }) {
  const mailer = getMailer()
  const from = getFromAddress()

  if (!mailer || !from || !to) {
    return { skipped: true, reason: 'Email delivery not configured' }
  }

  try {
    const data = await mailer.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      ...(cc ? { cc: Array.isArray(cc) ? cc : [cc] } : {}),
      subject,
      text,
      ...(html ? { html } : {}),
      ...(attachments?.length ? { attachments } : {})
    })

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send portal email:', error.message)
    return { success: false, error: error.message }
  }
}

module.exports = {
  sendPortalEmail
}
