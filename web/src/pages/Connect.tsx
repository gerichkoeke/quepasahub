import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

export default function Connect() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId: string;
    status: string;
    publicUrl: string;
  } | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadSessionInfo = async () => {
    if (!token) return;

    try {
      const info = await api.getPublicSession(token);
      setSessionInfo(info);
      setError(null);
    } catch (err: any) {
      // Check if it's a 404 error or message mentions administrator
      if (err.response?.status === 404 || err.response?.data?.error?.includes('administrator')) {
        setError('Sessão removida pelo administrador. Entre em contato para obter uma nova URL de conexão.');
      } else {
        setError(err.response?.data?.error || 'Sessão não encontrada');
      }
      setSessionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const loadQRCode = async () => {
    if (!token) return;

    try {
      const qr = await api.getPublicQRCode(token);
      setQrCode(qr);
    } catch (err: any) {
      // QR code might not be available if session is not in SCAN_QR_CODE status
      setQrCode(null);
    }
  };

  useEffect(() => {
    loadSessionInfo();
    loadQRCode();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadSessionInfo();
      loadQRCode();
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  const handleStart = async () => {
    if (!token) return;

    setActionLoading('start');
    try {
      const result = await api.startPublicSession(token);
      toast.success(result.message);
      await loadSessionInfo();
      await loadQRCode();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar sessão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    if (!token) return;

    setActionLoading('stop');
    try {
      const result = await api.stopPublicSession(token);
      toast.success(result.message);
      await loadSessionInfo();
      setQrCode(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao parar sessão');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    if (!token) return;

    setActionLoading('restart');
    try {
      const result = await api.restartPublicSession(token);
      toast.success(result.message);
      await loadSessionInfo();
      await loadQRCode();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao reiniciar sessão');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'bg-green-100 text-green-800';
      case 'SCAN_QR_CODE':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'STOPPED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-primary bg-opacity-10 text-primary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WORKING':
        return 'Conectado';
      case 'SCAN_QR_CODE':
        return 'Aguardando leitura do QR Code';
      case 'FAILED':
        return 'Falha na conexão';
      case 'STOPPED':
        return 'Parado';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !sessionInfo) {
    const isAdminDeleted = error?.includes('administrador');

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-4">
            {isAdminDeleted ? (
              <svg className="mx-auto h-12 w-12 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="mx-auto h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isAdminDeleted ? 'Sessão Removida' : 'Sessão não encontrada'}
          </h1>
          <p className="text-gray-600 mb-4">{error || 'Token inválido ou sessão inativa'}</p>
          {isAdminDeleted && (
            <div className="mt-4 p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-800">
                Esta sessão foi removida pelo administrador do sistema.
                Entre em contato para obter uma nova URL de conexão.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Conectar WhatsApp
          </h1>
          <p className="text-gray-600">
            Escaneie o QR Code com seu WhatsApp para conectar
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Session Info */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">Sessão:</span>
              <span className="text-sm font-mono text-gray-900">{sessionInfo.sessionId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(sessionInfo.status)}`}>
                {getStatusText(sessionInfo.status)}
              </span>
            </div>
          </div>

          {/* Stopped Status Warning */}
          {sessionInfo.status === 'STOPPED' && (
            <div className="mb-6">
              <div className="bg-primary bg-opacity-5 rounded-lg p-6 text-center">
                <svg className="mx-auto h-16 w-16 text-primary mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-primary mb-1">
                  Sessão Parada
                </h3>
                <p className="text-sm text-primary mb-3">
                  Esta sessão está parada. Clique em "Conectar" abaixo para iniciar e gerar o QR Code.
                </p>
              </div>
            </div>
          )}

          {/* QR Code Display */}
          {sessionInfo.status === 'SCAN_QR_CODE' && (
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center">
                {qrCode ? (
                  <>
                    <img
                      src={qrCode}
                      alt="QR Code"
                      className="w-64 h-64 mb-4"
                    />
                    <p className="text-sm text-gray-600 text-center">
                      Abra o WhatsApp no seu celular e escaneie este código
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      O código é atualizado automaticamente a cada 5 segundos
                    </p>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600">Gerando QR Code...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Connected Status */}
          {sessionInfo.status === 'WORKING' && (
            <div className="mb-6">
              <div className="bg-green-50 rounded-lg p-6 text-center">
                <svg className="mx-auto h-16 w-16 text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-green-900 mb-1">
                  WhatsApp Conectado!
                </h3>
                <p className="text-sm text-green-700">
                  Sua sessão está ativa e funcionando corretamente
                </p>
              </div>
            </div>
          )}

          {/* Failed Status */}
          {sessionInfo.status === 'FAILED' && (
            <div className="mb-6">
              <div className="bg-red-50 rounded-lg p-6 text-center">
                <svg className="mx-auto h-16 w-16 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-red-900 mb-1">
                  Falha na Conexão
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  Houve um problema ao conectar. Tente reiniciar a sessão.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleStart}
              disabled={actionLoading !== null || sessionInfo.status === 'WORKING'}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {actionLoading === 'start' ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Conectando...
                </span>
              ) : 'Conectar'}
            </button>

            <button
              onClick={handleRestart}
              disabled={actionLoading !== null}
              className="px-4 py-3 bg-primary text-white rounded-lg hover:bg-opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {actionLoading === 'restart' ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Reiniciando...
                </span>
              ) : 'Reiniciar'}
            </button>

            <button
              onClick={handleStop}
              disabled={actionLoading !== null || sessionInfo.status === 'STOPPED'}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {actionLoading === 'stop' ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Desconectando...
                </span>
              ) : 'Desconectar'}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-primary bg-opacity-5 rounded-lg">
            <h4 className="text-sm font-semibold text-primary mb-2">Como conectar:</h4>
            <ol className="text-sm text-primary space-y-1 list-decimal list-inside">
              <li>Clique em "Conectar" para gerar o QR Code</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Vá em Configurações → Aparelhos conectados</li>
              <li>Toque em "Conectar um aparelho"</li>
              <li>Aponte a câmera para o QR Code acima</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Esta página atualiza automaticamente a cada 5 segundos</p>
        </div>
      </div>
    </div>
  );
}
