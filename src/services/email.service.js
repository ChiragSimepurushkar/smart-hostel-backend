import nodemailer from 'nodemailer';

// Configure email transporter
console.log('DEBUG: SMTP_USER is', process.env.SMTP_USER);
console.log('DEBUG: SMTP_PASS exists?', !!process.env.SMTP_PASS);
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use this for more reliable Gmail connections
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, 
  },
});

/**
 * Send email
 */
export const sendEmail = async ({ to, subject, html, attachments }) => {
  // Guard clause: If credentials are missing, log a warning instead of throwing a fatal error
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Email Error: SMTP credentials missing from .env');
    return null; 
  }

  try {
    const mailOptions = {
      from: `"SmartWard" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Send email error:', error.message);
    // During a hackathon, we don't want an email failure to crash the whole Register process
    throw error; 
  }
};

export const sendBulkEmails = async (emails) => {
  const promises = emails.map(email => sendEmail(email));
  return Promise.allSettled(promises);
};