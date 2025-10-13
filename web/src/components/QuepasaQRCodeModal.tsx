import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Check } from 'lucide-react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface QuepasaQRCodeModalProps {
  mappingId: string;
  onClose: () => void;
  onConnected?: () => void;
}

export const QuepasaQRCodeModal: React.FC<QuepasaQRCodeModalProps> = ({ mappingId, onClose, onConnected }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  const loadQRCode = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const qrUrl = await api.getQuepasaQRCode(mappingId);
      setQrCode(qrUrl);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Falha ao carregar QR code';
      setError(errorMessage);

      // Don't show toast if Quepasa is not configured
      if (!errorMessage.includes('não configurado') && !errorMessage.includes('not configured')) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkStatus = async () => {
    try {
      const statusData = await api.getQuepasaStatus(mappingId);

      setStatus(statusData.status || '');

      // Check if connected (status === 'ready' - case insensitive)
      if (statusData.success && statusData.status?.toLowerCase() === 'ready') {
        setIsConnected(true);
        toast.success('Quepasa conectado com sucesso!');

        // Fetch connection info to update phone number in database
        try {
          await api.getQuepasaInfo(mappingId);
        } catch (infoError) {
          console.error('[QuepasaQRCode] Failed to fetch connection info:', infoError);
        }

        // Call onConnected callback if provided
        if (onConnected) {
          onConnected();
        }

        // Close modal after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      // Silently fail - don't show error toast for status checks
      console.error('[QuepasaQRCode] Failed to check status:', error);
    }
  };

  useEffect(() => {
    loadQRCode();
    checkStatus();

    // Check status every 5 seconds
    const statusInterval = setInterval(checkStatus, 5000);

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
  }, [isConnected]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-gray-900">Conectar Quepasa</h2>
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
              Quepasa
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            {status && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    status.toLowerCase() === 'ready'
                      ? 'bg-green-100 text-green-800'
                      : status.toLowerCase() === 'connecting'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {isConnected && <Check className="w-3 h-3 inline mr-1" />}
                  {status.toLowerCase() === 'ready' ? 'Conectado' :
                   status.toLowerCase() === 'connecting' ? 'Conectando...' :
                   status}
                </span>
              </div>
            )}
            {!isConnected && (
              <p className="text-xs text-gray-500 text-center">
                Abra o WhatsApp no seu celular, vá em Configurações → Aparelhos conectados → Conectar aparelho
              </p>
            )}
          </div>

          <div className="flex items-center justify-center bg-white border-2 border-gray-200 rounded-lg p-8 min-h-[300px]">
            {isLoading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando QR code...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={loadQRCode}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar novamente
                </button>
              </div>
            )}

            {qrCode && !isLoading && !error && (
              <div className="text-center">
                <img src={qrCode} alt="QR Code Quepasa" className="max-w-full h-auto rounded-lg" />
                <button
                  onClick={loadQRCode}
                  className="mt-4 inline-flex items-center text-sm text-purple-600 hover:text-purple-700"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Atualizar
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>Importante:</strong> O QR code do Quepasa é atualizado automaticamente.
              Após escanear, aguarde a confirmação de conexão.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
