import { Controller, Post, Body } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { composeOpenAiCompatibleFetch } from '../utils/llm-request-role-normalize';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

@Controller('user')
export class UserController {
  
  @Post('avatar')
  async generateAvatar(@Body() body: { nickname: string }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { avatar: '👤' };
    }
    
    try {
      const chat = new ChatOpenAI({
        apiKey,
        modelName: 'gpt-4o-mini',
        temperature: 0.7,
        configuration: { fetch: composeOpenAiCompatibleFetch() },
      });
      const response = await chat.invoke([
        new SystemMessage("You are an emoji generator. User gives a nickname, you return a SINGLE emoji that best represents it. No text, just the emoji."),
        new HumanMessage(body.nickname)
      ]);
      const text = response.content.toString().trim();
        // Simple heuristic to grab the first emoji-like character(s)
        // Some emojis are surrogate pairs (2 chars), some are sequences.
        // Intl.Segmenter is better but for now let's just take the whole string if it's short, or first 2 chars.
        // Actually, if LLM obeys, it returns just one emoji.
        const emoji = text.match(/\p{Emoji_Presentation}/u)?.[0] || text.substring(0, 2);
        return { avatar: emoji };
    } catch (e) {
        console.error('Avatar generation failed', e);
        return { avatar: '👤' };
    }
  }
}
