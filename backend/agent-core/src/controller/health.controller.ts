/**
 * 健康检查控制器
 * 
 * 模块职责：
 * 1. 提供服务健康状态检查端点
 * 2. 返回服务基本信息（状态、名称、时间戳、运行时长）
 * 3. 供负载均衡器和监控系统进行健康探测
 * 
 * 端点说明：
 * - GET /health: 健康检查端点，返回 200 OK 表示服务正常
 * 
 * 返回字段：
 * - status: 服务状态（'ok' 表示正常）
 * - service: 服务名称（'agent-core'）
 * - version: 服务版本号（来自项目根目录 VERSION 文件）
 * - timestamp: 当前时间戳（ISO 8601 格式）
 * - uptimeSeconds: 进程运行时长（秒）
 * 
 * @module HealthController
 * @author Agent Core Team
 * @since 1.0.0
 */

import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 健康检查控制器类
 * 
 * 装饰器说明：
 * @Controller() - 空路径，方法路径直接映射到根路径
 */
@Controller()
export class HealthController {
  private readonly version: string;

  constructor() {
    this.version = this.loadVersion();
  }

  /**
   * 从项目根目录 VERSION 文件中读取版本号，若失败返回 'unknown'。
   */
  private loadVersion(): string {
    try {
      const raw = readFileSync(join(process.cwd(), 'VERSION'), 'utf-8');
      return raw.trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * 健康检查端点
   * 
   * 用途：
   * - Kubernetes liveness/readiness probe
   * - 负载均衡器健康检查
   * - 监控系统状态采集
   * 
   * @returns 健康状态对象
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'agent-core',
      version: this.version,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
