import { useState } from 'react';
import { useApi }  from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { api }     from '../api/client';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import { Badge }   from '@/components/ui/badge';
import { LogOut, ChefHat, ArrowLeft, CheckCircle2 } from 'lucide-react';

function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

// ─── Tela: Lista de ordens pendentes ────────────────────────────────────────
function OrderList({ orders, onSelect }) {
  if (!orders?.length) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 opacity-30" />
        <p className="text-lg">Nenhuma ordem pendente</p>
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
          <p className="text-lg font-semibold text-foreground leading-tight">{order.product_name}</p>
          <p className="text-sm text-muted-foreground mt-1">{fmtDate(order.production_date)}</p>
          {order.planned_qty && (
            <p className="text-sm text-muted-foreground">Planejado: {order.planned_qty} {order.unit}</p>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Tela: Formulário de registro de etapa ───────────────────────────────────
function StepForm({ order, stages, onBack, onSaved }) {
  const [form, setForm] = useState({ stage_id: '', started_at: '', finished_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  async function handleSave() {
    if (!form.stage_id || !form.started_at || !form.finished_at)
      return setError('Preencha etapa, início e fim.');
    setSaving(true);
    setError(null);
    try {
      await api.post(`/orders/${order.id}/steps`, {
        stage_id:    Number(form.stage_id),
        started_at:  form.started_at,
        finished_at: form.finished_at,
      });
      await api.put(`/orders/${order.id}`, { status: 'Em Andamento' });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col gap-5">
      {/* Cabeçalho da ordem */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xl font-bold text-foreground">{order.product_name}</p>
        <p className="text-muted-foreground mt-1">{fmtDate(order.production_date)}</p>
      </div>

      {/* Formulário */}
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-5">
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

// ─── Tela: Confirmação de sucesso ────────────────────────────────────────────
function SuccessScreen({ onBack }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5">
      <CheckCircle2 className="h-20 w-20 text-primary" />
      <p className="text-2xl font-bold text-foreground">Registrado!</p>
      <p className="text-muted-foreground text-center">Etapa salva com sucesso.</p>
      <Button onClick={onBack} size="lg" variant="outline" className="rounded-xl px-8">
        Voltar às ordens
      </Button>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function Tablet() {
  const { user, logout } = useAuth();
  const { data: allOrders, refetch } = useApi('/orders?status=Pendente');
  const { data: stages }             = useApi('/stages?legacy=false');

  const [selected, setSelected] = useState(null);
  const [saved,    setSaved]    = useState(false);

  const orders = allOrders || [];

  function handleSaved() {
    setSaved(true);
  }

  function handleBack() {
    setSelected(null);
    setSaved(false);
    refetch?.();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          {selected && !saved ? (
            <button onClick={() => setSelected(null)} className="text-muted-foreground p-1">
              <ArrowLeft className="h-6 w-6" />
            </button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ChefHat className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground text-base leading-none">
              {selected && !saved ? 'Registrar Etapa' : 'Produção'}
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
        {saved ? (
          <SuccessScreen onBack={handleBack} />
        ) : selected ? (
          <StepForm
            order={selected}
            stages={stages}
            onBack={() => setSelected(null)}
            onSaved={handleSaved}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-foreground">Ordens Pendentes</h1>
              <Badge variant="secondary">{orders.length}</Badge>
            </div>
            <OrderList orders={orders} onSelect={setSelected} />
          </>
        )}
      </div>
    </div>
  );
}
