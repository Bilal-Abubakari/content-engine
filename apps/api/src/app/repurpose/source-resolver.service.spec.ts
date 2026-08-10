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

  describe('unsupportedSourceLabel', () => {
    it.each<{ label: string; hostname: string; expected: string | null }>([
      { label: 'youtube.com', hostname: 'youtube.com', expected: 'YouTube' },
      { label: 'www subdomain', hostname: 'www.youtube.com', expected: 'YouTube' },
      { label: 'mobile subdomain', hostname: 'm.youtube.com', expected: 'YouTube' },
      { label: 'short link', hostname: 'youtu.be', expected: 'YouTube' },
      { label: 'uppercased host', hostname: 'VIMEO.COM', expected: 'Vimeo' },
      { label: 'spotify subdomain', hostname: 'open.spotify.com', expected: 'Spotify' },
      { label: 'x.com', hostname: 'x.com', expected: 'X (Twitter)' },
      { label: 'a normal blog', hostname: 'blog.example.com', expected: null },
      { label: 'a look-alike host', hostname: 'notyoutube.com', expected: null },
    ])('maps $label to $expected', ({ hostname, expected }) => {
      expect(SourceResolverService.unsupportedSourceLabel(hostname)).toBe(
        expected,
      );
    });
  });

  describe('rejects unsupported platforms before fetching', () => {
    it.each<{ label: string; url: string }>([
      { label: 'a youtube watch url', url: 'https://www.youtube.com/watch?v=abc' },
      { label: 'a youtu.be short url', url: 'https://youtu.be/abc' },
      { label: 'a tiktok url', url: 'https://www.tiktok.com/@user/video/1' },
      { label: 'an instagram reel', url: 'https://instagram.com/reel/xyz' },
    ])('rejects $label with a clear message', async ({ url }) => {
      await expect(service.resolve(url, 'url')).rejects.toBeInstanceOf(
        BadRequestException,
      );
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
      { label: 'ipv6 loopback', url: 'http://[::1]:3000/' },
      { label: 'ipv6 unspecified', url: 'http://[::]/' },
      { label: 'ipv6 unique-local', url: 'http://[fd00::1]/' },
      { label: 'ipv6 link-local', url: 'http://[fe80::1]/' },
      { label: 'ipv4-mapped loopback', url: 'http://[::ffff:127.0.0.1]/' },
    ])('rejects a $label url', async ({ url }) => {
      await expect(service.resolve(url, 'url')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
