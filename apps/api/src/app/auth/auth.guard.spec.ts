import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SignJWT } from 'jose';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard';

const SECRET = 'test-secret-value-for-unit-tests';

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request as AuthenticatedRequest }),
  } as ExecutionContext;
}

async function signToken(
  claims: Record<string, unknown>,
  secret = SECRET,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-123')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
}

describe('AuthGuard', () => {
  let guard: AuthGuard;

  beforeEach(() => {
    guard = new AuthGuard();
    process.env.AUTH_SECRET = SECRET;
  });

  describe('extractBearerToken', () => {
    it.each<{ label: string; header: string | undefined; expected: string | null }>(
      [
        { label: 'valid bearer', header: 'Bearer abc.def.ghi', expected: 'abc.def.ghi' },
        { label: 'lowercase scheme', header: 'bearer tok', expected: 'tok' },
        { label: 'missing header', header: undefined, expected: null },
        { label: 'wrong scheme', header: 'Basic abc', expected: null },
        { label: 'no token value', header: 'Bearer ', expected: null },
      ],
    )('returns $expected for $label', ({ header, expected }) => {
      const request = {
        headers: header ? { authorization: header } : {},
      } as AuthenticatedRequest;
      expect(guard.extractBearerToken(request)).toBe(expected);
    });
  });

  describe('canActivate', () => {
    it('allows a request bearing a valid signed token', async () => {
      const token = await signToken({ email: 'a@b.com', name: 'Ada' });
      const request: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
      };

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
      expect(request.user).toMatchObject({ sub: 'user-123', email: 'a@b.com' });
    });

    it.each<{ label: string; authorization?: string }>([
      { label: 'no authorization header' },
      { label: 'malformed header', authorization: 'Bearer not-a-jwt' },
    ])('rejects when $label', async ({ authorization }) => {
      const request: Partial<AuthenticatedRequest> = {
        headers: authorization ? { authorization } : {},
      };
      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a token signed with the wrong secret', async () => {
      const token = await signToken({ email: 'a@b.com' }, 'a-different-secret');
      const request: Partial<AuthenticatedRequest> = {
        headers: { authorization: `Bearer ${token}` },
      };
      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
