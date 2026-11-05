import { attachmentMime } from './attachment-content';
describe('Attachment content validation', () => {
  it('rejects forged image names and binary text', () => {
    expect(() => attachmentMime('image.png', Buffer.from('<script>bad</script>'))).toThrow();
    expect(() => attachmentMime('data.txt', Buffer.from([0xff, 0x00]))).toThrow();
    expect(() => attachmentMime('payload.exe', Buffer.from('MZ'))).toThrow();
  });
  it('derives MIME independently from browser declarations', () => {
    expect(attachmentMime('report.PDF', Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(attachmentMime('note.txt', Buffer.from('Anotação\n'))).toBe('text/plain');
    expect(attachmentMime('image.png', Buffer.from('89504e470d0a1a0a', 'hex'))).toBe('image/png');
  });
});
