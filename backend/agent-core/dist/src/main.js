"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const core_1 = require("@nestjs/core");
const express_1 = require("express");
const path_1 = require("path");
const app_module_1 = require("./app.module");
const envPath = (0, path_1.resolve)(process.cwd(), '.env');
console.log('[Bootstrap] Loading .env from:', envPath);
const result = (0, dotenv_1.config)({ path: envPath });
if (result.error) {
    console.log('[Bootstrap] No .env file found or error loading:', result.error.message);
}
else {
    console.log('[Bootstrap] .env loaded successfully');
    console.log('[Bootstrap] AGENT_PROMPTS_LANGUAGE =', process.env.AGENT_PROMPTS_LANGUAGE || '(not set)');
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, express_1.json)({ limit: '50mb' }));
    app.use((0, express_1.urlencoded)({ limit: '50mb', extended: true }));
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(null, false);
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Agent-Token', 'X-Skill-Id', 'X-Session-Id'],
        credentials: true,
    });
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '0.0.0.0';
    await app.listen(port, host);
}
bootstrap();
//# sourceMappingURL=main.js.map