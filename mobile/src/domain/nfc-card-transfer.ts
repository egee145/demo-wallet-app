export function normalizeNfcTagUid(value: string): string {
  return value.replace(/[\s:-]/g, '').toLocaleLowerCase('en-US');
}

export function isSameNfcTag(first: string | undefined, second: string | undefined): boolean {
  if (!first || !second) {
    return false;
  }
  return normalizeNfcTagUid(first) === normalizeNfcTagUid(second);
}
