/**
 * Agent Core 根模块定义
 * 
 * 模块职责：
 * 1. 定义 NestJS 应用的根模块（AppModule）
 * 2. 导入所需的 NestJS 核心模块（ConfigModule 用于环境变量管理）
 * 3. 注册所有控制器（Controllers），处理 HTTP 请求路由
 * 4. 注册所有提供者（Providers），提供业务逻辑服务
 * 
 * 模块结构：
 * - 控制器层：处理 HTTP 请求/响应，包括 Agent、Health、Memory、User、Avatar、SkillProxy
 * - 服务层：提供核心业务逻辑，包括 MemoryService（长期记忆）、SkillManager（技能管理）、LoggerService（日志）
 * 
 * 配置说明：
 * - ConfigModule.forRoot() 自动加载 .env 文件中的环境变量
 * - 所有服务通过依赖注入（DI）获取所需配置
 * 
 * @module AppModule
 * @author Agent Core Team
 * @since 1.0.0
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './controller/agent.controller';
import { HealthController } from './controller/health.controller';
import { MemoryController } from './controller/memory.controller';
import { UserController } from './controller/user.controller';
import { AvatarController } from './features/avatar/avatar.controller';
import { OptimizeTextController } from './features/optimize-text/optimize-text.controller';
import { SkillProxyController } from './features/skills/skill-proxy.controller';
import { MemoryService } from './mem/memory.service';
import { SkillManager } from './skills/skill.manager';
import { LoggerService } from './utils/logger.service';

/**
 * 应用程序根模块
 * 
 * 装饰器说明：
 * @Module - NestJS 模块装饰器，定义模块的元数据
 * 
 * 属性说明：
 * - imports: 导入的其他模块，ConfigModule 提供配置管理能力
 * - controllers: 控制器数组，处理各类 HTTP 端点
 * - providers: 服务提供者数组，可被注入到其他组件中
 */
@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [AgentController, HealthController, MemoryController, UserController, AvatarController, OptimizeTextController, SkillProxyController],
  providers: [MemoryService, SkillManager, LoggerService],
})
export class AppModule {}
