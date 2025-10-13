import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, Settings, Eye, EyeOff } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { api } from '../services/api';
import { QuepasaMapping, CreateQuepasaMappingRequest } from '../types';
import toast from 'react-hot-toast';

export const QuepasaMappings: React.FC = () => {
  const [mappings, setMappings] = useState<QuepasaMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<QuepasaMapping | null>(null);
  const [setupMapping, setSetupMapping] = useState<QuepasaMapping | null>(null);
  const [setupInboxName, setSetupInboxName] = useState('');
  const [showApiToken, setShowApiToken] = useState(false);
  const [formData, setFormData] = useState<CreateQuepasaMappingRequest>({
    phoneNumber: '',
    name: '',
    chatwootBaseUrl: '',
    chatwootApiToken: '',
    chatwootAccountId: '',
    chatwootInboxName: '',
    maxMessageAgeMinutes: 5,
    active: true,
  });

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setIsLoading(true);
      const data = await api.getQuepasaMappings();
      setMappings(data);
    } catch (error: any) {
      toast.error('Falha ao carregar mapeamentos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (mapping?: QuepasaMapping) => {
    if (mapping) {
      setEditingMapping(mapping);
      setFormData({
        phoneNumber: mapping.phoneNumber || '',
        name: mapping.name || '',
        chatwootBaseUrl: mapping.chatwootBaseUrl,
        chatwootApiToken: '••••••••••••••', // Placeholder to show token exists
        chatwootAccountId: mapping.chatwootAccountId,
        chatwootInboxName: mapping.chatwootInboxName || '',
        maxMessageAgeMinutes: mapping.maxMessageAgeMinutes || 5,
        active: mapping.active,
      });
    } else {
      setEditingMapping(null);
      setFormData({
        phoneNumber: '',
        name: '',
        chatwootBaseUrl: '',
        chatwootApiToken: '',
        chatwootAccountId: '',
        chatwootInboxName: '',
        maxMessageAgeMinutes: 5,
        active: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMapping(null);
    setShowApiToken(false); // Reset visibility when closing modal
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMapping) {
        // Only send token if it's been changed (not the placeholder)
        const updateData: Partial<CreateQuepasaMappingRequest> = {
          phoneNumber: formData.phoneNumber,
          name: formData.name,
          chatwootBaseUrl: formData.chatwootBaseUrl,
          chatwootAccountId: formData.chatwootAccountId,
          chatwootInboxName: formData.chatwootInboxName,
          maxMessageAgeMinutes: formData.maxMessageAgeMinutes,
          active: formData.active,
        };
        if (formData.chatwootApiToken && formData.chatwootApiToken !== '••••••••••••••') {
          updateData.chatwootApiToken = formData.chatwootApiToken;
        }
        await api.updateQuepasaMapping(editingMapping.id, updateData);
        toast.success('Mapeamento atualizado');
      } else {
        await api.createQuepasaMapping(formData);
        toast.success('Mapeamento criado');
      }
      handleCloseModal();
      loadMappings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Falha ao salvar mapeamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este mapeamento?')) return;
    try {
      await api.deleteQuepasaMapping(id);
      toast.success('Mapeamento excluído');
      loadMappings();
    } catch (error: any) {
      toast.error('Falha ao excluir mapeamento');
    }
  };

  const handleOpenSetupModal = (mapping: QuepasaMapping) => {
    if (!mapping.phoneNumber) {
      toast.error('É necessário escanear o QR Code primeiro para conectar o Quepasa');
      return;
    }

    setSetupMapping(mapping);
    setSetupInboxName(mapping.chatwootInboxName || '');
    setShowSetupModal(true);
  };

  const handleCloseSetupModal = () => {
    setShowSetupModal(false);
    setSetupMapping(null);
    setSetupInboxName('');
  };

  const handleConfirmSetup = async () => {
    if (!setupMapping) return;

    try {
      // First update the mapping with the inbox name if changed
      if (setupInboxName !== setupMapping.chatwootInboxName) {
        await api.updateQuepasaMapping(setupMapping.id, {
          chatwootInboxName: setupInboxName || undefined,
        });
      }

      toast.loading('Configurando integração...', { id: 'setup' });
      await api.setupQuepasaChatwootIntegration(setupMapping.id);
      toast.success('Integração Chatwoot configurada com sucesso!', { id: 'setup' });
      handleCloseSetupModal();
      loadMappings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Falha ao configurar integração', { id: 'setup' });
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quepasa → Chatwoot</h1>
            <p className="text-gray-600 mt-1">Gerencie integrações Quepasa-Chatwoot</p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Mapeamento
          </Button>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone Quepasa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chatwoot URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inbox ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Nenhum mapeamento configurado
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{mapping.phoneNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{mapping.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{mapping.chatwootBaseUrl}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{mapping.chatwootInboxId}</td>
                      <td className="px-6 py-4">
                        {mapping.active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Check className="w-3 h-3 mr-1" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <X className="w-3 h-3 mr-1" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenModal(mapping)}
                          className="text-primary hover:text-primary"
                          title="Editar mapeamento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenSetupModal(mapping)}
                          className="text-green-600 hover:text-green-800"
                          title="Configurar integração Chatwoot"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Excluir mapeamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Modal
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingMapping ? 'Editar Mapeamento' : 'Novo Mapeamento'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone Quepasa *
              </label>
              <input
                type="text"
                required
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="5561996878959"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="mt-1 text-xs text-gray-500">Número do WhatsApp Business conectado ao Quepasa</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome (Opcional)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Meu Atendimento"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chatwoot URL *
              </label>
              <input
                type="url"
                required
                value={formData.chatwootBaseUrl}
                onChange={(e) => setFormData({ ...formData, chatwootBaseUrl: e.target.value })}
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
                  type={showApiToken ? "text" : "password"}
                  required={!editingMapping}
                  value={formData.chatwootApiToken}
                  onChange={(e) => setFormData({ ...formData, chatwootApiToken: e.target.value })}
                  placeholder={editingMapping ? "Deixe vazio para manter" : "Token de acesso"}
                  className="w-full px-3 py-2 pr-10 border rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowApiToken(!showApiToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showApiToken ? "Ocultar token" : "Mostrar token"}
                >
                  {showApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                value={formData.chatwootAccountId}
                onChange={(e) => setFormData({ ...formData, chatwootAccountId: e.target.value })}
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
                value={formData.chatwootInboxName || ''}
                onChange={(e) => setFormData({ ...formData, chatwootInboxName: e.target.value })}
                placeholder="Atendimento WhatsApp"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="mt-1 text-xs text-gray-500">Nome customizado para a caixa de entrada no Chatwoot (se não informado, usa o nome do mapeamento)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Idade Máxima de Mensagem (minutos)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                required
                value={formData.maxMessageAgeMinutes || 5}
                onChange={(e) => setFormData({ ...formData, maxMessageAgeMinutes: parseInt(e.target.value) || 5 })}
                placeholder="5"
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="mt-1 text-xs text-gray-500">
                Mensagens mais antigas que este tempo serão ignoradas (útil para evitar criar conversas de sincronização quando conecta o WhatsApp)
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="active" className="text-sm text-gray-700">Ativo</label>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="secondary" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary">
                {editingMapping ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          isOpen={showSetupModal}
          onClose={handleCloseSetupModal}
          title="Configurar Integração Chatwoot"
        >
          <div className="space-y-4">
            <div className="bg-primary bg-opacity-5 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-primary font-medium mb-2">
                Esta ação irá:
              </p>
              <ul className="text-sm text-primary list-disc list-inside space-y-1">
                <li>Criar uma inbox no Chatwoot com o nome especificado</li>
                <li>Configurar webhook no Quepasa</li>
                <li>Configurar webhook no Chatwoot</li>
              </ul>
            </div>

            {setupMapping && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mapeamento
                  </label>
                  <input
                    type="text"
                    value={`${setupMapping.name} (${setupMapping.phoneNumber})`}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Caixa no Chatwoot
                  </label>
                  <input
                    type="text"
                    value={setupInboxName}
                    onChange={(e) => setSetupInboxName(e.target.value)}
                    placeholder={`Quepasa - ${setupMapping.name} (${setupMapping.phoneNumber})`}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Deixe vazio para usar o nome padrão: Quepasa - {setupMapping.name} ({setupMapping.phoneNumber})
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="secondary" onClick={handleCloseSetupModal}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" onClick={handleConfirmSetup}>
                Configurar Integração
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
};
