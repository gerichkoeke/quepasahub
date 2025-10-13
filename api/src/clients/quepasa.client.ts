import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

/**
 * Detecta o mimetype baseado na URL do arquivo
 * Copiado do projeto disparo1 para compatibilidade
 */
function detectMimeType(url: string): string {
  const urlLower = url.toLowerCase();

  // Imagens
  if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) return 'image/jpeg';
  if (urlLower.endsWith('.png')) return 'image/png';
  if (urlLower.endsWith('.gif')) return 'image/gif';
  if (urlLower.endsWith('.webp')) return 'image/webp';
  if (urlLower.endsWith('.bmp')) return 'image/bmp';

  // Vídeos
  if (urlLower.endsWith('.mp4')) return 'video/mp4';
  if (urlLower.endsWith('.avi')) return 'video/x-msvideo';
  if (urlLower.endsWith('.mov')) return 'video/quicktime';
  if (urlLower.endsWith('.wmv')) return 'video/x-ms-wmv';
  if (urlLower.endsWith('.flv')) return 'video/x-flv';
  if (urlLower.endsWith('.mkv')) return 'video/x-matroska';
  if (urlLower.endsWith('.webm')) return 'video/webm';

  // Áudios
  if (urlLower.endsWith('.mp3')) return 'audio/mpeg';
  if (urlLower.endsWith('.ogg')) return 'audio/ogg';
  if (urlLower.endsWith('.wav')) return 'audio/wav';
  if (urlLower.endsWith('.m4a')) return 'audio/mp4';
  if (urlLower.endsWith('.aac')) return 'audio/aac';
  if (urlLower.endsWith('.opus')) return 'audio/opus';

  // Documentos
  if (urlLower.endsWith('.pdf')) return 'application/pdf';
  if (urlLower.endsWith('.doc')) return 'application/msword';
  if (urlLower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (urlLower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (urlLower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (urlLower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (urlLower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (urlLower.endsWith('.txt')) return 'text/plain';
  if (urlLower.endsWith('.csv')) return 'text/csv';
  if (urlLower.endsWith('.zip')) return 'application/zip';
  if (urlLower.endsWith('.rar')) return 'application/x-rar-compressed';

  // Default
  return 'application/octet-stream';
}

interface QuepasaMessage {
  text?: string;
  url?: string;
  content?: string; // base64 content
  mime?: string;
  mimetype?: string;
  filename?: string;
}

interface QuepasaSendResponse {
  success: boolean;
  status: string;
  message?: {
    id: string;
    wid: string;
    chatId: string;
  };
}

interface QuepasaWebhookConfig {
  url: string;
  forwardinternal?: boolean;
  trackid?: string;
  extra?: Record<string, any>;
}

class QuepasaClient {
  private baseUrl: string = '';
  private user: string = '';
  private password: string = '';
  private initialized: boolean = false;

  /**
   * Initialize the Quepasa client with settings from database
   */
  async initialize(): Promise<void> {
    try {
      // Get settings from database
      const settings = await prisma.appSetting.findMany({
        where: {
          key: {
            in: ['quepasa_url', 'quepasa_user', 'quepasa_password'],
          },
        },
      });

      const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      this.baseUrl = settingsMap.quepasa_url || '';
      this.user = settingsMap.quepasa_user || '';
      this.password = settingsMap.quepasa_password || '';

      if (!this.baseUrl) {
        throw new Error('Quepasa not configured - missing URL');
      }

      // Remove trailing slash from baseUrl if present
      this.baseUrl = this.baseUrl.replace(/\/$/, '');

      this.initialized = true;
      logger.info({ baseUrl: this.baseUrl, hasUser: !!this.user, hasPassword: !!this.password }, 'Quepasa client initialized');
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to initialize Quepasa client');
      throw error;
    }
  }

  /**
   * Create axios client with specific token
   */
  private createClient(quepasaToken: string): AxiosInstance {
    return axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-QUEPASA-TOKEN': quepasaToken,
      },
    });
  }

  /**
   * Ensure client is initialized before making requests
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Quepasa client not initialized');
    }
  }

  /**
   * Send a text message
   */
  async sendTextMessage(quepasaToken: string, chatId: string, text: string, inreply?: string): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);

      const payload: any = { text };
      if (inreply) {
        payload.inreply = inreply;
      }

      const response = await client.post('/send',
        payload,
        {
          headers: {
            'X-QUEPASA-CHATID': chatId,
          },
        }
      );

      logger.info({ chatId, messageLength: text.length, inreply }, 'Sent text message via Quepasa');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, chatId }, 'Failed to send text message via Quepasa');
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send a message with media (image, document, video, audio)
   */
  async sendMediaMessage(
    quepasaToken: string,
    chatId: string,
    message: QuepasaMessage
  ): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.post('/send',
        message,
        {
          headers: {
            'X-QUEPASA-CHATID': chatId,
          },
        }
      );

      logger.info({ chatId, hasUrl: !!message.url, hasContent: !!message.content }, 'Sent media message via Quepasa');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, chatId }, 'Failed to send media message via Quepasa');
      throw new Error(`Failed to send media: ${error.message}`);
    }
  }

  /**
   * Send a message with buttons
   */
  async sendButtonMessage(
    quepasaToken: string,
    chatId: string,
    bodyText: string,
    buttons: string[],
    footerText?: string
  ): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      // Format: "text $buttons:[button1, button2] footer"
      const buttonsStr = buttons.join(', ');
      const text = `${bodyText} $buttons:[${buttonsStr}]${footerText ? ' ' + footerText : ''}`;

      return await this.sendTextMessage(quepasaToken, chatId, text);
    } catch (error: any) {
      logger.error({ error: error.message, chatId }, 'Failed to send button message via Quepasa');
      throw new Error(`Failed to send buttons: ${error.message}`);
    }
  }

  /**
   * Configure webhook for receiving messages
   * Uses POST to configure webhook with X-QUEPASA-TOKEN header
   */
  async configureWebhook(quepasaToken: string, config: QuepasaWebhookConfig): Promise<any> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.post('/webhook', config);
      logger.info({ webhookUrl: config.url, trackid: config.trackid }, 'Configured Quepasa webhook');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, webhookUrl: config.url }, 'Failed to configure Quepasa webhook');
      throw new Error(`Failed to configure webhook: ${error.message}`);
    }
  }

  /**
   * Get connection information
   */
  async getConnectionInfo(quepasaToken: string): Promise<any> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.get('/info');
      logger.info('Retrieved Quepasa connection info');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get Quepasa connection info');
      throw new Error(`Failed to get connection info: ${error.message}`);
    }
  }

  /**
   * Check connection status
   */
  async getStatus(quepasaToken: string): Promise<{ success: boolean; status: string }> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.get('/command?action=status');
      logger.info({ status: response.data.status }, 'Retrieved Quepasa status');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get Quepasa status');
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Get QR code for new connection (requires X-QUEPASA-USER header)
   */
  async getQRCode(quepasaToken: string): Promise<Buffer> {
    this.ensureInitialized();

    if (!this.user) {
      throw new Error('Quepasa user email not configured');
    }

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.get('/scan', {
        headers: {
          'X-QUEPASA-USER': this.user,
        },
        responseType: 'arraybuffer',
      });

      logger.info('Retrieved Quepasa QR code');
      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to get Quepasa QR code');
      throw new Error(`Failed to get QR code: ${error.message}`);
    }
  }

  /**
   * Check if numbers are registered on WhatsApp
   */
  async checkWhatsAppNumbers(quepasaToken: string, numbers: string[]): Promise<{ total: number; registered: string[] }> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.post('/isonwhatsapp', numbers);
      logger.info({ total: response.data.total, checked: numbers.length }, 'Checked WhatsApp numbers');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to check WhatsApp numbers');
      throw new Error(`Failed to check numbers: ${error.message}`);
    }
  }

  /**
   * Delete/remove session from Quepasa
   */
  async deleteSession(quepasaToken: string): Promise<{ success: boolean; status: string }> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.delete('/info');
      logger.info({ status: response.data.status }, 'Deleted Quepasa session');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to delete Quepasa session');
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Download media attachment from Quepasa
   * Returns the file buffer
   */
  async downloadMedia(quepasaToken: string, messageId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);
      const response = await client.get(`/download/${messageId}`, {
        responseType: 'arraybuffer',
      });

      const mimeType = response.headers['content-type'] || 'application/octet-stream';
      const buffer = Buffer.from(response.data);

      logger.info({ messageId, mimeType, size: buffer.length }, 'Downloaded media from Quepasa');
      return { buffer, mimeType };
    } catch (error: any) {
      logger.error({ error: error.message, messageId }, 'Failed to download media from Quepasa');
      throw new Error(`Failed to download media: ${error.message}`);
    }
  }

  /**
   * Send audio as PTT (Push-to-Talk voice message)
   * Uses /send endpoint with base64-encoded OGG Opus audio
   */
  async sendAudioPTT(quepasaToken: string, chatId: string, audioBuffer: Buffer): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      // Convert buffer to base64
      const base64Audio = audioBuffer.toString('base64');
      const dataUri = `data:audio/ogg;base64,${base64Audio}`;

      const client = this.createClient(quepasaToken);
      const response = await client.post('/send',
        {
          content: dataUri,
          mime: 'audio/ogg; codecs=opus',
          filename: 'audio.ogg',
        },
        {
          headers: {
            'X-QUEPASA-CHATID': chatId,
          },
        }
      );

      logger.info({ chatId, audioSize: audioBuffer.length }, 'Sent audio PTT via Quepasa');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, chatId }, 'Failed to send audio PTT via Quepasa');
      throw new Error(`Failed to send audio PTT: ${error.message}`);
    }
  }

  /**
   * Send binary audio file as PTT (Push-to-Talk voice message)
   * Uses /sendbinary/{chatId} endpoint with binary data in body
   *
   * @param audioFilePath Path to .oga file (caller must cleanup after)
   *
   * N8N approach (works!):
   * - Body Content Type: "n8n Binary File" (raw binary in body)
   * - Input Data Field Name: "data"
   * - Header: X-QUEPASA-TOKEN
   *
   * Exemplo curl:
   * curl -X POST "https://quepasa.../sendbinary/556196878959" \
   *   -H "X-QUEPASA-TOKEN: token" \
   *   -H "Content-Type: application/octet-stream" \
   *   --data-binary "@arquivo.oga"
   */
  async sendBinaryAudio(quepasaToken: string, chatId: string, audioFilePath: string): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      const fs = require('fs');
      const path = require('path');

      // Read file as buffer
      const audioBuffer = fs.readFileSync(audioFilePath);
      const filename = path.basename(audioFilePath);

      // Send raw binary data in body (like N8N does)
      const response = await axios.post(
        `${this.baseUrl}/sendbinary/${chatId}`,
        audioBuffer,
        {
          headers: {
            'X-QUEPASA-TOKEN': quepasaToken,
            'Content-Type': 'application/octet-stream',
          },
          timeout: 30000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      logger.info({ chatId, audioFile: filename, size: audioBuffer.length }, 'Sent binary audio PTT via Quepasa (raw binary like N8N)');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, chatId, response: error.response?.data }, 'Failed to send binary audio via Quepasa');
      throw new Error(`Failed to send binary audio: ${error.message}`);
    }
  }

  /**
   * Send binary audio file as PTT using multipart/form-data (N8N approach COMPLETO)
   * Uses /sendbinary/{chatId} endpoint with form-data (field: 'data')
   * Includes ptt=true and duration metadata
   * Uses createReadStream for efficient memory usage
   *
   * @param audioFilePath Path to .oga file
   * @param duration Audio duration in seconds (optional)
   *
   * Key features (100% compatível com N8N):
   * - createReadStream (não carrega arquivo na memória)
   * - knownLength (ajuda servidores a ler cada part)
   * - Content-Length explícito (força tamanho correto do form inteiro)
   * - filename real do arquivo (ou fallback para audio_ptt.oga)
   * - contentType explícito (audio/ogg; codecs=opus)
   * - Accept: application/json header
   * - transformRequest preserva body original
   * - timeout 60s para uploads grandes
   *
   * Exemplo curl:
   * curl -X POST "https://quepasa.../sendbinary/556196878959" \
   *   -H "X-QUEPASA-TOKEN: token" \
   *   -H "Accept: application/json" \
   *   -F "data=@audio.oga;type=audio/ogg;codecs=opus" \
   *   -F "ptt=true" \
   *   -F "duration=17"
   */
  async sendBinaryAudioMultipart(quepasaToken: string, chatId: string, audioFilePath: string, duration?: number): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const path = require('path');
      const { promisify } = require('util');

      const filename = path.basename(audioFilePath);
      const fileStats = fs.statSync(audioFilePath);

      // Create multipart form-data (N8N approach)
      const formData = new FormData();

      // ⚠️ Use createReadStream + filename + contentType no PART (igual ao N8N)
      formData.append('data', fs.createReadStream(audioFilePath), {
        filename: filename || 'audio_ptt.oga',        // <- usa nome real ou fallback
        contentType: 'audio/ogg; codecs=opus',        // <- igual ao n8n
        knownLength: fileStats.size                   // <- ajuda servidores a ler tudo
      });

      // Add PTT metadata
      formData.append('ptt', 'true');

      // Add duration if provided
      if (duration) {
        formData.append('duration', duration.toString());
      }

      // 🔒 Calculate Content-Length explicitly (N8N does this)
      const getLength = promisify(formData.getLength).bind(formData);
      const contentLength = await getLength();

      // Send via multipart/form-data
      // ⚠️ Deixa o form-data gerar o boundary E force o Content-Length do form inteiro
      const response = await axios.post(
        `${this.baseUrl}/sendbinary/${chatId}`,
        formData,
        {
          headers: {
            'X-QUEPASA-TOKEN': quepasaToken,
            ...formData.getHeaders(),                  // <- inclui multipart/form-data; boundary=...
            'Content-Length': String(contentLength),   // <- força Content-Length correto
            'Accept': 'application/json',
          },
          timeout: 60000,                              // <- 60s para uploads grandes
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          transformRequest: v => v,                    // <- não toque no body
        }
      );

      logger.info({ chatId, audioFile: filename, duration, ptt: true }, 'Sent binary audio PTT via Quepasa (N8N approach with ReadStream)');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, chatId, response: error.response?.data }, 'Failed to send binary audio multipart via Quepasa');
      throw new Error(`Failed to send binary audio multipart: ${error.message}`);
    }
  }

  /**
   * Send audio PTT by URL - SIMPLEST approach! (RECOMMENDED)
   * Quepasa downloads and converts the audio automatically to PTT
   * Uses /send endpoint with JSON payload (just URL)
   *
   * ⭐ Quepasa automatically:
   *   - Downloads the file from URL
   *   - Detects mime type (audio/ogg)
   *   - Converts to PTT format if needed
   *   - Sends as voice message to WhatsApp
   *
   * No need to:
   *   - Upload file via multipart/form-data
   *   - Calculate Content-Length
   *   - Specify mime type (auto-detected)
   *   - Convert audio format (Quepasa does it)
   *
   * @param quepasaToken Quepasa auth token
   * @param chatId WhatsApp number (e.g., "5561996878959")
   * @param audioUrl Public URL to audio file (.oga, .ogg, .mp3, etc)
   *
   * Exemplo curl:
   * curl -X POST "https://quepasa.../send" \
   *   -H "Accept: application/json" \
   *   -H "X-QUEPASA-TOKEN: token" \
   *   -H "X-QUEPASA-CHATID: 5561996878959" \
   *   -H "Content-Type: application/json" \
   *   -d '{"url": "http://example.com/audio.oga"}'
   */
  async sendAudioByURL(quepasaToken: string, chatId: string, audioUrl: string): Promise<QuepasaSendResponse> {
    this.ensureInitialized();

    try {
      // Simple payload: just the URL!
      // Quepasa handles everything else (download, detection, conversion)
      const payload = {
        url: audioUrl,
      };

      logger.info({ audioUrl, chatId }, 'Sending audio PTT by URL to Quepasa');

      const response = await axios.post(
        `${this.baseUrl}/send`,
        payload,
        {
          headers: {
            'Accept': 'application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9, image/*;q=0.8, */*;q=0.7',
            'Accept-Encoding': 'gzip, compress, deflate, br',
            'Content-Type': 'application/json',
            'X-QUEPASA-TOKEN': quepasaToken,
            'X-QUEPASA-CHATID': chatId,
          },
          timeout: 60000,
        }
      );

      logger.info({ chatId, audioUrl, quepasaResponse: response.data }, 'Audio PTT sent successfully to Quepasa');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message, chatId, audioUrl, response: error.response?.data }, 'Failed to send audio by URL to Quepasa');
      throw new Error(`Failed to send audio by URL: ${error.message}`);
    }
  }

  /**
   * Get profile picture URL for a contact
   * Returns the profile picture URL from WhatsApp
   */
  async getProfilePictureUrl(quepasaToken: string, phoneNumber: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      const client = this.createClient(quepasaToken);

      // Remove WhatsApp suffixes if present
      const cleanPhone = phoneNumber.replace(/@.*$/, '');

      // Quepasa endpoint: /picinfo/{phoneNumber}
      const response = await client.get(`/picinfo/${cleanPhone}`);

      // Response format: { success: true, info: { id: "...", type: "image", url: "https://..." } }
      const pictureUrl = response.data?.info?.url || response.data?.url || response.data?.eurl;

      if (pictureUrl) {
        logger.info({ phoneNumber: cleanPhone, hasPicture: true, pictureUrl }, 'Retrieved profile picture URL from Quepasa');
        return pictureUrl;
      }

      logger.info({ phoneNumber: cleanPhone, hasPicture: false, responseData: response.data }, 'No profile picture found for contact');
      return null;
    } catch (error: any) {
      // Don't throw error - profile picture is optional
      logger.warn({ error: error.message, phoneNumber }, 'Failed to get profile picture from Quepasa (non-critical)');
      return null;
    }
  }

  /**
   * Test connection to Quepasa (without specific token - just checks if service is available)
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.initialize();

      return {
        success: true,
        message: 'Quepasa service is available and configured',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Falha ao conectar com Quepasa',
      };
    }
  }

  /**
   * List all bots/connections from Quepasa server
   * Requires admin credentials (X-QUEPASA-USER and X-QUEPASA-PASSWORD headers)
   */
  async listAllBots(): Promise<any[]> {
    this.ensureInitialized();

    if (!this.user || !this.password) {
      throw new Error('Quepasa user email and password not configured');
    }

    try {
      const client = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-QUEPASA-USER': this.user,
          'X-QUEPASA-PASSWORD': this.password,
        },
      });

      // Use /health endpoint to list all bots
      const response = await client.get('/health');

      // Response structure: { success: true, items: [...], stats: {...} }
      const items = response.data?.items || [];
      logger.info({ count: items.length }, 'Retrieved Quepasa bots list');
      return items;
    } catch (error: any) {
      logger.error({ error: error.message, status: error.response?.status }, 'Failed to list Quepasa bots');
      throw new Error(`Failed to list bots: ${error.message}`);
    }
  }
}

// Export singleton instance
export const quepasaClient = new QuepasaClient();
