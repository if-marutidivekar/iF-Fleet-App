import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Disable Express ETag generation.
  // ETags cause clients to receive 304 Not Modified for live-data endpoints
  // (trips, assignments, notifications) even when the underlying data has changed.
  // React Query manages its own stale/refetch lifecycle, so server-side ETags add
  // no benefit and only risk serving stale responses.
  app.getHttpAdapter().getInstance().disable('etag');

  // Security headers
  app.use(helmet());

  // CORS — tighten in production
  app.enableCors({
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe — strip unknown fields, transform payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // Swagger (dev/staging only)
  if (process.env['NODE_ENV'] !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('iF Fleet Management API')
      .setDescription('Fleet Management Platform — internal API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
  logger.log(`iF Fleet API running on port ${port}`);
}

bootstrap();
