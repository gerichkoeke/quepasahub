import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

export interface WahaSession {
  name: string;
  status: 'WORKING' | 'SCAN_QR_CODE' | 'FAILED' | 'STOPPED';
  config?: {
    webhooks?: Array<{ url: string; events: string[] }>;
  };
  me?: {
    id: string;
    pushName?: string;
  };
}

export interface WahaMessage {
  chatId: string;
  text: string;
  session?: string;
}

export class WahaClient {
  private client: AxiosInstance;
  private host: string;
  private apiKey: string;
  private basePath: string;

  constructor(host?: string, apiKey?: string, basePath?: string) {
    this.host = host || '';
    this.apiKey = apiKey || '';
    this.basePath = basePath || '/api';

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
          logger.warn({ retry: config.retry }, 'Retrying Waha request');
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  async initialize() {
    const settings = await this.getSettings();
    this.host = settings.waha_host || this.host;
    this.apiKey = settings.waha_api_key || this.apiKey;
    this.basePath = settings.waha_api_base_path || this.basePath;
  }

  private async getSettings() {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: ['waha_host', 'waha_api_key', 'waha_api_base_path'],
        },
      },
    });

    return settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);
  }

  private getHeaders() {
    return {
      'X-Api-Key': this.apiKey,
    };
  }

  private buildUrl(endpoint: string, params: Record<string, string> = {}) {
    let url = `${this.host}${this.basePath}${endpoint}`;

    // Replace path parameters
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value);
    });

    return url;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const url = this.buildUrl('/sessions');
      const response = await this.client.get(url, { headers: this.getHeaders() });

      return {
        ok: response.status === 200,
        message: 'Connection successful',
      };
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Waha connection test failed');
      return {
        ok: false,
        message: error.message || 'Connection failed',
      };
    }
  }

  async listSessions(): Promise<WahaSession[]> {
    try {
      const url = this.buildUrl('/sessions');
      const response = await this.client.get(url, { headers: this.getHeaders() });

      logger.info({ count: response.data.length }, 'Listed Waha sessions');
      return response.data;
    } catch (error: any) {
      logger.error({ error }, 'Failed to list Waha sessions');
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  async getSession(sessionId: string): Promise<WahaSession> {
    try {
      const url = this.buildUrl('/sessions/{sessionId}', { sessionId });
      const response = await this.client.get(url, { headers: this.getHeaders() });

      return response.data;
    } catch (error: any) {
      logger.error({ error, sessionId }, 'Failed to get Waha session');
      throw new Error(`Failed to get session: ${error.message}`);
    }
  }

  async sendMessage(sessionId: string, to: string, text: string): Promise<void> {
    try {
      const url = this.buildUrl('/sendText');

      await this.client.post(
        url,
        {
          session: sessionId,
          chatId: to,
          text,
        },
        { headers: this.getHeaders() }
      );

      logger.info({ sessionId, chatId: to }, 'Message sent via Waha');
    } catch (error: any) {
      logger.error({ error, sessionId, chatId: to }, 'Failed to send message via Waha');
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async sendImage(sessionId: string, to: string, imageUrl: string, caption?: string): Promise<void> {
    try {
      const url = this.buildUrl('/sendImage');

      await this.client.post(
        url,
        {
          session: sessionId,
          chatId: to,
          file: {
            mimetype: 'image/jpeg',
            url: imageUrl,
          },
          caption,
        },
        { headers: this.getHeaders() }
      );

      logger.info({ sessionId, chatId: to, imageUrl }, 'Image sent via Waha');
    } catch (error: any) {
      logger.error({ error, sessionId, chatId: to, imageUrl }, 'Failed to send image via Waha');
      throw new Error(`Failed to send image: ${error.message}`);
    }
  }

  async sendVideo(sessionId: string, to: string, videoUrl: string, caption?: string): Promise<void> {
    try {
      const url = this.buildUrl('/sendVideo');

      await this.client.post(
        url,
        {
          session: sessionId,
          chatId: to,
          file: {
            mimetype: 'video/mp4',
            url: videoUrl,
          },
          caption,
        },
        { headers: this.getHeaders() }
      );

      logger.info({ sessionId, chatId: to, videoUrl }, 'Video sent via Waha');
    } catch (error: any) {
      logger.error({ error, sessionId, chatId: to, videoUrl }, 'Failed to send video via Waha');
      throw new Error(`Failed to send video: ${error.message}`);
    }
  }

  async sendAudio(sessionId: string, to: string, audioUrl: string): Promise<void> {
    try {
      const url = this.buildUrl('/sendVoice');

      await this.client.post(
        url,
        {
          session: sessionId,
          chatId: to,
          file: {
            mimetype: 'audio/ogg; codecs=opus',
            url: audioUrl,
          },
        },
        { headers: this.getHeaders() }
      );

      logger.info({ sessionId, chatId: to, audioUrl }, 'Audio sent via Waha');
    } catch (error: any) {
      logger.error({ error, sessionId, chatId: to, audioUrl }, 'Failed to send audio via Waha');
      throw new Error(`Failed to send audio: ${error.message}`);
    }
  }

  async setWebhook(sessionId: string, webhookUrl: string, events: string[] = ['message']): Promise<void> {
    try {
      const url = this.buildUrl('/sessions/{sessionId}/webhook', { sessionId });

      await this.client.post(
        url,
        {
          url: webhookUrl,
          events,
        },
        { headers: this.getHeaders() }
      );

      logger.info({ sessionId, webhookUrl }, 'Webhook configured for Waha session');
    } catch (error: any) {
      logger.warn({ error, sessionId }, 'Failed to set webhook (may not be supported)');
      // Don't throw - webhook setup might not be supported in all Waha versions
    }
  }

  async createSession(name: string): Promise<WahaSession> {
    try {
      const url = this.buildUrl('/sessions');

      const response = await this.client.post(
        url,
        {
          name,
          start: true,
          config: {
            metadata: {},
            proxy: null,
            debug: false,
            noweb: {
              store: {
                enabled: true,
                fullSync: false,
              },
            },
          },
        },
        { headers: this.getHeaders() }
      );

      logger.info({ name }, 'Created Waha session');
      return response.data;
    } catch (error: any) {
      logger.error({ error, name }, 'Failed to create Waha session');
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async deleteSession(name: string): Promise<void> {
    try {
      const url = this.buildUrl('/sessions/{sessionId}', { sessionId: name });

      await this.client.delete(url, { headers: this.getHeaders() });

      logger.info({ name }, 'Deleted Waha session');
    } catch (error: any) {
      logger.error({ error, name }, 'Failed to delete Waha session');
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  async logout(sessionId: string): Promise<void> {
    try {
      const url = this.buildUrl('/sessions/{sessionId}/logout', { sessionId });

      await this.client.post(url, {}, { headers: this.getHeaders() });

      logger.info({ sessionId }, 'Logged out Waha session');
    } catch (error: any) {
      logger.error({ error, sessionId }, 'Failed to logout Waha session');
      throw new Error(`Failed to logout session: ${error.message}`);
    }
  }

  async restart(sessionId: string): Promise<WahaSession> {
    try {
      const url = this.buildUrl('/sessions/{sessionId}/restart', { sessionId });

      const response = await this.client.post(url, {}, { headers: this.getHeaders() });

      logger.info({ sessionId }, 'Restarted Waha session');
      return response.data;
    } catch (error: any) {
      logger.error({ error, sessionId }, 'Failed to restart Waha session');
      throw new Error(`Failed to restart session: ${error.message}`);
    }
  }

  async updateWebhook(sessionId: string, webhookUrl: string, events: string[] = ['message.any']): Promise<void> {
    try {
      const url = this.buildUrl('/sessions/{sessionId}', { sessionId });

      await this.client.put(
        url,
        {
          config: {
            webhooks: [
              {
                url: webhookUrl,
                events,
              },
            ],
          },
        },
        { headers: this.getHeaders() }
      );

      logger.info({ sessionId, webhookUrl }, 'Updated webhook for Waha session');
    } catch (error: any) {
      logger.error({
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        sessionId,
        webhookUrl
      }, 'Failed to update webhook in Waha');
      throw new Error(`Failed to update webhook: ${error.message}`);
    }
  }

  async getQRCode(name: string): Promise<Buffer> {
    try {
      const url = this.buildUrl('/{sessionId}/auth/qr', { sessionId: name });

      const response = await this.client.get(url, {
        headers: {
          ...this.getHeaders(),
          Accept: 'image/png',
        },
        responseType: 'arraybuffer',
        params: {
          format: 'image',
        },
      });

      logger.info({ name }, 'Retrieved QR code for Waha session');
      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error({ error, name }, 'Failed to get QR code');
      throw new Error(`Failed to get QR code: ${error.message}`);
    }
  }
}

export const wahaClient = new WahaClient();
