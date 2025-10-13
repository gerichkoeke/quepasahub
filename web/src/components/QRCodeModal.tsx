import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface QRCodeModalProps {
  sessionId: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ sessionId, onClose }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('SCAN_QR_CODE');
  const [isConnected, setIsConnected] = useState(false);

  const loadQRCode = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const qrUrl = await api.getQRCode(sessionId);
      setQrCode(qrUrl);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load QR code');
      toast.error('Falha ao carregar QR code');
    } finally {
      setIsLoading(false);
    }
  };

  const checkSessionStatus = async () => {
    try {
      const session = await api.getSession(sessionId);

      setStatus(session.status);

      // Check if connected
      if (session.status === 'WORKING') {
        setIsConnected(true);
        toast.success('WhatsApp conectado com sucesso!');
        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      // Silently fail - don't show error toast
      console.error('Failed to check session status:', error);
    }
  };

  useEffect(() => {
    loadQRCode();
    checkSessionStatus();

    // Check status every 5 seconds
    const statusInterval = setInterval(checkSessionStatus, 5000);

    // Refresh QR code every 30 seconds (only if not connected)
    const qrInterval = setInterval(() => {
      if (!isConnected) {
        loadQRCode();
      }
    }, 30000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(qrInterval);
    };
  }, [sessionId, isConnected]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Escanear QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 text-center mb-2">
              Sessão: <span className="font-medium text-gray-900">{sessionId}</span>
            </p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  status === 'WORKING'
                    ? 'bg-green-100 text-green-800'
                    : status === 'SCAN_QR_CODE'
                    ? 'bg-primary bg-opacity-10 text-primary'
                    : status === 'STARTING'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {status === 'WORKING' ? 'Conectado' :
                 status === 'SCAN_QR_CODE' ? 'QR Code' :
                 status === 'STARTING' ? 'Iniciando' :
                 status === 'STOPPED' ? 'Pausado' :
                 status === 'FAILED' ? 'Falhou' : status}
              </span>
            </div>
            {!isConnected && (
              <p className="text-xs text-gray-500 text-center">
                Abra o WhatsApp no seu celular, vá em Configurações → Aparelhos conectados → Conectar aparelho
              </p>
            )}
          </div>

          <div className="flex items-center justify-center bg-white border-2 border-gray-200 rounded-lg p-8 min-h-[300px]">
            {isLoading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando QR code...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={loadQRCode}
                  className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar novamente
                </button>
              </div>
            )}

            {qrCode && !isLoading && (
              <div className="text-center">
                <img src={qrCode} alt="QR Code" className="max-w-full h-auto" />
                <button
                  onClick={loadQRCode}
                  className="mt-4 inline-flex items-center text-sm text-primary hover:text-primary"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Atualizar
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 bg-primary bg-opacity-5 rounded-lg p-4">
            <p className="text-sm text-primary">
              <strong>Dica:</strong> O QR code é atualizado automaticamente a cada 30 segundos ou clique
              no botão Atualizar para obter um novo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
