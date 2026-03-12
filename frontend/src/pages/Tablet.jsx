import { useState, useEffect, useCallback } from 'react';
import { useApi }  from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { api }     from '../api/client';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import { Badge }   from '@/components/ui/badge';
import { LogOut, ChefHat, ArrowLeft, CheckCircle2, Clock } from 'lucide-react';

function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateTime(str) {
  if (!str) return '—';
  return str.replace('T', ' ').slice(0, 16);
}

function durationMin(start, end) {
  if (!start || !end) return null;
  const diff = (new Date(end) - new Date(start)) / 60000;
  return diff > 0 ? Math.round(diff) : null;
}

const statusVariant = { 'Pendente': 'secondary', 'Em Andamento': 'default', 'Concluído': 'outline' };

// ─── Tela: Lista de ordens ────────────────────────────────────────────────────
function OrderList({ orders, onSelect }) {
  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 opacity-30" />
        <p className="text-lg">Nenhuma ordem ativa</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-xl mx-auto">
      {orders.map(order => (
        <button
          key={order.id}
          onClick={() => onSelect(order)}
          className="w-full text-left bg-card border border-border rounded-2xl p-5 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-lg font-semibold text-foreground leading-tight">{order.product_name}</p>
            <Badge variant={statusVariant[order.status] ?? 'secondary'} className="shrink-0 text-xs">
              {order.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{fmtDate(order.production_date)}</p>
          {order.planned_qty && (
            <p className="text-sm text-muted-foreground">Planejado: {order.planned_qty} {order.unit}</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Tela: Detalhe da ordem + registrar etapas ────────────────────────────────
function OrderDetail({ orderId, stages, onBack }) {
  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ stage_id: '', started_at: '', finished_at: '' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/orders/${orderId}`);
      setOrder(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  async function handleSave() {
    if (!form.stage_id || !form.started_at || !form.finished_at)
      return setError('Preencha etapa, início e fim.');
    setSaving(true);
    setError(null);
    try {
      await api.post(`/orders/${orderId}/steps`, {
        stage_id:    Number(form.stage_id),
        started_at:  form.started_at,
        finished_at: form.finished_at,
      });
      // Muda para "Em Andamento" apenas se ainda estiver Pendente
      if (order?.status === 'Pendente') {
        await api.put(`/orders/${orderId}`, { status: 'Em Andamento' });
      }
      setForm({ stage_id: '', started_at: '', finished_at: '' });
      fetchOrder();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const steps = order?.steps ?? [];

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-4">
      {/* Cabeçalho da ordem */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xl font-bold text-foreground">{order?.product_name}</p>
          <Badge variant={statusVariant[order?.status] ?? 'secondary'} className="shrink-0">
            {order?.status}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">{fmtDate(order?.production_date)}</p>
        {order?.planned_qty && (
          <p className="text-sm text-muted-foreground">Planejado: {order.planned_qty} {order.unit}</p>
        )}
      </div>

      {/* Etapas já registradas */}
      {steps.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">Etapas registradas</p>
          {steps.map((step, i) => {
            const dur = durationMin(step.started_at, step.finished_at);
            return (
              <div key={step.id ?? i} className="flex items-start justify-between gap-2 text-sm border-t border-border pt-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium text-foreground">{step.stage_name}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {fmtDateTime(step.started_at)} → {fmtDateTime(step.finished_at)}
                  </p>
                </div>
                {dur && (
                  <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">{dur} min</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Formulário nova etapa */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
        <p className="text-sm font-semibold text-foreground">Registrar nova etapa</p>

        <div className="flex flex-col gap-2">
          <Label className="text-base">Etapa</Label>
          <select
            value={form.stage_id}
            onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}
            className="w-full border border-border rounded-xl px-4 py-3 text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecione…</option>
            {(stages || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-base">Início</Label>
          <Input
            type="datetime-local"
            value={form.started_at}
            onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))}
            className="py-3 text-base rounded-xl"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-base">Término</Label>
          <Input
            type="datetime-local"
            value={form.finished_at}
            onChange={e => setForm(f => ({ ...f, finished_at: e.target.value }))}
            className="py-3 text-base rounded-xl"
          />
        </div>

        {error && (
          <p className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <Button onClick={handleSave} disabled={saving} size="lg" className="rounded-xl text-base py-6">
          {saving ? 'Salvando…' : 'Registrar Etapa'}
        </Button>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Tablet() {
  const { user, logout } = useAuth();
  const { data: allOrders, refetch } = useApi('/orders?status=Pendente,Em+Andamento');
  const { data: stages }             = useApi('/stages?legacy=false');

  const [selectedId, setSelectedId] = useState(null);

  const orders = allOrders || [];

  function handleSelect(order) {
    setSelectedId(order.id);
  }

  function handleBack() {
    setSelectedId(null);
    refetch?.();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {selectedId ? (
            <button onClick={handleBack} className="text-muted-foreground p-1">
              <ArrowLeft className="h-6 w-6" />
            </button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ChefHat className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground text-base leading-none">
              {selectedId ? 'Detalhes da Ordem' : 'Produção'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{user?.name}</p>
          </div>
        </div>
        <button onClick={logout} className="text-muted-foreground p-2">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col p-5">
        {selectedId ? (
          <OrderDetail
            orderId={selectedId}
            stages={stages}
            onBack={handleBack}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-foreground">Ordens Ativas</h1>
              <Badge variant="secondary">{orders.length}</Badge>
            </div>
            <OrderList orders={orders} onSelect={handleSelect} />
          </>
        )}
      </div>
    </div>
  );
}
