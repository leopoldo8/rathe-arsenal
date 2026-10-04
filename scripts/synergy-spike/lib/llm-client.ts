import Anthropic from '@anthropic-ai/sdk';
import { RANKING_SCHEMA, type ILlmClient, type ILlmRequest } from './llm';

/** The only file that touches the Anthropic SDK. The key is read from ANTHROPIC_API_KEY by the SDK itself. */
export function createSdkClient(): ILlmClient {
  const client = new Anthropic();

  return {
    async countTokens(request: ILlmRequest): Promise<number> {
      const count = await client.messages.countTokens({
        model: request.model,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
      });
      return count.input_tokens;
    },

    async generate(request: ILlmRequest) {
      const message = await client.messages
        .stream({
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high', format: { type: 'json_schema', schema: RANKING_SCHEMA } },
          messages: [{ role: 'user', content: request.prompt }],
        })
        .finalMessage();
      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      return {
        text,
        stopReason: message.stop_reason,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
      };
    },
  };
}
