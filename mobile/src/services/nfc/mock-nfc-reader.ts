import { normalizeCanonicalUserId } from './ndef-text.parser';
import type {
  NfcAvailability,
  NfcDiagnosticsResult,
  NfcProvisionResult,
  NfcReadResult,
  NfcReaderPort,
} from './types';

const MOCK_USER_ID = '7d4d82a1-0000-4000-8000-000000000000';

export class MockNfcReaderAdapter implements NfcReaderPort {
  getAvailability(): Promise<NfcAvailability> {
    return Promise.resolve({ supported: true, enabled: true });
  }

  readDiagnostics(): Promise<NfcDiagnosticsResult> {
    const now = Date.now();
    return Promise.resolve({
      tagId: 'mock-tag',
      techTypes: ['Ndef'],
      ndefSupported: true,
      records: [],
      decodedPayload: MOCK_USER_ID,
      canonicalUserId: MOCK_USER_ID,
      startedAt: now,
      completedAt: now,
    });
  }

  async readUserId(): Promise<NfcReadResult> {
    const diagnostics = await this.readDiagnostics();
    return {
      userId: MOCK_USER_ID,
      tagId: diagnostics.tagId,
      diagnostics,
    };
  }

  provisionUserId(userId: string): Promise<NfcProvisionResult> {
    const canonicalUserId = normalizeCanonicalUserId(userId);
    return Promise.resolve({
      userId: canonicalUserId,
      tagId: '04a1b2c3d4e5f6',
      capacity: 144,
      bytesWritten: canonicalUserId.length + 7,
      verified: true,
    });
  }

  async cancel(): Promise<void> {}
}
