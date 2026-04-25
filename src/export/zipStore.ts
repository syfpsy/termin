export type ZipEntry = {
  name: string;
  data: Uint8Array;
  modified?: Date;
};

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_SIG = 0x06054b50;
const ZIP_VERSION = 20;
const METHOD_STORE = 0;

export function buildStoreZip(entries: ZipEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;
  const textEncoder = new TextEncoder();

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const { dosTime, dosDate } = toDosTime(entry.modified ?? new Date());

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_HEADER_SIG, true);
    localView.setUint16(4, ZIP_VERSION, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, METHOD_STORE, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, entry.data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, CENTRAL_HEADER_SIG, true);
    centralView.setUint16(4, ZIP_VERSION, true);
    centralView.setUint16(6, ZIP_VERSION, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, METHOD_STORE, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, size, true);
    centralView.setUint32(24, size, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralHeaders.push(central);

    offset += local.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const header of centralHeaders) {
    parts.push(header);
    centralSize += header.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_OF_CENTRAL_SIG, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);
  endView.setUint16(20, 0, true);
  parts.push(end);

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { dosDate, dosTime };
}

/**
 * Read STORE-encoded ZIP entries written by `buildStoreZip`. Refuses to
 * decompress (we never write compressed entries) and validates the CRC
 * of every payload so a corrupted file errors clearly instead of
 * loading bogus data.
 */
export function readStoreZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22) throw new Error('ZIP too small to contain an end-of-central-directory record');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();

  // The EOCD signature can be up to 65557 bytes from the end if there is
  // a trailing comment, but our writer never writes one. Scan from the
  // last 22 bytes backwards to be lenient.
  let eocd = -1;
  const minScan = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minScan; i -= 1) {
    if (view.getUint32(i, true) === END_OF_CENTRAL_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record not found');

  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralStart = view.getUint32(eocd + 16, true);
  if (centralStart + centralSize > bytes.length) {
    throw new Error('ZIP central directory points outside the file');
  }

  const entries: ZipEntry[] = [];
  let cursor = centralStart;
  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_HEADER_SIG) {
      throw new Error(`ZIP central directory header missing at entry ${i}`);
    }
    const method = view.getUint16(cursor + 10, true);
    const dosTime = view.getUint16(cursor + 12, true);
    const dosDate = view.getUint16(cursor + 14, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));

    if (method !== METHOD_STORE) {
      throw new Error(`ZIP entry "${name}" uses compression method ${method}; only STORE (0) is supported`);
    }
    if (compressedSize !== uncompressedSize) {
      throw new Error(`ZIP entry "${name}" has mismatched compressed/uncompressed sizes`);
    }

    if (view.getUint32(localOffset, true) !== LOCAL_HEADER_SIG) {
      throw new Error(`ZIP local header missing for "${name}"`);
    }
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = bytes.slice(dataStart, dataStart + uncompressedSize);
    if (crc32(data) !== crc) {
      throw new Error(`ZIP entry "${name}" failed CRC32 check`);
    }

    entries.push({ name, data, modified: fromDosTime(dosTime, dosDate) });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function fromDosTime(dosTime: number, dosDate: number): Date {
  const year = ((dosDate >> 9) & 0x7f) + 1980;
  const month = ((dosDate >> 5) & 0x0f) - 1;
  const day = dosDate & 0x1f;
  const hour = (dosTime >> 11) & 0x1f;
  const minute = (dosTime >> 5) & 0x3f;
  const second = (dosTime & 0x1f) * 2;
  return new Date(year, month, day, hour, minute, second);
}
