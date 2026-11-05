import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

/** Identify supported content from bytes; browser MIME is never authoritative. */
export function attachmentMime(name: string, bytes: Buffer): string {
  const ext = extname(name).toLowerCase();
  const starts = (hex: string) => bytes.subarray(0, hex.length / 2).equals(Buffer.from(hex, 'hex'));
  const ascii = (start: number, end: number) => bytes.toString('ascii', start, end);
  let mime: string | undefined;
  if (ext === '.pdf' && ascii(0, 5) === '%PDF-') mime = 'application/pdf';
  if (ext === '.png' && starts('89504e470d0a1a0a')) mime = 'image/png';
  if (['.jpg', '.jpeg'].includes(ext) && starts('ffd8ff')) mime = 'image/jpeg';
  if (ext === '.zip' && (starts('504b0304') || starts('504b0506'))) mime = 'application/zip';
  if (ext === '.wav' && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') mime = 'audio/wav';
  if (ext === '.ogg' && ascii(0, 4) === 'OggS') mime = 'audio/ogg';
  if (
    ext === '.webm' &&
    starts('1a45dfa3') &&
    bytes.subarray(0, 4096).includes(Buffer.from('webm'))
  )
    mime = 'video/webm';
  if (
    ext === '.mp3' &&
    (ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe6) === 0xe2))
  )
    mime = 'audio/mpeg';
  if (ext === '.aac' && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) mime = 'audio/aac';
  if (['.mp4', '.mov', '.m4a'].includes(ext) && ascii(4, 8) === 'ftyp')
    mime = ext === '.m4a' ? 'audio/mp4' : ext === '.mov' ? 'video/quicktime' : 'video/mp4';
  if (['.txt', '.csv'].includes(ext)) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (![...text].some((char) => char.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(char)))
        mime = ext === '.csv' ? 'text/csv' : 'text/plain';
    } catch {
      /* Invalid UTF-8 is not a supported text attachment. */
    }
  }
  if (!mime || !bytes.length)
    throw new BadRequestException('O conteúdo do arquivo não corresponde a um formato permitido.');
  return mime;
}
