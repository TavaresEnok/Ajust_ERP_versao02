import { BadRequestException } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { inflateRawSync } from 'node:zlib';

export const MAX_DIAGRAM_BYTES = 8 * 1024 * 1024;

/** Validate without resolving entities, preserving the original multi-page draw.io document. */
export function validateDrawioXml(xml: string) {
  const invalid = () =>
    new BadRequestException(
      'Arquivo inválido. Use um diagrama editável do draw.io (.drawio ou XML).',
    );
  if (Buffer.byteLength(xml, 'utf8') > MAX_DIAGRAM_BYTES) {
    throw new BadRequestException('A topologia deve ter no máximo 8 MB.');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw invalid();
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    parseTagValue: false,
  });
  const parsed = parser.parse(xml);
  if (parsed.mxGraphModel && typeof parsed.mxGraphModel === 'object') return xml;
  const pages = parsed.mxfile?.diagram;
  if (!pages) throw invalid();
  let expandedBytes = 0;
  const diagrams = Array.isArray(pages) ? pages : [pages];
  if (diagrams.length > 100)
    throw new BadRequestException('Use no máximo 100 páginas por topologia.');
  for (const page of diagrams) {
    if (page && typeof page === 'object' && page.mxGraphModel) continue;
    const text = typeof page === 'string' ? page : page?.['#text'];
    if (typeof text !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(text)) throw invalid();
    try {
      const decoded = decodeURIComponent(
        inflateRawSync(Buffer.from(text, 'base64'), {
          maxOutputLength: MAX_DIAGRAM_BYTES,
        }).toString('utf8'),
      );
      expandedBytes += Buffer.byteLength(decoded, 'utf8');
      if (
        expandedBytes > MAX_DIAGRAM_BYTES ||
        /<!DOCTYPE|<!ENTITY/i.test(decoded) ||
        XMLValidator.validate(decoded) !== true ||
        !parser.parse(decoded).mxGraphModel
      )
        throw invalid();
    } catch {
      throw invalid();
    }
  }
  return xml;
}
