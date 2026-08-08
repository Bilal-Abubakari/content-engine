import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { jwtVerify } from 'jose';

/** The verified session claims we attach to the request. */
export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
}

/** Express request augmented with the authenticated user. */
export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

/**
 * Protects API routes by verifying the JWT that the Next.js server mints
 * for the authenticated NextAuth session. The token is expected as a
 * `Bearer` credential in the Authorization header and is verified with the
 * shared `AUTH_SECRET` (HS256).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Server auth secret is not configured.');
    }

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
      );
      request.user = {
        sub: String(payload.sub ?? ''),
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token.');
    }
  }

  /** Pull the raw JWT out of an `Authorization: Bearer <token>` header. */
  extractBearerToken(request: AuthenticatedRequest): string | null {
    const header = request.headers?.authorization;
    if (!header) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      return null;
    }
    return value.trim();
  }
}
