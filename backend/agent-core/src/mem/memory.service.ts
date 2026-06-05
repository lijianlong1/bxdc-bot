/**
 * 长期记忆服务模块
 * 
 * 模块职责：
 * 1. 与 mem0 服务通信，实现长期记忆的存储和检索
 * 2. 在 Agent 对话过程中自动提取和存储用户画像信息
 * 3. 支持基于语义的相似度搜索
 * 4. 提供记忆的添加、搜索、处理轮次对话等能力
 * 
 * 服务架构：
 * - 本服务作为 mem0 服务的客户端
 * - mem0 提供向量存储和语义搜索能力
 * - 通过 HTTP API 与 mem0 通信
 * 
 * 记忆生命周期：
 * 1. Agent 对话完成后，调用 processTurn() 处理一轮对话
 * 2. 提取用户指令和助手回复中的关键信息
 * 3. 调用 mem0 API 存储记忆
 * 4. 新对话开始时，调用 searchMemories() 检索相关记忆
 * 5. 将检索到的记忆注入到提示词中
 * 
 * 记忆使用场景：
 * - 用户画像：籍贯、家乡、喜好、昵称
 * - 家庭信息：儿子名字、女儿名字、爱人名字
 * - 历史上下文：之前讨论过的内容
 * 
 * 环境变量：
 * - MEM0_URL: mem0 服务地址（默认：http://39.104.81.41:8001）
 * - MEM0_ENABLED: 是否启用记忆功能（默认：true）
 * 
 * API 端点：
 * - POST /msearch: 语义搜索记忆
 * - POST /madd: 添加记忆
 * - POST /mprocess: 处理对话轮次
 * 
 * @module MemoryService
 * @author Agent Core Team
 * @since 1.0.0
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { LoggerService } from '../utils/logger.service';

@Injectable()
export class MemoryService implements OnModuleInit {
  private mem0Url: string;
  private readonly mem0Enabled: boolean;

  constructor(private readonly logger: LoggerService) {
    this.mem0Enabled = this.readMem0EnabledFlag();
  }

  onModuleInit() {
    this.mem0Url = process.env.MEM0_URL || 'http://39.104.81.41:8001';
    if (!this.mem0Enabled) {
      console.log('[MemoryService] mem0 is disabled (MEM0_ENABLED=false); search/store skipped');
      return;
    }
    console.log(`[MemoryService] Initialized with mem0 service at: ${this.mem0Url}`);
  }

  private readMem0EnabledFlag(): boolean {
    const v = process.env.MEM0_ENABLED?.trim().toLowerCase();
    if (v === 'false' || v === '0' || v === 'off' || v === 'no' || v === 'disabled') {
      return false;
    }
    return true;
  }

  /**
   * Search for relevant memories based on user query using mem0 service
   */
  async searchMemories(query: string, userId?: string, limit = 10): Promise<string[]> {
    if (!this.mem0Enabled) {
      return [];
    }
    if (!userId) {
      console.warn('[MemoryService] searchMemories skipped: userId is missing');
      return [];
    }

    try {
      const requestData = {
        sentence: query,
        userid: userId,
        topk: limit
      };
      
      const response = await axios.post(`${this.mem0Url}/msearch`, requestData);

      if (response.data && response.data.code === 200) {
        // 根据文档和用户反馈，尝试多种可能的字段名
        // 1. 尝试 results, data, memories (常见规范)
        // 2. 尝试 details (文档中提到的字段)
        const rawResults = response.data.results || 
                           response.data.data || 
                           response.data.memories || 
                           response.data.details || 
                           [];
        
        let results: string[] = [];
        if (Array.isArray(rawResults)) {
          results = rawResults.map(item => typeof item === 'string' ? item : JSON.stringify(item));
        } else if (typeof rawResults === 'string' && rawResults.length > 0) {
          // 如果 details 是以逗号或换行分隔的字符串，进行拆分
          results = rawResults.split(/[\n,，]/).filter(s => s.trim().length > 0);
        }

        this.logger.logMemory('retrieve', {
          request: requestData,
          response: response.data,
          parsedResults: results
        });

        console.log(`[MemoryService] Found ${results.length} memories for query: "${query}"`);
        return results;
      }
      
      this.logger.logMemory('retrieve', {
        request: requestData,
        error: 'Invalid response code',
        response: response.data
      });
      return [];
    } catch (e) {
      console.error('[MemoryService] msearch error:', e.message);
      this.logger.logMemory('retrieve', {
        query,
        userId,
        error: e.message
      });
      return [];
    }
  }

  /**
   * Get all memories (fallback to search with empty query)
   */
  async getAllMemories(userId?: string, limit = 50): Promise<string[]> {
    return this.searchMemories('', userId, limit);
  }

  /**
   * Process a turn and store memory using mem0 service
   */
  async processTurn(options: {
    sessionId: string;
    userId?: string;
    userText: string;
    assistantText: string;
  }) {
    if (!this.mem0Enabled) {
      return;
    }
    if (!options.userId) {
      console.warn('[MemoryService] processTurn skipped: userId is missing');
      return;
    }

    try {
      const requestData = {
        sentencein: options.userText,
        sentenceout: options.assistantText,
        userid: options.userId
      };

      const response = await axios.post(`${this.mem0Url}/madd`, requestData);

      if (response.data && response.data.code === 200) {
        console.log('[MemoryService] Memory stored in mem0:', response.data.message);
        this.logger.logMemory('store', {
          request: requestData,
          response: response.data
        });
      } else {
        console.warn('[MemoryService] mem0 madd failed:', response.data);
        this.logger.logMemory('store', {
          request: requestData,
          error: 'Failed to store',
          response: response.data
        });
      }
    } catch (e) {
      console.error('[MemoryService] madd error:', e.message);
      this.logger.logMemory('store', {
        options,
        error: e.message
      });
    }
  }

  /**
   * Add explicit memory
   */
  async addMemory(userId: string, text: string, role: 'user' | 'assistant' | 'system' = 'system') {
    return this.processTurn({
      sessionId: 'explicit-add',
      userId,
      userText: text,
      assistantText: '好的，我已经记住了。'
    });
  }

  async fetchUserProfile(userId: string): Promise<string> {
    const enabled = process.env.MEM0_ENABLED?.trim().toLowerCase();
    if (enabled === 'false' || enabled === '0' || enabled === 'off' || enabled === 'no') {
      return '';
    }
    if (!userId) {
      return '';
    }
    const url = process.env.MEM0_URL;
    if (!url) {
      return '';
    }

    try {
      const response = await axios.post(url, {
        sentence: '梦境记忆',
        userid: userId,
        topk: 1
      }, { timeout: 5000 });
      if (response.data?.code === 200 && response.data?.details) {
        return response.data.details;
      }
      return '';
    } catch (e: any) {
      console.error('[MemoryService] fetchUserProfile error:', e.message);
      return '';
    }
  }
}
