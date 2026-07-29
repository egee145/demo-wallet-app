import NfcManager, {
  Ndef,
  NdefStatus,
  NfcAdapter,
  NfcEvents,
  NfcTech,
  type TagEvent,
} from 'react-native-nfc-manager';
import { Platform } from 'react-native';

import { decodeStrictUserId, normalizeCanonicalUserId } from './ndef-text.parser';
import { isNfcCancellation } from './nfc-error';
import type {
  NfcAvailability,
  NfcDiagnosticsRecord,
  NfcDiagnosticsResult,
  NfcProvisionResult,
  NfcReadResult,
  NfcReaderPort,
} from './types';

const NFC_DIAGNOSTICS_TIMEOUT_MS = 120_000;
const NFC_READER_MODE_FLAGS =
  NfcAdapter.FLAG_READER_NFC_A |
  NfcAdapter.FLAG_READER_NFC_B |
  NfcAdapter.FLAG_READER_NFC_F |
  NfcAdapter.FLAG_READER_NFC_V;

const asBytes = (value: string | number[] | Uint8Array | undefined): number[] => {
  if (!value) {
    return [];
  }
  return typeof value === 'string'
    ? Array.from(new TextEncoder().encode(value))
    : Array.from(value);
};

const toHex = (bytes: number[]): string =>
  bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

const toBase64 = (bytes: number[]): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const block = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(block >> 18) & 63];
    output += alphabet[(block >> 12) & 63];
    output += second === undefined ? '=' : alphabet[(block >> 6) & 63];
    output += third === undefined ? '=' : alphabet[block & 63];
  }
  return output;
};

const mapRecord = (record: NonNullable<TagEvent['ndefMessage']>[number]): NfcDiagnosticsRecord => {
  const payload = asBytes(record.payload);
  return {
    tnf: record.tnf,
    type: asBytes(record.type),
    id: asBytes(record.id),
    payload,
    payloadHex: toHex(payload),
    payloadBase64: toBase64(payload),
  };
};

export class RealNfcReaderAdapter implements NfcReaderPort {
  private started = false;
  private rejectPending?: (error: Error) => void;

  async getAvailability(): Promise<NfcAvailability> {
    const supported = await NfcManager.isSupported();
    if (!supported) {
      return { supported: false, enabled: false };
    }

    await this.ensureStarted();
    return { supported: true, enabled: await NfcManager.isEnabled() };
  }

  async readDiagnostics(): Promise<NfcDiagnosticsResult> {
    const availability = await this.getAvailability();
    if (!availability.supported) {
      throw new Error('NFC_NOT_SUPPORTED');
    }
    if (!availability.enabled) {
      throw new Error('NFC_DISABLED');
    }

    const startedAt = Date.now();
    const tag = await new Promise<TagEvent>((resolve, reject) => {
      this.rejectPending = reject;
      const timeout = setTimeout(() => {
        this.rejectPending = undefined;
        void this.cancel();
        reject(new Error('NFC_READ_TIMEOUT'));
      }, NFC_DIAGNOSTICS_TIMEOUT_MS);

      NfcManager.setEventListener(NfcEvents.DiscoverTag, (event: TagEvent) => {
        clearTimeout(timeout);
        this.rejectPending = undefined;
        resolve(event);
      });
      void NfcManager.registerTagEvent({
        invalidateAfterFirstRead: true,
        isReaderModeEnabled: true,
        readerModeFlags: NFC_READER_MODE_FLAGS,
      }).catch((error: unknown) => {
        clearTimeout(timeout);
        this.rejectPending = undefined;
        reject(error instanceof Error ? error : new Error('NFC_REGISTER_FAILED'));
      });
    });

    await this.cancel();
    const records = (tag.ndefMessage ?? []).map(mapRecord);
    let decodedPayload: string | undefined;
    let canonicalUserId: string | undefined;
    let parserError: string | undefined;

    try {
      canonicalUserId = decodeStrictUserId(records);
      decodedPayload = canonicalUserId;
    } catch (error) {
      parserError = error instanceof Error ? error.message : 'NFC_PARSE_FAILED';
    }

    return {
      tagId: tag.id,
      techTypes: tag.techTypes ?? [],
      ndefSupported: records.length > 0,
      records,
      decodedPayload,
      canonicalUserId,
      parserError,
      startedAt,
      completedAt: Date.now(),
    };
  }

  async readUserId(): Promise<NfcReadResult> {
    const diagnostics = await this.readDiagnostics();
    if (!diagnostics.canonicalUserId) {
      throw new Error(diagnostics.parserError ?? 'INVALID_NFC_PAYLOAD');
    }

    return {
      userId: diagnostics.canonicalUserId,
      tagId: diagnostics.tagId,
      diagnostics,
    };
  }

  async provisionUserId(userId: string): Promise<NfcProvisionResult> {
    const canonicalUserId = normalizeCanonicalUserId(userId);
    const availability = await this.getAvailability();
    if (!availability.supported) {
      throw new Error('NFC_NOT_SUPPORTED');
    }
    if (!availability.enabled) {
      throw new Error('NFC_DISABLED');
    }

    const message = Ndef.encodeMessage([Ndef.textRecord(canonicalUserId, 'en')]);
    await this.cancel();

    try {
      try {
        await NfcManager.requestTechnology(NfcTech.Ndef, {
          isReaderModeEnabled: true,
          readerModeFlags: NFC_READER_MODE_FLAGS,
        });
      } catch (error) {
        if (isNfcCancellation(error)) {
          throw new Error('NFC_CANCELLED');
        }
        throw new Error('NFC_TAG_NOT_WRITABLE');
      }
      const tag = await NfcManager.getTag();
      let status: NdefStatus;
      let capacity: number;
      try {
        ({ status, capacity } = await NfcManager.ndefHandler.getNdefStatus());
      } catch {
        throw new Error('NFC_TAG_NOT_WRITABLE');
      }
      if (status !== NdefStatus.ReadWrite) {
        throw new Error(
          status === NdefStatus.ReadOnly ? 'NFC_TAG_READ_ONLY' : 'NFC_TAG_NOT_WRITABLE',
        );
      }
      if (message.length > capacity) {
        throw new Error('NFC_TAG_CAPACITY_EXCEEDED');
      }

      try {
        await NfcManager.ndefHandler.writeNdefMessage(message, { reconnectAfterWrite: true });
      } catch (error) {
        if (isNfcCancellation(error)) {
          throw new Error('NFC_CANCELLED');
        }
        throw new Error('NFC_WRITE_FAILED');
      }
      const verificationTag = await NfcManager.ndefHandler.getNdefMessage();
      const verificationRecords = (verificationTag?.ndefMessage ?? []).map(mapRecord);
      let verified = false;
      try {
        verified = decodeStrictUserId(verificationRecords) === canonicalUserId;
      } catch {
        verified = false;
      }

      return {
        userId: canonicalUserId,
        tagId: tag?.id,
        capacity,
        bytesWritten: message.length,
        verified,
      };
    } finally {
      await this.cancel();
    }
  }

  async openNfcSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      return await NfcManager.goToNfcSetting();
    } catch {
      return false;
    }
  }

  async cancel(): Promise<void> {
    this.rejectPending?.(new Error('NFC_CANCELLED'));
    this.rejectPending = undefined;
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    await Promise.allSettled([
      NfcManager.unregisterTagEvent(),
      NfcManager.cancelTechnologyRequest(),
    ]);
  }

  private async ensureStarted(): Promise<void> {
    if (this.started) {
      return;
    }

    await NfcManager.start();
    this.started = true;
  }
}
