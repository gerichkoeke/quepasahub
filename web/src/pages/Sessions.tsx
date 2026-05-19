import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Link2,
  Send,
  Eye,
  EyeOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  QrCode,
  Copy,
  ExternalLink,
  Share2,
  Check,
  X,
  MessageCircle,
  Power,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { QRCodeModal } from '../components/QRCodeModal';
import { QuepasaQRCodeModal } from '../components/QuepasaQRCodeModal';
import { api } from '../services/api';
import { Session, Mapping, CreateMappingRequest, QuepasaMapping, CreateQuepasaMappingRequest } from '../types';
import toast from 'react-hot-toast';

type ConnectionType = 'waha' | 'quepasa';

export const Sessions: React.FC = () => {
  // Waha states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  // Quepasa states
  const [quepasaMappings, setQuepasaMappings] = useState<QuepasaMapping[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [lastCreatedSession, setLastCreatedSession] = useState<string | null>(null);

  // Modal states
  const [showCreateConnectionModal, setShowCreateConnectionModal] = useState(false);
  const [connectionType, setConnectionType] = useState<ConnectionType>('waha');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChatwootConfigModal, setShowChatwootConfigModal] = useState(false);
  const [showMappingsModal, setShowMappingsModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [showQuepasaQRModal, setShowQuepasaQRModal] = useState(false);
  const [quepasaQRMappingId, setQuepasaQRMappingId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [editingQuepasa, setEditingQuepasa] = useState<QuepasaMapping | null>(null);
  const [showChatwootApiToken, setShowChatwootApiToken] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState<CreateMappingRequest>({
    session_name: '',
    typebot_id: '',
    typebot_url: '',
    restart_keyword: '',
    session_timeout: undefined,
    pause_on_takeover: true,
    owner_resume_keyword: '',
    enable_groups: false,
    active: true,
  });

  const [quepasaForm, setQuepasaForm] = useState({
    name: '',
    sendQRToChatwoot: false,
  });

  const [chatwootForm, setChatwootForm] = useState({
    chatwootBaseUrl: '',
    chatwootApiToken: '',
    chatwootAccountId: '',
    chatwootInboxName: '',
    closingMessage: '',
    returnWebhookUrl: '',
    useTypebot: false,
    typebotFlowId: '',
    typebotHost: '',
    typebotApiKey: '',
    enableGroups: false,
    reopenClosedTickets: false,
    showAgentName: false,
  });

  const [testForm, setTestForm] = useState({
    phone: '',
    message: '',
  });
  const [newSessionName, setNewSessionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingMappingId, setExistingMappingId] = useState<number | null>(null);

  useEffect(() => {
    loadData();

    // Sync Quepasa connections immediately on load
    const syncQuepasaOnLoad = async () => {
      try {
        const result = await api.syncQuepasaConnections();
        if (result.imported > 0 || result.updated > 0 || result.deleted > 0) {
          console.log('[Sessions] Quepasa initial sync:', result);
          loadData(true); // Reload data silently if there were changes
        }
      } catch (error) {
        console.log('[Sessions] Quepasa initial sync skipped:', error);
      }
    };
    syncQuepasaOnLoad();

    // Poll every 5 seconds to update session status in real-time
    const statusInterval = setInterval(() => {
      loadData(true); // Silent reload to avoid loading spinner
    }, 5000);

    // Poll every 15 seconds to sync Quepasa connections automatically
    const syncQuepasaInterval = setInterval(async () => {
      try {
        const result = await api.syncQuepasaConnections();
        if (result.imported > 0 || result.updated > 0 || result.deleted > 0) {
          console.log('[Sessions] Quepasa auto-sync:', result);
          loadData(true); // Reload data silently if there were changes
        }
      } catch (error) {
        // Silent fail - don't show errors for background sync
        console.log('[Sessions] Quepasa auto-sync skipped:', error);
      }
    }, 15000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(syncQuepasaInterval);
    };
  }, []);

  // Auto-open QR modal when newly created session changes to SCAN_QR_CODE
  useEffect(() => {
    if (!lastCreatedSession || showQRModal) return;

    const session = sessions.find(s => s.name === lastCreatedSession);
    if (session && session.status === 'SCAN_QR_CODE') {
      console.log('[Sessions] Auto-opening QR modal for:', lastCreatedSession);
      setQrSessionId(lastCreatedSession);
      setShowQRModal(true);
      setLastCreatedSession(null); // Clear after opening
    }
  }, [sessions, lastCreatedSession, showQRModal]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [sessionsData, mappingsData, quepasaData] = await Promise.all([
        api.getSessions(),
        api.getMappings(),
        api.getQuepasaMappings(),
      ]);

      // Debug: log session statuses
      if (silent) {
        console.log('[Sessions] Polling update:', sessionsData.map(s => ({ name: s.name, status: s.status })));
      }

      setSessions(sessionsData);
      setMappings(mappingsData);
      setQuepasaMappings(quepasaData);
    } catch (error: any) {
      // Don't show error if Waha is not configured (handled silently)
      const isWahaNotConfigured = error.response?.data?.configured === false ||
                                   error.response?.data?.error === 'Waha not configured';

      if (!silent && !isWahaNotConfigured) {
        toast.error(error.response?.data?.message || 'Falha ao carregar dados');
        console.error('[Sessions] Error loading data:', error);
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Helper function to get mappings for a session
  const getSessionMappings = (sessionName: string) => {
    return mappings.filter((m) => m.session_name === sessionName);
  };

  // Combine Waha sessions and Quepasa mappings into a unified list
  type UnifiedConnection = {
    id: string;
    type: ConnectionType;
    name: string;
    status?: Session['status'];
    mappingCount?: number;
    activeMappingCount?: number;
    phoneNumber?: string;
    chatwootUrl?: string;
    active?: boolean;
    data?: Session | QuepasaMapping;
  };

  const unifiedConnections: UnifiedConnection[] = [
    ...sessions.map(session => ({
      id: `waha-${session.name}`,
      type: 'waha' as ConnectionType,
      name: session.name,
      status: session.status,
      mappingCount: getSessionMappings(session.name).length,
      activeMappingCount: getSessionMappings(session.name).filter(m => m.active).length,
      data: session,
    })),
    ...quepasaMappings.map(mapping => ({
      id: `quepasa-${mapping.id}`,
      type: 'quepasa' as ConnectionType,
      name: mapping.name,
      phoneNumber: mapping.phoneNumber,
      chatwootUrl: mapping.chatwootBaseUrl,
      active: mapping.active,
      data: mapping,
    })),
  ];

  const filteredConnections = unifiedConnections.filter((conn) =>
    conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conn.phoneNumber && conn.phoneNumber.includes(searchTerm))
  );

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.createMapping(createForm);
      toast.success('Integração criada com sucesso');
      setShowCreateModal(false);
      setCreateForm({ session_name: '', typebot_id: '', typebot_url: '', restart_keyword: '', pause_on_takeover: true, owner_resume_keyword: '' });
      setExistingMappingId(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao criar integração');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMapping = async () => {
    if (!existingMappingId) return;

    if (!confirm('Tem certeza que deseja remover esta integração?')) {
      return;
    }

    try {
      setIsSubmitting(true);
      await api.deleteMapping(existingMappingId);
      toast.success('Integração removida com sucesso');
      setShowCreateModal(false);
      setCreateForm({ session_name: '', typebot_id: '', typebot_url: '', restart_keyword: '', pause_on_takeover: true, owner_resume_keyword: '' });
      setExistingMappingId(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao remover integração');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleMapping = async (mapping: Mapping) => {
    try {
      await api.toggleMapping(mapping.id);
      toast.success(`Integração ${mapping.active ? 'desativada' : 'ativada'}`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao alternar integração');
    }
  };

  const handleDeleteMapping = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta integração?')) {
      return;
    }
    try {
      await api.deleteMapping(id);
      toast.success('Integração excluída com sucesso');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao excluir integração');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(`Tem certeza que deseja excluir a sessão "${sessionId}"?`)) {
      return;
    }
    try {
      await api.deleteSession(sessionId);
      toast.success('Sessão excluída com sucesso');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao excluir sessão');
    }
  };

  const handleShowQR = (sessionId: string) => {
    setQrSessionId(sessionId);
    setShowQRModal(true);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;

    try {
      setIsSubmitting(true);
      const response = await api.sendTestMessage({
        session_name: selectedSession,
        phone: testForm.phone,
        message: testForm.message,
      });
      if (response.success) {
        toast.success('Mensagem de teste enviada com sucesso');
        setShowTestModal(false);
        setTestForm({ phone: '', message: '' });
      } else {
        toast.error(response.message || 'Falha ao enviar mensagem de teste');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao enviar mensagem de teste');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = async (sessionName: string) => {
    // Check if mapping already exists for this session (ignore connection-only mappings)
    const existingMapping = mappings.find((m) => m.session_name === sessionName && m.typebot_id !== 'connection-only');

    if (existingMapping) {
      // Populate form with existing data
      setCreateForm({
        session_name: sessionName,
        typebot_id: existingMapping.typebot_id,
        typebot_url: existingMapping.typebot_url,
        restart_keyword: existingMapping.restart_keyword || '',
        session_timeout: existingMapping.session_timeout,
        pause_on_takeover: existingMapping.pause_on_takeover !== undefined ? existingMapping.pause_on_takeover : true,
        owner_resume_keyword: existingMapping.owner_resume_keyword || '',
        enable_groups: existingMapping.enable_groups || false,
        active: existingMapping.active,
      });
      setExistingMappingId(existingMapping.id);
    } else {
      // Reset form for new mapping
      setCreateForm({
        session_name: sessionName,
        typebot_id: '',
        typebot_url: '',
        restart_keyword: '',
        session_timeout: undefined,
        pause_on_takeover: true,
        owner_resume_keyword: '',
        enable_groups: false,
        active: true,
      });
      setExistingMappingId(null);
    }

    setShowCreateModal(true);
  };

  const openMappingsModal = (sessionName: string) => {
    setSelectedSession(sessionName);
    setShowMappingsModal(true);
  };

  const openTestModal = (sessionName: string) => {
    setSelectedSession(sessionName);
    setShowTestModal(true);
  };

  const handleShareSession = async (sessionName: string) => {
    // Find active mapping for this session
    let sessionMapping = mappings.find(
      (m) => m.session_name === sessionName && m.active && m.public_url
    );

    // If no mapping with public URL exists, create a connection-only mapping
    if (!sessionMapping || !sessionMapping.public_url) {
      try {
        toast.loading('Gerando URL de conexão...', { id: 'generating' });

        // Create a minimal mapping just for connection (no typebot required)
        const newMapping = await api.createConnectionMapping(sessionName);

        toast.success('URL de conexão gerada!', { id: 'generating' });

        // Reload mappings to get the new one
        await loadData(true);

        // Use the newly created mapping
        setShareUrl(newMapping.public_url || '');
        setShowShareModal(true);
        return;
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Erro ao gerar URL de conexão', { id: 'generating' });
        return;
      }
    }

    // Open share modal with URL
    setShareUrl(sessionMapping.public_url);
    setShowShareModal(true);
  };

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('URL de conexão copiada!');
  };


  // Unified connection creation handler
  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      if (connectionType === 'waha') {
        const session = await api.createSession(newSessionName);
        toast.success('Sessão Waha criada com sucesso');
        setShowCreateConnectionModal(false);
        setNewSessionName('');
        await loadData();

        // Show QR code if session needs scanning
        if (session.status === 'SCAN_QR_CODE') {
          setQrSessionId(session.name);
          setShowQRModal(true);
          setLastCreatedSession(null);
        } else if (session.status === 'STARTING') {
          setLastCreatedSession(session.name);
          toast('Sessão iniciando, QR code aparecerá automaticamente...', {
            icon: '⏳',
            duration: 4000,
          });
        }
      } else {
        // Check if user wants QR code sent to Chatwoot
        if (quepasaForm.sendQRToChatwoot) {
          // Create Quepasa connection with Chatwoot integration and send QR to Chatwoot
          toast.loading('Criando conexão e integrando com Chatwoot...', { id: 'create-qr-chatwoot' });

          const data = {
            name: quepasaForm.name,
            chatwootBaseUrl: chatwootForm.chatwootBaseUrl,
            chatwootApiToken: chatwootForm.chatwootApiToken,
            chatwootAccountId: chatwootForm.chatwootAccountId,
            chatwootInboxName: chatwootForm.chatwootInboxName || undefined,
            closingMessage: chatwootForm.closingMessage || undefined,
            returnWebhookUrl: chatwootForm.returnWebhookUrl || undefined,
            useTypebot: chatwootForm.useTypebot,
            typebotFlowId: chatwootForm.typebotFlowId || undefined,
            typebotHost: chatwootForm.typebotHost || undefined,
            typebotApiKey: chatwootForm.typebotApiKey || undefined,
            enableGroups: chatwootForm.enableGroups,
            sendQRToChatwoot: true,
          };

          await api.createQuepasaMappingWithChatwoot(data);

          toast.success('Conexão criada! QR code enviado para o Chatwoot. Escaneie na conversa "Gerador de QR".', {
            id: 'create-qr-chatwoot',
            duration: 6000,
          });
          setShowCreateConnectionModal(false);
          resetQuepasaForm();
          await loadData();
        } else {
          // Create Quepasa connection without Chatwoot config
          // Chatwoot fields are optional and will be configured later via the icon
          const data: CreateQuepasaMappingRequest = {
            name: quepasaForm.name,
            active: false, // Inactive until Chatwoot is configured
          };
          const newMapping = await api.createQuepasaMapping(data);
          toast.success('Conexão Quepasa criada. Escaneie o QR code para conectar.');
          setShowCreateConnectionModal(false);
          resetQuepasaForm();
          await loadData();

          // Show QR code modal automatically with the mapping ID
          setQuepasaQRMappingId(newMapping.id);
          setShowQuepasaQRModal(true);
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Falha ao criar conexão';
      toast.error(errorMessage);
      console.error('[Sessions] Error creating connection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chatwoot configuration handler
  const handleConfigureChatwoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuepasa) return;

    try {
      setIsSubmitting(true);

      // First, update the mapping with Chatwoot credentials
      const updateData: Partial<CreateQuepasaMappingRequest> = {
        chatwootBaseUrl: chatwootForm.chatwootBaseUrl,
        chatwootAccountId: chatwootForm.chatwootAccountId,
        chatwootInboxName: chatwootForm.chatwootInboxName || undefined,
        closingMessage: chatwootForm.closingMessage || undefined,
        returnWebhookUrl: chatwootForm.returnWebhookUrl || undefined,
        useTypebot: chatwootForm.useTypebot,
        typebotFlowId: chatwootForm.typebotFlowId || undefined,
        typebotHost: chatwootForm.typebotHost || undefined,
        typebotApiKey: chatwootForm.typebotApiKey || undefined,
        enableGroups: chatwootForm.enableGroups,
        reopenClosedTickets: chatwootForm.reopenClosedTickets,
        showAgentName: chatwootForm.showAgentName,
      };
      // Only send token if it was changed (not the placeholder)
      if (chatwootForm.chatwootApiToken && chatwootForm.chatwootApiToken !== '••••••••••••••') {
        updateData.chatwootApiToken = chatwootForm.chatwootApiToken;
      }
      await api.updateQuepasaMapping(editingQuepasa.id, updateData);

      // Then, call the setup integration endpoint to create inbox and configure webhooks
      toast.loading('Configurando integração com Chatwoot...', { id: 'setup' });
      await api.setupQuepasaChatwootIntegration(editingQuepasa.id);

      toast.success('Integração Chatwoot configurada com sucesso! Inbox criada e webhooks configurados.', { id: 'setup' });
      setShowChatwootConfigModal(false);
      resetChatwootForm();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Falha ao configurar integração', { id: 'setup' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuepasa = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conexão?')) return;
    try {
      await api.deleteQuepasaMapping(id);
      toast.success('Conexão excluída');
      loadData();
    } catch (error: any) {
      toast.error('Falha ao excluir conexão');
    }
  };

  const handleDisconnectQuepasa = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja desconectar "${name}"? Será necessário escanear o QR code novamente.`)) return;
    try {
      toast.loading('Desconectando...', { id: 'disconnect' });
      await api.disconnectQuepasa(id);
      toast.success('Conexão desconectada com sucesso', { id: 'disconnect' });
      loadData();
    } catch (error: any) {
      toast.error('Falha ao desconectar', { id: 'disconnect' });
    }
  };

  const handleOpenChatwootConfig = (mapping: QuepasaMapping) => {
    setEditingQuepasa(mapping);
    // If chatwoot is configured (baseUrl is not 'pending'), assume token exists
    const hasChatwootConfigured = mapping.chatwootBaseUrl !== 'pending';
    setChatwootForm({
      chatwootBaseUrl: mapping.chatwootBaseUrl !== 'pending' ? mapping.chatwootBaseUrl : '',
      chatwootApiToken: hasChatwootConfigured ? '••••••••••••••' : '', // Show dots if token exists
      chatwootAccountId: mapping.chatwootAccountId !== 'pending' ? mapping.chatwootAccountId : '',
      chatwootInboxName: mapping.chatwootInboxName || '',
      closingMessage: mapping.closingMessage || '',
      returnWebhookUrl: mapping.returnWebhookUrl || '',
      useTypebot: mapping.useTypebot || false,
      typebotFlowId: mapping.typebotFlowId || '',
      typebotHost: mapping.typebotHost || '',
      typebotApiKey: mapping.typebotApiKey || '',
      enableGroups: mapping.enableGroups || false,
      reopenClosedTickets: mapping.reopenClosedTickets || false,
      showAgentName: mapping.showAgentName || false,
    });
    setShowChatwootConfigModal(true);
  };

  const resetQuepasaForm = () => {
    setQuepasaForm({
      name: '',
      sendQRToChatwoot: false,
    });
    resetChatwootForm();
  };

  const resetChatwootForm = () => {
    setEditingQuepasa(null);
    setChatwootForm({
      chatwootBaseUrl: '',
      chatwootApiToken: '',
      chatwootAccountId: '',
      chatwootInboxName: '',
      enableGroups: false,
      reopenClosedTickets: false,
      showAgentName: false,
    });
    setShowChatwootApiToken(false); // Reset visibility when closing modal
  };

  // Helper to format phone number (remove WhatsApp suffix)
  const formatPhoneNumber = (phoneNumber: string) => {
    // Remove ":XX@s.whatsapp.net" suffix, keeping only the digits
    return phoneNumber.split(':')[0];
  };

  const getStatusBadge = (status: Session['status']) => {
    const statusConfig = {
      WORKING: 'bg-green-100 text-green-800',
      STOPPED: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800',
      STARTING: 'bg-yellow-100 text-yellow-800',
      SCAN_QR_CODE: 'bg-primary bg-opacity-10 text-primary',
    };

    const statusLabels = {
      WORKING: 'Conectado',
      STOPPED: 'Pausado',
      FAILED: 'Falhou',
      STARTING: 'Iniciando',
      SCAN_QR_CODE: 'QR Code',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusConfig[status]}`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const columns = [
    {
      header: 'Tipo',
      accessor: (row: UnifiedConnection) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          row.type === 'waha' ? 'bg-primary bg-opacity-10 text-primary' : 'bg-purple-100 text-purple-800'
        }`}>
          {row.type === 'waha' ? 'Waha' : 'Quepasa'}
        </span>
      ),
    },
    {
      header: 'Nome / Telefone',
      accessor: (row: UnifiedConnection) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          {row.phoneNumber && (
            <div className="text-sm text-gray-500">{formatPhoneNumber(row.phoneNumber)}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Status / Destino',
      accessor: (row: UnifiedConnection) => {
        if (row.type === 'waha' && row.status) {
          return (
            <div className="flex items-center gap-2">
              {getStatusBadge(row.status)}
              {row.status === 'STARTING' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
              )}
            </div>
          );
        }
        if (row.type === 'quepasa') {
          return (
            <div>
              <div className="flex items-center gap-2 mb-1">
                {row.active ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Check className="w-3 h-3 mr-1" />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <X className="w-3 h-3 mr-1" />
                    Inativo
                  </span>
                )}
              </div>
              {row.chatwootUrl && row.chatwootUrl !== 'pending' && (
                <div className="text-sm text-gray-600 truncate max-w-xs" title={row.chatwootUrl}>
                  → {row.chatwootUrl}
                </div>
              )}
            </div>
          );
        }
        return null;
      },
    },
    {
      header: 'Integrações',
      accessor: (row: UnifiedConnection) => {
        if (row.type === 'waha') {
          return (
            <span className="text-gray-900">
              {row.activeMappingCount} / {row.mappingCount}
            </span>
          );
        }
        if (row.type === 'quepasa') {
          const mapping = row.data as QuepasaMapping;
          const isConfigured = mapping.chatwootBaseUrl !== 'pending';
          return (
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  Chatwoot
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  Pendente
                </span>
              )}
            </div>
          );
        }
        return <span className="text-gray-400">–</span>;
      },
    },
    {
      header: 'Ações',
      accessor: (row: UnifiedConnection) => {
        if (row.type === 'waha') {
          const session = row.data as Session;
          return (
            <div className="flex items-center gap-2">
              {(session.status === 'SCAN_QR_CODE' || session.status === 'STARTING') && (
                <button
                  onClick={() => handleShowQR(session.name)}
                  className={`p-1 rounded transition-colors ${
                    session.status === 'SCAN_QR_CODE'
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-yellow-600 hover:bg-yellow-50'
                  }`}
                  title={session.status === 'SCAN_QR_CODE' ? 'Mostrar QR Code' : 'Iniciando... Clique para ver QR'}
                >
                  <QrCode className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => handleShareSession(session.name)}
                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Compartilhar URL de conexão"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => openCreateModal(session.name)}
                className="p-1 text-primary hover:bg-primary bg-opacity-5 rounded transition-colors"
                title="Vincular ao Typebot"
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => openTestModal(session.name)}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Enviar mensagem de teste"
              >
                <Send className="w-4 h-4" />
              </button>
              <button
                onClick={() => openMappingsModal(session.name)}
                className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                title="Ver integrações"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteSession(session.name)}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Excluir sessão"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }

        if (row.type === 'quepasa') {
          const mapping = row.data as QuepasaMapping;
          const isConfigured = mapping.chatwootBaseUrl !== 'pending';
          const isConnected = mapping.active && mapping.phoneNumber;

          return (
            <div className="flex items-center gap-2">
              {/* Show QR button if not connected, disconnect button if connected */}
              {isConnected ? (
                <button
                  onClick={() => handleDisconnectQuepasa(mapping.id, mapping.name)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Desconectar do WhatsApp"
                >
                  <Power className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setQuepasaQRMappingId(mapping.id);
                    setShowQuepasaQRModal(true);
                  }}
                  className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                  title="Visualizar QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => handleOpenChatwootConfig(mapping)}
                className={`p-1 rounded transition-colors ${
                  isConfigured
                    ? 'text-green-600 hover:bg-green-50'
                    : 'text-orange-600 hover:bg-orange-50 animate-pulse'
                }`}
                title={isConfigured ? 'Configurar Chatwoot' : 'Configurar Chatwoot (Obrigatório)'}
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteQuepasa(mapping.id)}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }

        return null;
      },
    },
  ];

  const sessionMappings = selectedSession ? getSessionMappings(selectedSession) : [];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Conexões</h1>
            <p className="text-gray-600 mt-1">Gerencie suas conexões Waha e Quepasa</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={() => {
                // Reset all forms when opening modal
                setNewSessionName('');
                resetQuepasaForm();
                setConnectionType('waha');
                setShowCreateConnectionModal(true);
              }}
            >
              <Plus className="w-5 h-5 mr-2" />
              Criar Conexão
            </Button>
          </div>
        </div>

        <Card>
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar conexões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <Table data={filteredConnections} columns={columns} isLoading={isLoading} />
        </Card>

        {/* Unified Create Connection Modal */}
        <Modal
          isOpen={showCreateConnectionModal}
          onClose={() => {
            setShowCreateConnectionModal(false);
            setNewSessionName('');
            resetQuepasaForm();
          }}
          title="Criar Nova Conexão"
          footer={
            <>
              <Button variant="ghost" onClick={() => {
                setShowCreateConnectionModal(false);
                setNewSessionName('');
                resetQuepasaForm();
              }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateConnection}
                isLoading={isSubmitting}
              >
                Criar
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateConnection} className="space-y-4">
            {/* Connection Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Conexão
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConnectionType('waha')}
                  className={`p-3 border-2 rounded-lg transition-all ${
                    connectionType === 'waha'
                      ? 'border-primary bg-primary bg-opacity-5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      connectionType === 'waha'
                        ? 'bg-primary bg-opacity-50 text-white'
                        : 'bg-primary bg-opacity-10 text-primary'
                    }`}>
                      Waha
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Sessão WhatsApp</p>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionType('quepasa')}
                  className={`p-3 border-2 rounded-lg transition-all ${
                    connectionType === 'quepasa'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      connectionType === 'quepasa'
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      Quepasa
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">Quepasa → Chatwoot</p>
                </button>
              </div>
            </div>

            {/* Waha Fields */}
            {connectionType === 'waha' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Sessão
                </label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="e.g., NomeEstancia"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Escolha um nome único para esta sessão do WhatsApp
                </p>
              </div>
            )}

            {/* Quepasa Fields */}
            {connectionType === 'quepasa' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Conexão *</label>
                  <input
                    type="text"
                    required
                    value={quepasaForm.name}
                    onChange={(e) => setQuepasaForm({ ...quepasaForm, name: e.target.value })}
                    placeholder="Ex: Atendimento Principal"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="mt-1 text-xs text-gray-500">Nome para identificar esta conexão Quepasa</p>
                </div>

                {/* Toggle: Enviar QR para Chatwoot */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      Enviar QR Code para Chatwoot
                    </label>
                    <p className="text-xs text-gray-600">
                      Ative para receber o QR code direto no Chatwoot ao invés do painel
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuepasaForm({ ...quepasaForm, sendQRToChatwoot: !quepasaForm.sendQRToChatwoot })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                      quepasaForm.sendQRToChatwoot ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        quepasaForm.sendQRToChatwoot ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Campos Chatwoot (condicionais) */}
                {quepasaForm.sendQRToChatwoot && (
                  <>
                    <div className="p-3 bg-primary bg-opacity-5 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-primary mb-1">Configuração Chatwoot</p>
                      <p className="text-xs text-primary">
                        Preencha os dados do Chatwoot. O QR code será enviado automaticamente para uma conversa na caixa criada.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Chatwoot URL *
                      </label>
                      <input
                        type="url"
                        required
                        value={chatwootForm.chatwootBaseUrl}
                        onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootBaseUrl: e.target.value })}
                        placeholder="https://app.chatwoot.com"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Token *
                      </label>
                      <input
                        type="password"
                        required
                        value={chatwootForm.chatwootApiToken}
                        onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootApiToken: e.target.value })}
                        placeholder="Token de acesso do Chatwoot"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={chatwootForm.chatwootAccountId}
                        onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootAccountId: e.target.value })}
                        placeholder="1"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="mt-1 text-xs text-gray-500">ID da conta no Chatwoot (normalmente é 1)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome da Caixa no Chatwoot (Opcional)
                      </label>
                      <input
                        type="text"
                        value={chatwootForm.chatwootInboxName}
                        onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootInboxName: e.target.value })}
                        placeholder={`Quepasa - ${quepasaForm.name || 'Atendimento'}`}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Nome personalizado para a caixa de entrada no Chatwoot
                      </p>
                    </div>

                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-medium text-gray-800 mb-2">Finalização & Webhook</h4>
                        
                        <label className="block text-sm font-medium text-gray-700 mb-1 mt-2">
                          Mensagem de Finalização de Atendimento
                        </label>
                        <textarea
                          value={chatwootForm.closingMessage}
                          onChange={(e) => setChatwootForm({ ...chatwootForm, closingMessage: e.target.value })}
                          placeholder="Mensagem enviada quando o ticket for resolvido"
                          className="w-full px-3 py-2 border rounded-lg"
                          rows={2}
                        />

                        <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">
                          Webhook de Retorno (Opcional)
                        </label>
                        <input
                          type="url"
                          value={chatwootForm.returnWebhookUrl}
                          onChange={(e) => setChatwootForm({ ...chatwootForm, returnWebhookUrl: e.target.value })}
                          placeholder="https://seu-webhook.com/return"
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>

                      <div className="mt-4 border-t pt-4">
                        <h4 className="font-medium text-gray-800 mb-2">Integração Typebot</h4>
                        
                        <label className="flex items-center space-x-2 mt-2">
                          <input
                            type="checkbox"
                            checked={chatwootForm.useTypebot}
                            onChange={(e) => setChatwootForm({ ...chatwootForm, useTypebot: e.target.checked })}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-gray-700">Habilitar Typebot (antes de enviar para Chatwoot)</span>
                        </label>

                        {chatwootForm.useTypebot && (
                          <div className="pl-4 mt-3 space-y-3 border-l-2 border-gray-200">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                URL do Typebot
                              </label>
                              <input
                                type="url"
                                value={chatwootForm.typebotHost}
                                onChange={(e) => setChatwootForm({ ...chatwootForm, typebotHost: e.target.value })}
                                placeholder="https://typebot.exemplo.com"
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome do Fluxo (Flow ID)
                              </label>
                              <input
                                type="text"
                                value={chatwootForm.typebotFlowId}
                                onChange={(e) => setChatwootForm({ ...chatwootForm, typebotFlowId: e.target.value })}
                                placeholder="meu-fluxo-v1"
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key (Opcional)
                              </label>
                              <input
                                type="password"
                                value={chatwootForm.typebotApiKey}
                                onChange={(e) => setChatwootForm({ ...chatwootForm, typebotApiKey: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                  </>
                )}

                {!quepasaForm.sendQRToChatwoot && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MessageCircle className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-900">Como funciona</p>
                        <ol className="text-xs text-purple-700 mt-1 list-decimal list-inside space-y-1">
                          <li>Dê um nome para identificar esta conexão</li>
                          <li>Escaneie o QR code que aparecerá automaticamente</li>
                          <li>Configure o Chatwoot clicando no ícone <MessageCircle className="w-3 h-3 inline" /></li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </form>
        </Modal>

        {/* Chatwoot Configuration Modal */}
        <Modal
          isOpen={showChatwootConfigModal}
          onClose={() => {
            setShowChatwootConfigModal(false);
            resetChatwootForm();
          }}
          title="Configurar Integração Chatwoot"
        >
          <form onSubmit={handleConfigureChatwoot} className="space-y-4">
            <div className="p-3 bg-primary bg-opacity-5 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-primary">
                    {editingQuepasa?.name}
                  </p>
                  <p className="text-xs text-primary mt-1">
                    Configure os dados de acesso ao Chatwoot para esta conexão Quepasa.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chatwoot URL *
              </label>
              <input
                type="url"
                required
                value={chatwootForm.chatwootBaseUrl}
                onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootBaseUrl: e.target.value })}
                placeholder="https://app.chatwoot.com"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Token *
              </label>
              <div className="relative">
                <input
                  type={showChatwootApiToken ? "text" : "password"}
                  required={chatwootForm.chatwootBaseUrl === ''}
                  value={chatwootForm.chatwootApiToken}
                  onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootApiToken: e.target.value })}
                  placeholder="Deixe vazio para manter o token atual"
                  className="w-full px-3 py-2 pr-10 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowChatwootApiToken(!showChatwootApiToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showChatwootApiToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showChatwootApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account ID *
              </label>
              <input
                type="text"
                required
                value={chatwootForm.chatwootAccountId}
                onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootAccountId: e.target.value })}
                placeholder="1"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="mt-1 text-xs text-gray-500">ID da conta no Chatwoot (normalmente é 1)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Caixa no Chatwoot (Opcional)
              </label>
              <input
                type="text"
                value={chatwootForm.chatwootInboxName}
                onChange={(e) => setChatwootForm({ ...chatwootForm, chatwootInboxName: e.target.value })}
                placeholder={editingQuepasa ? `Quepasa - ${editingQuepasa.name}` : "Nome personalizado da caixa"}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="mt-1 text-xs text-gray-500">
                Nome personalizado para a caixa de entrada no Chatwoot
                {editingQuepasa && ` (padrão: Quepasa - ${editingQuepasa.name})`}
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Receber mensagens de grupos
                </label>
                <p className="text-xs text-gray-600">
                  Ative para processar mensagens de grupos do WhatsApp no Chatwoot
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatwootForm({ ...chatwootForm, enableGroups: !chatwootForm.enableGroups })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                  chatwootForm.enableGroups ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    chatwootForm.enableGroups ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Reabrir ticket
                </label>
                <p className="text-xs text-gray-600">
                  Ative para sempre usar o mesmo ticket no Chatwoot, mesmo que esteja fechado. O sistema reabrirá tickets fechados automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatwootForm({ ...chatwootForm, reopenClosedTickets: !chatwootForm.reopenClosedTickets })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  chatwootForm.reopenClosedTickets ? 'bg-orange-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    chatwootForm.reopenClosedTickets ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Mostrar nome do atendente
                </label>
                <p className="text-xs text-gray-600">
                  Ative para incluir o nome do atendente antes de cada mensagem enviada para o WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatwootForm({ ...chatwootForm, showAgentName: !chatwootForm.showAgentName })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  chatwootForm.showAgentName ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    chatwootForm.showAgentName ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="secondary" onClick={() => {
                setShowChatwootConfigModal(false);
                resetChatwootForm();
              }}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                Salvar Configuração
              </Button>
            </div>
          </form>
        </Modal>

        {/* Existing modals from original code... */}
        {/* I'll keep the essential modals */}

        {/* QR Code Modal (Waha) */}
        {showQRModal && qrSessionId && (
          <QRCodeModal
            sessionId={qrSessionId}
            onClose={() => {
              setShowQRModal(false);
              setQrSessionId(null);
              loadData(); // Refresh to check if session is now WORKING
            }}
          />
        )}

        {/* QR Code Modal (Quepasa) */}
        {showQuepasaQRModal && quepasaQRMappingId && (
          <QuepasaQRCodeModal
            mappingId={quepasaQRMappingId}
            onClose={() => {
              setShowQuepasaQRModal(false);
              setQuepasaQRMappingId(null);
              loadData(); // Refresh to check connection status
            }}
            onConnected={() => {
              loadData(); // Refresh data when connected
            }}
          />
        )}

        {/* Share URL Modal */}
        <Modal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Compartilhar Conexão WhatsApp"
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-primary bg-opacity-50 rounded-lg">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    URL de Conexão Pública
                  </h3>
                  <p className="text-sm text-gray-600">
                    Compartilhe esta URL com seu cliente para permitir que ele conecte o WhatsApp sem precisar de autenticação no sistema.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase">
                  Link de Conexão
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono text-gray-800 focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyShareUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors flex-shrink-0"
                    title="Copiar URL"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="font-medium">Copiar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>

        {/* Create Typebot Mapping Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={existingMappingId ? 'Editar Integração Typebot' : 'Criar Integração Typebot'}
          footer={
            <>
              {existingMappingId && (
                <Button
                  variant="danger"
                  onClick={handleRemoveMapping}
                  isLoading={isSubmitting}
                >
                  Remover Integração
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateMapping}
                isLoading={isSubmitting}
              >
                {existingMappingId ? 'Atualizar' : 'Criar'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateMapping} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Typebot ID
              </label>
              <input
                type="text"
                value={createForm.typebot_id}
                onChange={(e) => setCreateForm({ ...createForm, typebot_id: e.target.value })}
                placeholder="Digite o ID do Typebot"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Typebot URL
              </label>
              <input
                type="url"
                value={createForm.typebot_url}
                onChange={(e) => setCreateForm({ ...createForm, typebot_url: e.target.value })}
                placeholder="https://typebot.example.com/api/v1/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Palavra-chave para reiniciar (opcional)
              </label>
              <input
                type="text"
                value={createForm.restart_keyword || ''}
                onChange={(e) => setCreateForm({ ...createForm, restart_keyword: e.target.value })}
                placeholder="Ex: reiniciar, /start, menu"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="mt-1 text-sm text-gray-500">
                Quando o usuário enviar esta palavra, o fluxo será reiniciado do zero
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tempo de validade da sessão (opcional)
              </label>
              <input
                type="number"
                min="1"
                value={createForm.session_timeout || ''}
                onChange={(e) => setCreateForm({ ...createForm, session_timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="Ex: 30"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="mt-1 text-sm text-gray-500">
                Tempo em minutos após o qual a sessão expira e reinicia (deixe vazio para nunca expirar)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pausar bot quando assumir conversa
                </label>
                <p className="text-sm text-gray-500">
                  Quando você enviar mensagem manual, o bot pausa automaticamente
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, pause_on_takeover: !createForm.pause_on_takeover })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  createForm.pause_on_takeover ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    createForm.pause_on_takeover ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Palavra-chave para retomar bot (opcional)
              </label>
              <input
                type="text"
                value={createForm.owner_resume_keyword || ''}
                onChange={(e) => setCreateForm({ ...createForm, owner_resume_keyword: e.target.value })}
                placeholder="Ex: retomar"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
              <p className="mt-1 text-sm text-gray-500">
                Palavra que você pode enviar para o cliente para retomar o bot do início
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionar em grupos
                </label>
                <p className="text-sm text-gray-500">
                  Ative para que a automação funcione em grupos do WhatsApp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, enable_groups: !createForm.enable_groups })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  createForm.enable_groups ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    createForm.enable_groups ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Integração ativa
                </label>
                <p className="text-sm text-gray-500">
                  Desative para pausar a integração sem removê-la
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, active: !createForm.active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  createForm.active ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    createForm.active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </form>
        </Modal>

        {/* View Mappings Modal */}
        <Modal
          isOpen={showMappingsModal}
          onClose={() => setShowMappingsModal(false)}
          title={`Integrações para ${selectedSession}`}
          size="lg"
        >
          {sessionMappings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Link2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Nenhuma integração encontrada para esta sessão</p>
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => {
                  setShowMappingsModal(false);
                  openCreateModal(selectedSession!);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Integração
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessionMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-900">
                          Typebot ID: {mapping.typebot_id}
                        </h4>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            mapping.active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {mapping.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 break-all">{mapping.typebot_url}</p>

                      {/* Public URL */}
                      {mapping.public_url && (
                        <div className="mt-3 p-3 bg-primary bg-opacity-5 rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <label className="text-xs font-semibold text-primary mb-1 block">
                                URL de Conexão Pública
                              </label>
                              <p className="text-xs text-primary break-all font-mono">
                                {mapping.public_url}
                              </p>
                              <p className="text-xs text-primary mt-1">
                                Compartilhe esta URL para permitir conexão do WhatsApp sem autenticação
                              </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(mapping.public_url!);
                                  toast.success('URL copiada!');
                                }}
                                className="p-2 text-primary hover:bg-primary bg-opacity-10 rounded transition-colors"
                                title="Copiar URL"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <a
                                href={mapping.public_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-primary hover:bg-primary bg-opacity-10 rounded transition-colors"
                                title="Abrir em nova aba"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        Criado: {new Date(mapping.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleMapping(mapping)}
                        className="p-2 text-primary hover:bg-primary bg-opacity-5 rounded transition-colors"
                        title={mapping.active ? 'Desativar' : 'Ativar'}
                      >
                        {mapping.active ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>

        {/* Test Message Modal */}
        <Modal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          title={`Enviar Mensagem de Teste - ${selectedSession}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowTestModal(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSendTest} isLoading={isSubmitting}>
                Enviar
              </Button>
            </>
          }
        >
          <form onSubmit={handleSendTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Telefone
              </label>
              <input
                type="tel"
                value={testForm.phone}
                onChange={(e) => setTestForm({ ...testForm, phone: e.target.value })}
                placeholder="5511999999999"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Inclua o código do país sem o sinal +</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
              <textarea
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                placeholder="Digite sua mensagem de teste"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                required
              />
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
};
