// PLACEHOLDER sample data until the backend and the Visionline connection exist (see
// entries/75-keycard-integration.md). Keys are 14 digits (Q-75-1).
export const mockEncoderKeys = (): string[] => ['48001937465201', '48001937465202'];

/** What the mock "Visionline" returns when asked for its encoders: one key, always. */
export const MOCK_RETRIEVED_ENCODERS: readonly string[] = ['48001937465203'];
