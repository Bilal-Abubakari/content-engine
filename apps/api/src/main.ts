import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from './app/common/http-exception.filter';
import { validateEnv } from './app/config/env';

async function bootstrap() {
  // Fail fast with a clear message if the environment is misconfigured.
  const env = validateEnv();

  // `rawBody: true` preserves the unparsed request body so the Stripe webhook
  // can verify signatures against the exact bytes Stripe signed.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers (CSP, HSTS, no-sniff, etc.) on every response.
  app.use(helmet());

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Restrict browser access to the configured web origin.
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  // Uniform JSON error envelope; hides internal details on 5xx.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Flush and disconnect cleanly on shutdown (closes the Prisma pool).
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  Logger.log(
    `🚀 Application is running on: http://localhost:${env.PORT}/${globalPrefix}`,
  );
}

bootstrap();
