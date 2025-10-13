import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api } from '../services/api';
import { Settings as SettingsType } from '../types';
import toast from 'react-hot-toast';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SettingsType>({
    waha_host: '',
    waha_api_key: '',
    quepasa_url: '',
    quepasa_user: '',
    quepasa_password: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [hasQuepasaPassword, setHasQuepasaPassword] = useState(false);
  const [isEditingQuepasaPassword, setIsEditingQuepasaPassword] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const data = await api.getSettings();

      // Check if api_key exists (backend returns empty string for security)
      const keyExists = !!data.waha_host && data.waha_api_key === '';
      setHasApiKey(keyExists);

      // Check if quepasa password exists
      const quepasaPasswordExists = !!data.quepasa_url && data.quepasa_password === '';
      setHasQuepasaPassword(quepasaPasswordExists);

      // Show placeholder bullets if keys exist
      const maskedSettings = { ...data };
      if (keyExists) {
        maskedSettings.waha_api_key = '••••••••••••••••';
      }
      if (quepasaPasswordExists) {
        maskedSettings.quepasa_password = '••••••••••••••••';
      }

      setSettings(maskedSettings);
      setIsEditingApiKey(false);
      setIsEditingQuepasaPassword(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao carregar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      // Only send fields that have values (don't send empty strings to preserve existing values)
      const settingsToSave: Partial<SettingsType> = {};

      // Waha fields
      if (settings.waha_host) settingsToSave.waha_host = settings.waha_host;
      if (settings.waha_api_key && settings.waha_api_key !== '••••••••••••••••' && isEditingApiKey) {
        settingsToSave.waha_api_key = settings.waha_api_key;
      }

      // Quepasa fields
      if (settings.quepasa_url) settingsToSave.quepasa_url = settings.quepasa_url;
      if (settings.quepasa_user) settingsToSave.quepasa_user = settings.quepasa_user;
      if (settings.quepasa_password && settings.quepasa_password !== '••••••••••••••••' && isEditingQuepasaPassword) {
        settingsToSave.quepasa_password = settings.quepasa_password;
      }

      await api.updateSettings(settingsToSave as SettingsType);
      toast.success('Configurações salvas com sucesso');

      // Update flags if we just saved passwords
      if (settingsToSave.waha_api_key) {
        setHasApiKey(true);
      }
      if (settingsToSave.quepasa_password) {
        setHasQuepasaPassword(true);
      }

      // Reload to show placeholder bullets again
      await loadSettings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof SettingsType, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleApiKeyFocus = () => {
    // Clear placeholder when user focuses on the field
    if (hasApiKey && settings.waha_api_key === '••••••••••••••••') {
      setSettings((prev) => ({ ...prev, waha_api_key: '' }));
    }
    setIsEditingApiKey(true);
  };

  const handleQuepasaPasswordFocus = () => {
    // Clear placeholder when user focuses on the field
    if (hasQuepasaPassword && settings.quepasa_password === '••••••••••••••••') {
      setSettings((prev) => ({ ...prev, quepasa_password: '' }));
    }
    setIsEditingQuepasaPassword(true);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-1">Configure sua conexão Waha</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Waha Settings */}
          <Card title="Configuração Waha">
            <div className="space-y-4">
              <div>
                <label htmlFor="waha_host" className="block text-sm font-medium text-gray-700 mb-2">
                  Host Waha
                </label>
                <input
                  id="waha_host"
                  type="url"
                  value={settings.waha_host}
                  onChange={(e) => handleChange('waha_host', e.target.value)}
                  placeholder="https://waha.example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label htmlFor="waha_api_key" className="block text-sm font-medium text-gray-700 mb-2">
                  Chave API Waha
                  {hasApiKey && (
                    <span className="ml-2 text-xs text-green-600 font-normal">
                      ✓ Salva (oculta por segurança)
                    </span>
                  )}
                </label>
                <input
                  id="waha_api_key"
                  type="password"
                  value={settings.waha_api_key}
                  onChange={(e) => handleChange('waha_api_key', e.target.value)}
                  onFocus={handleApiKeyFocus}
                  placeholder={!hasApiKey || (hasApiKey && settings.waha_api_key === '') ? "Digite a Chave API Waha" : ""}
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {hasApiKey
                    ? "Chave API salva. Deixe vazio para mantê-la, ou digite uma nova para atualizar."
                    : "Digite sua Chave API Waha"}
                </p>
              </div>
            </div>
          </Card>

          {/* Quepasa Settings */}
          <Card title="Configuração Quepasa">
            <div className="space-y-4">
              <div>
                <label htmlFor="quepasa_url" className="block text-sm font-medium text-gray-700 mb-2">
                  URL Base Quepasa
                </label>
                <input
                  id="quepasa_url"
                  type="url"
                  value={settings.quepasa_url || ''}
                  onChange={(e) => handleChange('quepasa_url', e.target.value)}
                  placeholder="https://quepasa.example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                />
                <p className="mt-1 text-sm text-gray-500">
                  URL base da sua instância Quepasa (sem barra no final)
                </p>
              </div>

              <div>
                <label htmlFor="quepasa_user" className="block text-sm font-medium text-gray-700 mb-2">
                  Usuário Quepasa (E-mail)
                </label>
                <input
                  id="quepasa_user"
                  type="email"
                  value={settings.quepasa_user || ''}
                  onChange={(e) => handleChange('quepasa_user', e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                />
                <p className="mt-1 text-sm text-gray-500">
                  E-mail da conta Quepasa responsável pela conexão
                </p>
              </div>

              <div>
                <label htmlFor="quepasa_password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha Quepasa
                  {hasQuepasaPassword && (
                    <span className="ml-2 text-xs text-green-600 font-normal">
                      ✓ Salva (oculta por segurança)
                    </span>
                  )}
                </label>
                <input
                  id="quepasa_password"
                  type="password"
                  value={settings.quepasa_password || ''}
                  onChange={(e) => handleChange('quepasa_password', e.target.value)}
                  onFocus={handleQuepasaPasswordFocus}
                  placeholder={!hasQuepasaPassword || (hasQuepasaPassword && settings.quepasa_password === '') ? "Digite a Senha Quepasa" : ""}
                  autoComplete="off"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {hasQuepasaPassword
                    ? "Senha salva. Deixe vazio para mantê-la, ou digite uma nova para atualizar."
                    : "Senha da conta Quepasa (X-QUEPASA-PASSWORD)"}
                </p>
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" isLoading={isSaving} size="lg">
              <Save className="w-5 h-5 mr-2" />
              Salvar Configurações
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};
