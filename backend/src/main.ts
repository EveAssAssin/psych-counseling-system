import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:5173',
      'https://psych.ruki-ai.com',
    ],
    credentials: true,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API 文件
  const config = new DocumentBuilder()
    .setTitle('心理輔導系統 API')
    .setDescription('Psych Counseling Management System API')
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('auth', '認證相關')
    .addTag('employees', '員工管理')
    .addTag('conversations', '對話管理')
    .addTag('analysis', 'AI 分析')
    .addTag('risk-flags', '風險標記')
    .addTag('sync', '資料同步')
    .addTag('query', '問答查詢')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════╗
║       心理輔導系統 Backend v2.0                    ║
║       Server running on http://localhost:${port}      ║
║       API Docs: http://localhost:${port}/api/docs     ║
╚═══════════════════════════════════════════════════╝
  `);
}

bootstrap();
