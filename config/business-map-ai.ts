/** Operational limits, not financial assumptions. One instance, no distributed quota store. */
export const businessMapAiPolicy = {
  version: "business-map-dialog-v1",
  maxMessageCharacters: 4000,
  maxContextCharacters: 6000,
  maxRequestCharacters: 12000,
  maxReplyCharacters: 18000,
  maxOutputTokens: 2200,
  timeoutMs: 15000,
  maxRequestsPerMinute: 8,
  maxDailyCallsPerInstance: 30,
  maxInFlight: 1,
  maxRequestIds: 256,
  maxBrowserAiRequests: 8,
  maxMessages: 80,
  mainQuestions: 4,
  maxProcesses: 5,
  maxLocations: 10000,
} as const;
