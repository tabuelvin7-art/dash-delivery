/**
 * Mock implementations for external services (M-Pesa, SMS).
 * Used in integration tests to avoid real API calls.
 */

export const mockMpesaService = {
  initiateSTKPush: jest.fn().mockResolvedValue({
    CheckoutRequestID: 'mock-checkout-id',
    ResponseCode: '0',
    ResponseDescription: 'Success',
  }),
  queryPaymentStatus: jest.fn().mockResolvedValue({
    ResultCode: '0',
    ResultDesc: 'The service request is processed successfully.',
  }),
};

export const mockSmsService = {
  sendSms: jest.fn().mockResolvedValue({ status: 'sent', messageId: 'mock-msg-id' }),
};

export const mockNotificationService = {
  createNotification: jest.fn().mockResolvedValue({ _id: 'mock-notif-id' }),
  sendStatusChangeNotification: jest.fn().mockResolvedValue(undefined),
  sendPaymentNotification: jest.fn().mockResolvedValue(undefined),
  sendReleaseCodeNotification: jest.fn().mockResolvedValue(undefined),
};

/** Reset all mocks between tests */
export function resetMocks(): void {
  mockMpesaService.initiateSTKPush.mockClear();
  mockMpesaService.queryPaymentStatus.mockClear();
  mockSmsService.sendSms.mockClear();
  mockNotificationService.createNotification.mockClear();
  mockNotificationService.sendStatusChangeNotification.mockClear();
  mockNotificationService.sendPaymentNotification.mockClear();
  mockNotificationService.sendReleaseCodeNotification.mockClear();
}
