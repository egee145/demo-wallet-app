import { env } from '../../config/env';
import { MockNfcReaderAdapter } from './mock-nfc-reader';
import { RealNfcReaderAdapter } from './real-nfc-reader';
import type { NfcReaderPort } from './types';

let reader: NfcReaderPort | undefined;

export const getNfcReader = (): NfcReaderPort => {
  if (!reader) {
    reader = __DEV__ && env.mockNfc ? new MockNfcReaderAdapter() : new RealNfcReaderAdapter();
  }
  return reader;
};

export * from './ndef-text.parser';
export * from './types';
