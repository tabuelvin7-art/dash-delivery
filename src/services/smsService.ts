import axios from 'axios';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SMS_API_KEY = process.env.SMS_API_KEY ?? '';
const SMS_USERNAME = process.env.SMS_USERNAME ?? '';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID ?? 'NAIROBI_DEL';

const AT_SMS_URL = 'https://api.africastalking.com/version1/messaging';
const MAX_SMS_LENGTH = 160;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SMSResult {
  phoneNumber: string;
  message: string;
  deliveryStatus: 'delivered' | 'failed';
  retryCount: number;
  errorMessage?: string;
}

interface ATRecipient {
  number: string;
  status: string;
  statusCode: number;
  cost: string;
  messageId: string;
}

interface ATSMSResponse {
  SMSMessageData: {
    Message: string;
    Recipients: ATRecipient[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a message to 160 characters, logging a warning if truncation occurs.
 */
export function enforceMessageLength(message: string): string {
  if (message.length <= MAX_SMS_LENGTH) return message;

  logger.warn(
    `SMS message truncated from ${message.length} to ${MAX_SMS_LENGTH} characters. ` +
      `Original: "${message.slice(0, 40)}..."`
  );
  return message.slice(0, MAX_SMS_LENGTH);
}

/**
 * Attempt a single SMS send via Africa's Talking REST API.
 * Throws on HTTP or API-level errors.
 */
async function attemptSend(phoneNumber: string, message: string): Promise<void> {
  const params = new URLSearchParams({
    username: SMS_USERNAME,
    to: phoneNumber,
    message,
    ...(SMS_SENDER_ID ? { from: SMS_SENDER_ID } : {}),
  });

  const response = await axios.post<ATSMSResponse>(AT_SMS_URL, params.toString(), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey: SMS_API_KEY,
    },
    timeout: 10_000,
  });

  const recipients: ATRecipient[] = response.data?.SMSMessageData?.Recipients ?? [];
  if (recipients.length === 0) {
    throw new Error('Africa\'s Talking returned no recipients in response');
  }

  // statusCode 101 = success in Africa's Talking
  const recipient = recipients[0];
  if (recipient.statusCode !== 101) {
    throw new Error(`Africa's Talking error: ${recipient.status} (code ${recipient.statusCode})`);
  }
}

// ---------------------------------------------------------------------------
// Task 6.1 – sendSMS
// ---------------------------------------------------------------------------

/**
 * Send an SMS to the given phone number.
 *
 * - Enforces 160-character limit (truncates with warning if exceeded)
 * - Retries up to 3 times on failure
 * - Returns an SMSResult with deliveryStatus and retryCount
 *
 * Requirements: 24.1, 24.4, 24.5
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
  const safeMessage = enforceMessageLength(message);

  let retryCount = 0;
  let lastError: Error | undefined;

  while (retryCount < MAX_RETRIES) {
    try {
      await attemptSend(phoneNumber, safeMessage);

      logger.info(`SMS delivered to ${phoneNumber} after ${retryCount} retries`);
      return {
        phoneNumber,
        message: safeMessage,
        deliveryStatus: 'delivered',
        retryCount,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      retryCount += 1;
      logger.warn(
        `SMS send attempt ${retryCount}/${MAX_RETRIES} failed for ${phoneNumber}: ${lastError.message}`
      );
    }
  }

  logger.error(
    `SMS delivery failed for ${phoneNumber} after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );

  return {
    phoneNumber,
    message: safeMessage,
    deliveryStatus: 'failed',
    retryCount,
    errorMessage: lastError?.message,
  };
}
