import axios, { AxiosInstance } from 'axios';
import {
  Settings,
  Session,
  Mapping,
  LogsResponse,
  Metrics,
  LoginRequest,
  TestMessageRequest,
  CreateMappingRequest,
  QuepasaMapping,
  CreateQuepasaMappingRequest,
  QuepasaSyncResult,
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    // Always use relative URL so it works with any domain
    // This ensures the frontend respects the client's URL from stack.yml
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );

    // Load token from localStorage
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      this.token = savedToken;
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  getToken(): string | null {
    return this.token;
  }

  // Auth
  async login(data: LoginRequest): Promise<{ success: boolean; message: string }> {
    // Set the token
    this.setToken(data.token);

    // Verify token by calling a protected endpoint (settings)
    try {
      await this.client.get('/settings');
      return { success: true, message: 'Login successful' };
    } catch (error: any) {
      this.clearToken();
      if (error.response?.status === 401) {
        return { success: false, message: 'Invalid token' };
      }
      return { success: false, message: 'Connection error' };
    }
  }

  async verifyToken(): Promise<{ valid: boolean }> {
    try {
      await this.client.get('/settings');
      return { valid: true };
    } catch (error) {
      return { valid: false };
    }
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const response = await this.client.get('/settings');
    return response.data;
  }

  async updateSettings(settings: Settings): Promise<Settings> {
    const response = await this.client.post('/settings', settings);
    return response.data;
  }

  async testWahaConnection(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.get('/settings/test-waha');
    return response.data;
  }

  // Sessions
  async getSessions(): Promise<Session[]> {
    const response = await this.client.get('/waha/sessions');
    // Handle case when Waha is not configured
    if (response.data.configured === false) {
      return [];
    }
    // Return sessions array (could be response.data.sessions or response.data directly)
    return response.data.sessions || response.data;
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.client.get(`/waha/sessions/${sessionId}`);
    return response.data;
  }

  async createSession(name: string): Promise<Session> {
    const response = await this.client.post('/waha/sessions', { name });
    return response.data;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.delete(`/waha/sessions/${sessionId}`);
  }

  async getQRCode(sessionId: string): Promise<string> {
    const response = await this.client.get(`/waha/sessions/${sessionId}/qr`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  }

  // Mappings
  async getMappings(): Promise<Mapping[]> {
    const response = await this.client.get('/mappings');
    return response.data;
  }

  async getMappingsBySession(sessionName: string): Promise<Mapping[]> {
    const response = await this.client.get(`/mappings/session/${sessionName}`);
    return response.data;
  }

  async createMapping(data: CreateMappingRequest): Promise<Mapping> {
    const response = await this.client.post('/mappings', data);
    return response.data;
  }

  async createConnectionMapping(sessionName: string): Promise<Mapping> {
    const response = await this.client.post('/mappings/connection-only', { session_name: sessionName });
    return response.data;
  }

  async updateMapping(id: number, data: Partial<Mapping>): Promise<Mapping> {
    const response = await this.client.put(`/mappings/${id}`, data);
    return response.data;
  }

  async deleteMapping(id: number): Promise<void> {
    await this.client.delete(`/mappings/${id}`);
  }

  async toggleMapping(id: number): Promise<Mapping> {
    const response = await this.client.patch(`/mappings/${id}/toggle`);
    return response.data;
  }

  // Logs
  async getLogs(params?: {
    session_name?: string;
    direction?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<LogsResponse> {
    const response = await this.client.get('/logs', { params });
    return response.data;
  }

  // Metrics
  async getMetrics(): Promise<Metrics> {
    const response = await this.client.get('/metrics');
    return response.data;
  }

  // Test message
  async sendTestMessage(data: TestMessageRequest): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/test/message', data);
    return response.data;
  }

  // Public endpoints (no auth required)
  async getPublicSession(token: string): Promise<{ sessionId: string; status: string; publicUrl: string }> {
    const response = await this.client.get(`/public/session/${token}`);
    return response.data;
  }

  async getPublicQRCode(token: string): Promise<string> {
    const response = await this.client.get(`/public/session/${token}/qr`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  }

  async startPublicSession(token: string): Promise<{ success: boolean; status: string; message: string }> {
    const response = await this.client.post(`/public/session/${token}/start`);
    return response.data;
  }

  async stopPublicSession(token: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/public/session/${token}/stop`);
    return response.data;
  }

  async restartPublicSession(token: string): Promise<{ success: boolean; status: string; message: string }> {
    const response = await this.client.post(`/public/session/${token}/restart`);
    return response.data;
  }

  // Quepasa Mappings
  async getQuepasaMappings(): Promise<QuepasaMapping[]> {
    const response = await this.client.get('/quepasa-mappings');
    return response.data;
  }

  async getQuepasaMapping(id: string): Promise<QuepasaMapping> {
    const response = await this.client.get(`/quepasa-mappings/${id}`);
    return response.data;
  }

  async createQuepasaMapping(data: CreateQuepasaMappingRequest): Promise<QuepasaMapping> {
    const response = await this.client.post('/quepasa-mappings', data);
    return response.data;
  }

  async updateQuepasaMapping(id: string, data: Partial<CreateQuepasaMappingRequest>): Promise<QuepasaMapping> {
    const response = await this.client.put(`/quepasa-mappings/${id}`, data);
    return response.data;
  }

  async deleteQuepasaMapping(id: string): Promise<void> {
    await this.client.delete(`/quepasa-mappings/${id}`);
  }

  // Quepasa Connection
  async getQuepasaQRCode(mappingId: string): Promise<string> {
    const response = await this.client.post('/quepasa/qr',
      { mappingId },
      {
        responseType: 'blob',
      }
    );
    return URL.createObjectURL(response.data);
  }

  async getQuepasaStatus(mappingId: string): Promise<{ success: boolean; status: string }> {
    const response = await this.client.get(`/quepasa/status/${mappingId}`);
    return response.data;
  }

  async getQuepasaInfo(mappingId: string): Promise<any> {
    const response = await this.client.get(`/quepasa/info/${mappingId}`);
    return response.data;
  }

  async testQuepasaConnection(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.get('/quepasa/test');
    return response.data;
  }

  async syncQuepasaConnections(): Promise<QuepasaSyncResult> {
    const response = await this.client.post('/quepasa/sync');
    return response.data;
  }

  async setupQuepasaChatwootIntegration(mappingId: string): Promise<QuepasaMapping> {
    const response = await this.client.post(`/quepasa-mappings/${mappingId}/setup-integration`);
    return response.data;
  }

  async createQuepasaMappingWithChatwoot(data: {
    name: string;
    chatwootBaseUrl: string;
    chatwootApiToken: string;
    chatwootAccountId: string;
    chatwootInboxName?: string;
    sendQRToChatwoot: boolean;
  }): Promise<QuepasaMapping> {
    const response = await this.client.post('/quepasa-mappings/with-chatwoot', data);
    return response.data;
  }

  async disconnectQuepasa(mappingId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/quepasa/disconnect/${mappingId}`);
    return response.data;
  }
}

export const api = new ApiClient();
