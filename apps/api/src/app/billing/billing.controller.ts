import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { isPlanId, type SubscriptionView } from '@org/shared';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

/** Response for the checkout/portal endpoints: a URL to redirect the user to. */
interface RedirectResponse {
  url: string;
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * GET /api/billing/subscription
   * Current plan + status for the signed-in user's dashboard.
   */
  @Get('subscription')
  @UseGuards(AuthGuard)
  async subscription(
    @Req() req: AuthenticatedRequest,
  ): Promise<SubscriptionView> {
    return this.billing.getSubscriptionView(this.userId(req));
  }

  /**
   * POST /api/billing/checkout
   * Start a Stripe Checkout session for a paid plan and return its URL.
   */
  @Post('checkout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async checkout(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCheckoutDto,
  ): Promise<RedirectResponse> {
    if (!isPlanId(body.plan) || body.plan === 'free') {
      throw new BadRequestException('A valid paid plan is required.');
    }
    if (body.interval !== 'month' && body.interval !== 'year') {
      throw new BadRequestException('Interval must be "month" or "year".');
    }
    const url = await this.billing.createCheckoutSession(
      this.userId(req),
      req.user?.email,
      body.plan,
      body.interval,
    );
    return { url };
  }

  /**
   * POST /api/billing/portal
   * Open the Stripe Billing Portal for the signed-in user.
   */
  @Post('portal')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async portal(@Req() req: AuthenticatedRequest): Promise<RedirectResponse> {
    const url = await this.billing.createPortalSession(this.userId(req));
    return { url };
  }

  /**
   * POST /api/billing/webhook
   * Stripe-to-server webhook. NOT AuthGuard-protected: the Stripe signature is
   * the authentication. Requires the raw request body for signature checks.
   */
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature header.');
    }
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw request body.');
    }
    const event = this.stripe.constructEvent(req.rawBody, signature);
    await this.billing.handleEvent(event);
    return { received: true };
  }

  /** Extract the verified user id or reject the request. */
  private userId(req: AuthenticatedRequest): string {
    const sub = req.user?.sub;
    if (!sub) {
      throw new UnauthorizedException('No authenticated user.');
    }
    return sub;
  }
}
