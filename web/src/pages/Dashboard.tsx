import React, { useEffect, useState } from 'react';
import { Activity, MessageSquare, Link2, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { api } from '../services/api';
import { Metrics } from '../types';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMetrics();
      setMetrics(data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao carregar métricas');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    {
      name: 'Total de Sessões',
      value: metrics?.total_sessions || 0,
      icon: MessageSquare,
      color: 'bg-primary bg-opacity-50',
    },
    {
      name: 'Integrações Ativas',
      value: metrics?.active_integrations || 0,
      icon: Link2,
      color: 'bg-green-500',
    },
    {
      name: 'Mensagens Processadas',
      value: metrics?.messages_processed || 0,
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      name: 'Eventos Recentes',
      value: metrics?.recent_activity?.length || 0,
      icon: Activity,
      color: 'bg-orange-500',
    },
  ];

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR');
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Visão geral das suas integrações Waha-Typebot</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.name}>
                <div className="flex items-center">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card title="Atividade Recente">
            {!metrics?.recent_activity || metrics.recent_activity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nenhuma atividade recente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.recent_activity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {activity.event_type.includes('Entrada') ? (
                          <ArrowDown className="w-4 h-4 text-primary" />
                        ) : (
                          <ArrowUp className="w-4 h-4 text-green-600" />
                        )}
                        <p className="text-sm font-medium text-gray-900">{activity.event_type}</p>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 ml-6">
                        Sessão: {activity.session_name}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {formatTimestamp(activity.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top Sessions */}
          <Card title="Sessões Mais Ativas">
            {!metrics?.topSessions || metrics.topSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nenhuma sessão ativa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics.topSessions.map((session, index) => (
                  <div
                    key={session.sessionId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary bg-opacity-10 text-primary rounded-full font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{session.sessionId}</p>
                        <p className="text-xs text-gray-600">
                          {session.eventCount} {session.eventCount === 1 ? 'evento' : 'eventos'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${(session.eventCount / metrics.topSessions[0].eventCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <Card title="Ações Rápidas">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/sessions"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary hover:bg-primary bg-opacity-5 transition-colors text-center"
            >
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="font-medium text-gray-900">Gerenciar Sessões</p>
            </a>
            <a
              href="/logs"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
            >
              <Activity className="w-8 h-8 mx-auto mb-2 text-purple-600" />
              <p className="font-medium text-gray-900">Ver Logs</p>
            </a>
            <a
              href="/settings"
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
            >
              <Link2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="font-medium text-gray-900">Configurar Sistema</p>
            </a>
          </div>
        </Card>
      </div>
    </Layout>
  );
};
