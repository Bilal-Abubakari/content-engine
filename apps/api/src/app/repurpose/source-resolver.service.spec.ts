import { BadRequestException } from '@nestjs/common';
import { SourceResolverService } from './source-resolver.service';

describe('SourceResolverService', () => {
  const service = new SourceResolverService();

  describe('text sources', () => {
    it.each<{ input: string }>([
      { input: 'raw brainstorm notes' },
      { input: 'a multi\nline paste' },
    ])('returns text sources untouched: "$input"', async ({ input }) => {
      await expect(service.resolve(input, 'text')).resolves.toBe(input);
    });
  });

  describe('SSRF guard for url sources', () => {
    it.each<{ label: string; url: string }>([
      { label: 'localhost', url: 'http://localhost/admin' },
      { label: 'loopback ip', url: 'http://127.0.0.1:3000/' },
      { label: '0.0.0.0', url: 'http://0.0.0.0/' },
      { label: 'private 10.x', url: 'http://10.0.0.5/' },
      { label: 'private 192.168.x', url: 'http://192.168.1.1/' },
      { label: 'private 172.16.x', url: 'http://172.16.0.1/' },
      { label: 'link-local metadata', url: 'http://169.254.169.254/latest/meta-data' },
      { label: '.internal host', url: 'http://db.internal/' },
      { label: '.local host', url: 'http://printer.local/' },
    ])('rejects a $label url', async ({ url }) => {
      await expect(service.resolve(url, 'url')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
