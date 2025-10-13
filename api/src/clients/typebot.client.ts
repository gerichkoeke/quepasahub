import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

interface RichTextChild {
  text?: string;
  type?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  children?: Array<RichTextChild>;
}

export interface TypebotMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio';
  content: {
    richText?: Array<{ type: string; children: Array<RichTextChild> }>;
    url?: string;
  };
}

export interface ClientSideAction {
  type: 'wait' | string;
  wait?: {
    secondsToWaitFor: number;
  };
  lastBubbleBlockId?: string;
}

export interface TypebotResponse {
  messages: TypebotMessage[];
  sessionId?: string;
  input?: {
    type: string;
    id: string;
    items?: Array<{ id: string; content: string }>;
  };
  clientSideActions?: ClientSideAction[];
}

export interface ProcessedMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio';
  content: string; // text content or media URL
  caption?: string; // for media messages
}

export class TypebotClient {
  private client: AxiosInstance;
  private host: string;
  private apiKey: string;
  private basePath: string;

  constructor(host?: string, apiKey?: string, basePath?: string) {
    this.host = host || '';
    this.apiKey = apiKey || '';
    this.basePath = basePath || '/api/v1';

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add retry logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        if (!config) {
          return Promise.reject(error);
        }

        if (!config.retry) {
          config.retry = 0;
        }

        if (config.retry < 3 && error.code === 'ECONNABORTED') {
          config.retry += 1;
          logger.warn({ retry: config.retry }, 'Retrying Typebot request');
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async initialize() {
    const settings = await this.getSettings();
    this.host = settings.typebot_host || this.host;
    this.apiKey = settings.typebot_api_key || this.apiKey;
    this.basePath = settings.typebot_api_base_path || this.basePath;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.host) {
        return { success: false, message: 'Typebot host not configured' };
      }

      // Try to access the base URL to test connectivity
      const url = `${this.host}${this.basePath}`;
      await this.client.get(url, {
        headers: this.getHeaders(),
        timeout: 5000,
      });

      return { success: true, message: 'Successfully connected to Typebot' };
    } catch (error: any) {
      logger.error({ error }, 'Typebot connection test failed');
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed',
      };
    }
  }

  private async getSettings() {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: ['typebot_host', 'typebot_api_key', 'typebot_api_base_path'],
        },
      },
    });

    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }

  private getHeaders(apiKey?: string) {
    const key = apiKey || this.apiKey;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    return headers;
  }

  private buildUrl(endpoint: string, params: Record<string, string> = {}) {
    let url = `${this.host}${this.basePath}${endpoint}`;

    // Replace path parameters
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });

    return url;
  }

  async startChat(
    flowId: string,
    phone: string,
    message: string,
    host?: string,
    apiKey?: string
  ): Promise<{ messages: ProcessedMessage[]; sessionId: string; clientSideActions?: ClientSideAction[] }> {
    try {
      const typebotHost = host || this.host;
      const url = `${typebotHost}/api/v1/typebots/${flowId}/startChat`;

      const payload = {
        message: {
          type: 'text',
          text: message,
        },
        prefilledVariables: {
          Phone: phone,
        },
        isOnlyRegistering: false,
        textBubbleContentFormat: 'richText',
      };

      logger.info({ url, flowId, phone }, 'Starting Typebot chat');

      const response = await this.client.post<TypebotResponse>(url, payload, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });

      // Log full response to see buttons
      logger.info({ typebotResponse: response.data }, 'Typebot full response');

      // Extract messages from response
      let messages = this.extractMessages(response.data.messages || []);

      // Filter out "Invalid message" from Typebot
      messages = messages.filter(msg =>
        msg.type !== 'text' || !msg.content.includes('Invalid message')
      );

      // Add buttons as text if present
      if (response.data.input?.items && response.data.input.items.length > 0) {
        const buttonsText = '\n\n' + response.data.input.items.map((item) => item.content).join('\n');

        // Append buttons to last text message or create new one
        if (messages.length > 0 && messages[messages.length - 1].type === 'text') {
          messages[messages.length - 1].content += buttonsText;
        } else {
          messages.push({ id: response.data.input.id, type: 'text', content: buttonsText.trim() });
        }
      }

      logger.info(
        { flowId, phone, sessionId: response.data.sessionId, messageCount: messages.length },
        'Started Typebot chat'
      );

      return {
        messages,
        sessionId: response.data.sessionId || '',
        clientSideActions: response.data.clientSideActions,
      };
    } catch (error: any) {
      logger.error({ error, flowId, phone }, 'Failed to start Typebot chat');
      throw new Error(`Failed to start chat: ${error.message}`);
    }
  }

  async continueChat(
    typebotSessionId: string,
    message: string,
    host?: string,
    apiKey?: string
  ): Promise<{ messages: ProcessedMessage[]; clientSideActions?: ClientSideAction[] }> {
    try {
      const typebotHost = host || this.host;
      const url = `${typebotHost}/api/v1/sessions/${typebotSessionId}/continueChat`;

      const payload = {
        message: {
          type: 'text',
          text: message,
        },
      };

      logger.info({ url, typebotSessionId }, 'Continuing Typebot chat');

      const response = await this.client.post<TypebotResponse>(url, payload, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });

      // Log full response to see buttons
      logger.info({ typebotResponse: response.data }, 'Typebot full response (continue)');

      let messages = this.extractMessages(response.data.messages || []);

      // Filter out "Invalid message" from Typebot
      messages = messages.filter(msg =>
        msg.type !== 'text' || !msg.content.includes('Invalid message')
      );

      // Add buttons as text if present
      if (response.data.input?.items && response.data.input.items.length > 0) {
        const buttonsText = '\n\n' + response.data.input.items.map((item) => item.content).join('\n');

        // Append buttons to last text message or create new one
        if (messages.length > 0 && messages[messages.length - 1].type === 'text') {
          messages[messages.length - 1].content += buttonsText;
        } else {
          messages.push({ id: response.data.input.id, type: 'text', content: buttonsText.trim() });
        }
      }

      logger.info({ typebotSessionId, messageCount: messages.length }, 'Continued Typebot chat');

      return {
        messages,
        clientSideActions: response.data.clientSideActions,
      };
    } catch (error: any) {
      logger.error({ error, typebotSessionId }, 'Failed to continue Typebot chat');
      throw new Error(`Failed to continue chat: ${error.message}`);
    }
  }

  async sendUserMessage(
    flowId: string,
    userId: string,
    message: string,
    sessionId?: string,
    apiKey?: string
  ): Promise<{ messages: ProcessedMessage[]; sessionId: string }> {
    try {
      const url = this.buildUrl('/typebots/{flowId}/startChat', { flowId });

      const payload: any = {
        message,
        isStreamEnabled: false,
      };

      if (sessionId) {
        payload.sessionId = sessionId;
      }

      // Include userId in prefilledVariables to maintain conversation context
      payload.prefilledVariables = {
        userId,
      };

      const response = await this.client.post<TypebotResponse>(url, payload, {
        headers: this.getHeaders(apiKey),
      });

      // Extract messages from response
      const messages = this.extractMessages(response.data.messages || []);

      logger.info(
        { flowId, userId, messageCount: messages.length },
        'Received response from Typebot'
      );

      return {
        messages,
        sessionId: response.data.sessionId || sessionId || '',
      };
    } catch (error: any) {
      logger.error({ error, flowId, userId }, 'Failed to send message to Typebot');
      throw new Error(`Failed to send message to Typebot: ${error.message}`);
    }
  }

  private extractTextFromChildren(children: RichTextChild[]): string {
    return children
      .map((child) => {
        let text = '';

        // If it's a simple text node, get the text
        if (child.text !== undefined) {
          text = child.text;
        }
        // If it's a nested structure (like inline-variable), recursively extract text
        else if (child.children && child.children.length > 0) {
          text = this.extractTextFromChildren(child.children);
        }

        // Apply formatting for WhatsApp (in order: bold, italic, underline)
        // Multiple formats can be combined, e.g., *~text~* for bold+underline
        if (text && child.bold) {
          text = `*${text}*`;
        }
        if (text && child.italic) {
          text = `_${text}_`;
        }
        if (text && child.underline) {
          text = `~${text}~`;
        }

        return text;
      })
      .join('');
  }

  private extractMessages(messages: TypebotMessage[]): ProcessedMessage[] {
    return messages
      .map((msg) => {
        if (msg.type === 'text' && msg.content.richText) {
          const text = msg.content.richText
            .map((block) => this.extractTextFromChildren(block.children))
            .join('\n');
          if (text.length > 0) {
            return { id: msg.id, type: 'text' as const, content: text };
          }
        } else if (msg.type === 'image' && msg.content.url) {
          return { id: msg.id, type: 'image' as const, content: msg.content.url };
        } else if (msg.type === 'video' && msg.content.url) {
          return { id: msg.id, type: 'video' as const, content: msg.content.url };
        } else if (msg.type === 'audio' && msg.content.url) {
          return { id: msg.id, type: 'audio' as const, content: msg.content.url };
        }
        return null;
      })
      .filter((msg): msg is ProcessedMessage => msg !== null);
  }
}

export const typebotClient = new TypebotClient();
