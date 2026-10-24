import { deflateRawSync } from 'node:zlib';
import { MAX_DIAGRAM_BYTES, validateDrawioXml } from './drawio-xml';

const model =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
describe('draw.io XML validation', () => {
  it('preserves an uncompressed editable multi-page document', () => {
    const xml = `<mxfile><diagram id="a">${model}</diagram><diagram id="b">${model}</diagram></mxfile>`;
    expect(validateDrawioXml(xml)).toBe(xml);
  });
  it('accepts compressed draw.io exports without changing their bytes', () => {
    const compressed = deflateRawSync(Buffer.from(encodeURIComponent(model))).toString('base64');
    const xml = `<mxfile><diagram id="a">${compressed}</diagram></mxfile>`;
    expect(validateDrawioXml(xml)).toBe(xml);
    expect(validateDrawioXml(model)).toBe(model);
  });
  it.each([
    '<html/>',
    '<mxfile/>',
    '<mxfile><diagram>broken!</diagram></mxfile>',
    '<mxGraphModel>',
    '<!DOCTYPE mxGraphModel [<!ENTITY x SYSTEM "file:///etc/passwd">]><mxGraphModel>&x;</mxGraphModel>',
  ])('rejects invalid diagrams and XML entities', (xml) => {
    expect(() => validateDrawioXml(xml)).toThrow();
  });
  it('rejects compressed expansion bombs', () => {
    const compressed = deflateRawSync(Buffer.from('x'.repeat(MAX_DIAGRAM_BYTES + 1))).toString(
      'base64',
    );
    expect(() => validateDrawioXml(`<mxfile><diagram>${compressed}</diagram></mxfile>`)).toThrow();
  });
});
