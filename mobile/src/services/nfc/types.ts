export type NfcAvailability = {
  supported: boolean;
  enabled: boolean;
};

export type NfcDiagnosticsRecord = {
  tnf: number;
  type: number[];
  id: number[];
  payload: number[];
  payloadHex: string;
  payloadBase64: string;
};

export type NfcDiagnosticsResult = {
  tagId?: string;
  techTypes: string[];
  ndefSupported: boolean;
  records: NfcDiagnosticsRecord[];
  decodedPayload?: string;
  canonicalUserId?: string;
  parserError?: string;
  startedAt: number;
  completedAt: number;
};

export type NfcReadResult = {
  userId: string;
  tagId?: string;
  diagnostics: NfcDiagnosticsResult;
};

export type NfcProvisionResult = {
  userId: string;
  tagId?: string;
  capacity: number;
  bytesWritten: number;
  verified: boolean;
};

export interface NfcReaderPort {
  getAvailability(): Promise<NfcAvailability>;
  readDiagnostics(): Promise<NfcDiagnosticsResult>;
  readUserId(): Promise<NfcReadResult>;
  provisionUserId(userId: string): Promise<NfcProvisionResult>;
  cancel(): Promise<void>;
}
