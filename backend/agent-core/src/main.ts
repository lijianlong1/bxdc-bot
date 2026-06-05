/**
 * Agent Core 服务入口文件
 * 
 * 模块职责：
 * 1. 初始化 NestJS 应用程序框架
 * 2. 配置跨域支持（CORS）
 * 3. 启动 HTTP 服务器监听指定端口和主机
 * 
 * 架构说明：
 * - 使用 NestJS 作为底层框架，提供依赖注入、模块化等能力
 * - 端口号通过环境变量 PORT 配置，默认为 3000
 * - 主机地址通过环境变量 HOST 配置，默认为 0.0.0.0（监听所有接口）
 * 
 * 环境变量：
 * - PORT: 服务监听端口（默认：3000）
 * - HOST: 服务监听地址（默认：0.0.0.0）
 * 
 * @module Main
 * @author Agent Core Team
 * @since 1.0.0
 */

import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { resolve } from 'path';
import { AppModule } from './app.module';

// 尽早加载 .env 文件，确保环境变量在模块导入前可用
// 这对于 prompts 模块在启动时正确选择语言至关重要
// 显式指定路径以确保能找到 .env 文件
const envPath = resolve(process.cwd(), '.env');
console.log('[Bootstrap] Loading .env from:', envPath);
const result = config({ path: envPath });
if (result.error) {
  console.log('[Bootstrap] No .env file found or error loading:', result.error.message);
} else {
  console.log('[Bootstrap] .env loaded successfully');
  console.log('[Bootstrap] AGENT_PROMPTS_LANGUAGE =', process.env.AGENT_PROMPTS_LANGUAGE || '(not set)');
}

/**
 * 启动 NestJS 应用程序
 * 
 * 流程：
 * 1. 使用 NestFactory 创建应用实例，加载 AppModule 根模块
 * 2. 启用 CORS 跨域支持，允许前端应用访问
 * 3. 从环境变量读取端口和主机配置
 * 4. 启动 HTTP 服务器，开始监听请求
 * 
 * 错误处理：
 * - 若端口被占用，Node.js 会抛出 EADDRINUSE 错误
 * - 启动失败时会打印错误信息到 stderr
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 任务 7/8 文件上传会带 base64 编码内容（1MB 文件 ≈ 1.4MB JSON）
  // 默认 bodyParser 限制 100kb 不够用，显式提到 50mb
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  app.enableCors({
    origin: (origin, callback) => {
      // 无 Origin 头（同源请求或服务端调用）直接放行
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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
