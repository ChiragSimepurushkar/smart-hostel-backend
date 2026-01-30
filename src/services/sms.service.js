// services/smsService.js
import twilio from 'twilio';

// Initialize Twilio client
const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

/**
 * Send SMS
 */
export async function sendSMS({ to, message }) {
  try {
    if (!client) {
      console.log('SMS service not configured. Message:', message);
      return;
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    console.log('SMS sent:', result.sid);
    return result;
  } catch (error) {
    console.error('Send SMS error:', error);
    // Don't throw - SMS is not critical
  }
}

/**
 * Send bulk SMS
 */
export async function sendBulkSMS(messages) {
  const promises = messages.map(msg => sendSMS(msg));
  return Promise.allSettled(promises);
}
