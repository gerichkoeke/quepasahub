import React, { useEffect, useState } from 'react';
import { Filter, ChevronLeft, ChevronRight, Eye, X, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { api } from '../services/api';
import { EventLog, Session } from '../types';
import toast from 'react-hot-toast';

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EventLog | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    session_name: '',
    direction: '',
    provider: '',
    limit: 50,
    offset: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadSessions = async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (error: any) {
      toast.error('Falha ao carregar sessões');
    }
  };

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const params: any = {
        limit: filters.limit,
        offset: filters.offset,
      };

      if (filters.session_name) params.session_name = filters.session_name;
      if (filters.direction) params.direction = filters.direction;
      if (filters.provider) params.provider = filters.provider;

      const data = await api.getLogs(params);
      // API retorna { logs: [...], total, limit, offset }
      setLogs(data.logs || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao carregar logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string | number) => {
    setFilters((prev) => ({ ...prev, [field]: value, offset: 0 }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({
      session_name: '',
      direction: '',
      provider: '',
      limit: 50,
      offset: 0,
    });
    setCurrentPage(1);
  };

  const handleNextPage = () => {
    if (logs.length === itemsPerPage) {
      setFilters((prev) => ({ ...prev, offset: prev.offset + itemsPerPage }));
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setFilters((prev) => ({ ...prev, offset: Math.max(0, prev.offset - itemsPerPage) }));
      setCurrentPage((prev) => prev - 1);
    }
  };

  const viewPayload = (log: EventLog) => {
    setSelectedLog(log);
    setShowPayloadModal(true);
  };

  const getDirectionBadge = (direction: string) => {
    const config = {
      in: 'bg-primary bg-opacity-10 text-primary',
      out: 'bg-green-100 text-green-800',
    };
    const labels = {
      in: 'Entrada',
      out: 'Saída',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config[direction as keyof typeof config]}`}>
        {labels[direction as keyof typeof labels] || direction}
      </span>
    );
  };

  const getProviderBadge = (provider: string) => {
    const config = {
      waha: 'bg-purple-100 text-purple-800',
      typebot: 'bg-orange-100 text-orange-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config[provider as keyof typeof config]}`}>
        {provider}
      </span>
    );
  };

  const hasError = (log: EventLog): boolean => {
    const payload = log.payload as any;
    return !!(payload?.error || payload?.errorType || payload?.noMessageSent);
  };

  const getStatusIcon = (log: EventLog) => {
    if (hasError(log)) {
      const payload = log.payload as any;
      const errorMessage = payload?.error || payload?.errorType || 'Erro no processamento';
      const tooltipText = `Erro: ${errorMessage}`;

      return (
        <div className="flex items-center justify-center" title={tooltipText}>
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center" title="Sucesso">
        <CheckCircle className="w-5 h-5 text-green-600" />
      </div>
    );
  };

  const columns = [
    {
      header: 'ID',
      accessor: (row: EventLog) => row.id.substring(0, 8),
      className: 'w-20',
    },
    {
      header: 'Sessão',
      accessor: 'sessionId' as keyof EventLog,
    },
    {
      header: 'Direção',
      accessor: (row: EventLog) => getDirectionBadge(row.direction),
    },
    {
      header: 'Provedor',
      accessor: (row: EventLog) => getProviderBadge(row.provider),
    },
    {
      header: 'Destinatário',
      accessor: 'peer' as keyof EventLog,
    },
    {
      header: 'Data/Hora',
      accessor: (row: EventLog) => new Date(row.createdAt).toLocaleString('pt-BR'),
    },
    {
      header: 'Status',
      accessor: (row: EventLog) => getStatusIcon(row),
      className: 'w-16 text-center',
    },
    {
      header: 'Ações',
      accessor: (row: EventLog) => (
        <button
          onClick={() => viewPayload(row)}
          className="p-1 text-primary hover:bg-primary bg-opacity-5 rounded transition-colors"
          title="Ver payload"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
      className: 'w-20',
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Logs de Eventos</h1>
            <p className="text-gray-600 mt-1">Visualize e filtre logs de eventos webhook</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => loadLogs()}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button
              variant={showFilters ? 'primary' : 'secondary'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sessão
                </label>
                <select
                  value={filters.session_name}
                  onChange={(e) => handleFilterChange('session_name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="">Todas as Sessões</option>
                  {sessions.map((session) => (
                    <option key={session.name} value={session.name}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Direção
                </label>
                <select
                  value={filters.direction}
                  onChange={(e) => handleFilterChange('direction', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="">Todas as Direções</option>
                  <option value="in">Entrada</option>
                  <option value="out">Saída</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provedor
                </label>
                <select
                  value={filters.provider}
                  onChange={(e) => handleFilterChange('provider', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  <option value="">Todos os Provedores</option>
                  <option value="waha">Waha</option>
                  <option value="typebot">Typebot</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={handleClearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </Card>
        )}

        {/* Logs Table */}
        <Card>
          <Table data={logs} columns={columns} isLoading={isLoading} emptyMessage="Nenhum log encontrado" />

          {/* Pagination */}
          {logs.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-700">
                Página {currentPage} ({logs.length} itens)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={logs.length < itemsPerPage}
                >
                  Próxima
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Payload Modal */}
        <Modal
          isOpen={showPayloadModal}
          onClose={() => setShowPayloadModal(false)}
          title="Payload do Evento"
          size="xl"
        >
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">ID</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Sessão</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.sessionId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Direção</p>
                  <div className="mt-1">{getDirectionBadge(selectedLog.direction)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Provedor</p>
                  <div className="mt-1">{getProviderBadge(selectedLog.provider)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Destinatário</p>
                  <p className="text-sm text-gray-900 mt-1">{selectedLog.peer}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Data/Hora</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {new Date(selectedLog.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Payload</p>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  );
};
