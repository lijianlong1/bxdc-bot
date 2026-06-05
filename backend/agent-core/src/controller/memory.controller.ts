/**
 * 记忆管理控制器
 * 
 * 模块职责：
 * 1. 提供长期记忆的手动添加端点
 * 2. 允许外部系统直接向 mem0 服务添加记忆
 * 3. 主要用于调试和批量导入场景
 * 
 * 注意：
 * - 正常情况下记忆通过 Agent 对话自动提取和存储
 * - 本控制器提供的 addMemory 端点用于特殊场景的手动干预
 * 
 * 端点说明：
 * - POST /memory/add: 添加一条记忆到用户的长期记忆中
 * 
 * 依赖服务：
 * - MemoryService: 提供记忆的增删改查能力
 * 
 * @module MemoryController
 * @author Agent Core Team
 * @since 1.0.0
 */

import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { MemoryService } from '../mem/memory.service';

/**
 * 记忆管理控制器类
 * 
 * 装饰器说明：
 * @Controller('memory') - 基础路径为 /memory
 */
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  /**
   * 手动添加记忆端点
   * 
   * 使用场景：
   * - 调试记忆功能
   * - 批量导入用户画像数据
   * - 管理员手动修复错误记忆
   * 
   * 请求体：
   * - userId: 用户唯一标识符
   * - text: 记忆内容文本
   * - role: 发言者角色（可选，默认 'user'）
   * 
   * @param body - 记忆添加请求体
   * @returns 添加结果
   */
  @Post('add')
  addMemory(@Body() body: { userId: string; text: string; role?: 'user' | 'assistant' | 'system' }) {
    console.log('[MemoryController] Adding memory:', body);
    return this.memoryService.addMemory(body.userId, body.text, body.role);
  }

  @Get('profile')
  async getProfile(@Query('userId') userId: string) {
    const details = await this.memoryService.fetchUserProfile(userId);
    return { userId, details, success: !!details };
  }
}
