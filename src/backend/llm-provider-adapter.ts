import { LLMProvider, LLMRequest, LLMResponse, DecisionType } from './types';

interface ProviderConfig {
  apiKey: string;
  model?: string;
}

interface ProviderConfigs {
  openai?: ProviderConfig;
  claude?: ProviderConfig;
  gemini?: ProviderConfig;
  grok?: ProviderConfig;
  deepseek?: ProviderConfig;
}

export class LLMProviderAdapter {
  private configs: ProviderConfigs;
  private activeProvider: LLMProvider;

  constructor(configs: ProviderConfigs, activeProvider: LLMProvider = 'openai') {
    this.configs = configs;
    this.activeProvider = activeProvider;
  }

  setActiveProvider(provider: LLMProvider): void {
    if (!this.configs[provider]) {
      throw new Error(`Provider ${provider} not configured`);
    }
    this.activeProvider = provider;
  }

  async generateDecision(
    promptText: string,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      switch (this.activeProvider) {
        case 'openai':
          return await this.callOpenAI(promptText, request, startTime);
        case 'claude':
          return await this.callClaude(promptText, request, startTime);
        case 'gemini':
          return await this.callGemini(promptText, request, startTime);
        case 'grok':
          return await this.callGrok(promptText, request, startTime);
        case 'deepseek':
          return await this.callDeepSeek(promptText, request, startTime);
        default:
          throw new Error(`Unsupported provider: ${this.activeProvider}`);
      }
    } catch (error) {
      console.error('LLM Provider Error:', error);
      return this.getFallbackResponse(startTime);
    }
  }

  private async callOpenAI(
    promptText: string,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const config = this.configs.openai!;
    const model = config.model || 'gpt-4-turbo-preview';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptText },
          {
            role: 'user',
            content: JSON.stringify({
              current_state: request.state,
              stock_symbol: request.stockSymbol,
              features: request.features,
            }),
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return this.normalizeResponse(result, 'openai', model, Date.now() - startTime);
  }

  private async callClaude(
    promptText: string,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const config = this.configs.claude!;
    const model = config.model || 'claude-3-5-sonnet-20241022';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: promptText,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              current_state: request.state,
              stock_symbol: request.stockSymbol,
              features: request.features,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.content[0].text);

    return this.normalizeResponse(result, 'claude', model, Date.now() - startTime);
  }

  private async callGemini(
    promptText: string,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const config = this.configs.gemini!;
    const model = config.model || 'gemini-1.5-pro';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${promptText}\n\nInput:\n${JSON.stringify({
                    current_state: request.state,
                    stock_symbol: request.stockSymbol,
                    features: request.features,
                  })}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);

    return this.normalizeResponse(result, 'gemini', model, Date.now() - startTime);
  }

  private async callGrok(
    promptText: string,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const config = this.configs.grok!;
    const model = config.model || 'grok-beta';

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptText },
          {
            role: 'user',
            content: JSON.stringify({
              current_state: request.state,
              stock_symbol: request.stockSymbol,
              features: request.features,
            }),
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return this.normalizeResponse(result, 'grok', model, Date.now() - startTime);
  }

  private async callDeepSeek(
    promptText: string,
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    const config = this.configs.deepseek!;
    const model = config.model || 'deepseek-chat';

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptText },
          {
            role: 'user',
            content: JSON.stringify({
              current_state: request.state,
              stock_symbol: request.stockSymbol,
              features: request.features,
            }),
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return this.normalizeResponse(result, 'deepseek', model, Date.now() - startTime);
  }

  private normalizeResponse(
    rawResponse: any,
    provider: LLMProvider,
    model: string,
    latency: number
  ): LLMResponse {
    const decision = rawResponse.decision as DecisionType;
    const confidence = parseFloat(rawResponse.confidence) || 0;
    const reason = rawResponse.reason || 'No reason provided';

    if (!['BUY_CALL', 'BUY_PUT', 'WAIT'].includes(decision)) {
      throw new Error(`Invalid decision type: ${decision}`);
    }

    if (confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence value: ${confidence}`);
    }

    return {
      decision,
      confidence,
      reason,
      provider,
      model,
      latency_ms: latency,
    };
  }

  private getFallbackResponse(startTime: number): LLMResponse {
    return {
      decision: 'WAIT',
      confidence: 0.0,
      reason: 'LLM provider failed, defaulting to WAIT for safety',
      provider: this.activeProvider,
      model: 'fallback',
      latency_ms: Date.now() - startTime,
    };
  }
}
