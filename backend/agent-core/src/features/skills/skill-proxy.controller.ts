import { Body, Controller, Delete, Headers, HttpException, Param, Post, Put } from '@nestjs/common';
import axios from 'axios';

@Controller('features/skills')
export class SkillProxyController {
  private readonly gatewayUrl = process.env.JAVA_GATEWAY_URL || 'http://localhost:18080';
  private readonly apiToken = process.env.JAVA_GATEWAY_TOKEN || 'your-secure-token-here';

  @Post()
  async createSkill(@Body() payload: unknown, @Headers('x-user-id') userId?: string) {
    return this.forwardRequest(() =>
      axios.post(`${this.gatewayUrl}/api/skills`, payload, {
        headers: this.gatewayHeaders(userId),
      }),
    );
  }

  @Put(':id')
  async updateSkill(@Param('id') id: string, @Body() payload: unknown, @Headers('x-user-id') userId?: string) {
    return this.forwardRequest(() =>
      axios.put(`${this.gatewayUrl}/api/skills/${id}`, payload, {
        headers: this.gatewayHeaders(userId),
      }),
    );
  }

  @Delete(':id')
  async deleteSkill(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    await this.forwardRequest(() =>
      axios.delete(`${this.gatewayUrl}/api/skills/${id}`, {
        headers: this.gatewayHeaders(userId),
      }),
    );
    return { ok: true };
  }

  private gatewayHeaders(userId?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Agent-Token': this.apiToken,
    };
    if (userId && String(userId).trim()) {
      headers['X-User-Id'] = String(userId).trim();
    }
    return headers;
  }

  private async forwardRequest<T>(request: () => Promise<{ data: T }>): Promise<T> {
    try {
      const response = await request();
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new HttpException(
          error.response?.data ?? { error: 'Skill gateway request failed' },
          error.response?.status ?? 500,
        );
      }
      throw error;
    }
  }
}
