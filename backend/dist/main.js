"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: [
            'http://localhost:3001',
            'http://localhost:5173',
            'https://psych.ruki-ai.com',
        ],
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    const config = new swagger_1.DocumentBuilder()
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
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
//# sourceMappingURL=main.js.map