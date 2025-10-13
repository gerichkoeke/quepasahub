export interface Session {
  name: string;
  status: 'WORKING' | 'STOPPED' | 'FAILED' | 'STARTING' | 'SCAN_QR_CODE';
  default?: boolean;
}

export interface Mapping {
  id: number;
  session_name: string;
  typebot_id: string;
  typebot_url: string;
  restart_keyword?: string;
  session_timeout?: number;
  pause_on_takeover?: boolean;
  owner_resume_keyword?: string;
  enable_groups?: boolean;
  public_token?: string;
  public_url?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventLog {
  id: string;
  sessionId: string;
  peer: string;
  direction: 'in' | 'out';
  provider: 'waha' | 'typebot';
  payload: Record<string, any>;
  createdAt: string;
}

export interface LogsResponse {
  logs: EventLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface Metrics {
  total_sessions: number;
  active_integrations: number;
  messages_processed: number;
  recent_events_count: number;
  recent_activity: RecentActivity[];
  stats: {
    totalEvents: number;
    incomingCount: number;
    outgoingCount: number;
  };
  topSessions: TopSession[];
}

export interface RecentActivity {
  id: string;
  session_name: string;
  event_type: string;
  timestamp: string;
}

export interface TopSession {
  sessionId: string;
  eventCount: number;
}

export interface Settings {
  waha_host: string;
  waha_api_key: string;
  quepasa_url?: string;
  quepasa_user?: string;
  quepasa_password?: string;
}

export interface User {
  token: string;
}

export interface LoginRequest {
  token: string;
}

export interface TestMessageRequest {
  session_name: string;
  phone: string;
  message: string;
}

export interface CreateMappingRequest {
  session_name: string;
  typebot_id: string;
  typebot_url: string;
  restart_keyword?: string;
  session_timeout?: number;
  pause_on_takeover?: boolean;
  owner_resume_keyword?: string;
  enable_groups?: boolean;
  active?: boolean;
}

export interface QuepasaMapping {
  id: string;
  quepasaToken: string; // Unique token for X-QUEPASA-TOKEN header
  phoneNumber?: string; // Optional in response (might not be set yet)
  name: string;
  chatwootBaseUrl: string;
  chatwootAccountId: string;
  chatwootInboxId: string;
  chatwootInboxName?: string; // Custom name for Chatwoot inbox
  enableGroups: boolean; // Enable receiving messages from WhatsApp groups
  reopenClosedTickets: boolean; // Reopen closed tickets for returning customers
  showAgentName: boolean; // Show agent name in messages sent to WhatsApp
  maxMessageAgeMinutes: number; // Ignore messages older than this (to avoid processing sync messages on connection)
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuepasaMappingRequest {
  phoneNumber?: string; // Optional - will be filled after QR scan
  name: string;
  chatwootBaseUrl?: string;
  chatwootApiToken?: string;
  chatwootAccountId?: string;
  chatwootInboxId?: string;
  chatwootInboxName?: string; // Custom name for Chatwoot inbox
  enableGroups?: boolean; // Enable receiving messages from WhatsApp groups
  reopenClosedTickets?: boolean; // Reopen closed tickets for returning customers
  showAgentName?: boolean; // Show agent name in messages sent to WhatsApp
  maxMessageAgeMinutes?: number; // Ignore messages older than this (to avoid processing sync messages on connection)
  active?: boolean;
}

export interface QuepasaSyncResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
}
