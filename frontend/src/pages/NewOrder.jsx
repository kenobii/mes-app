import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi }      from '../hooks/useApi';
import { api }         from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';

const today = new Date().toISOString().slice(0, 10);

function StepRow({ step, stages, onRemove }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {stages.find(s => s.id === step.stage_id)?.name || 'Etapa'}
        </span>
        <button onClick={onRemove} className="text-destructive hover:text-destructive/80 text-xs">remover</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>Início: {step.started_at || '—'}</span>
        <span>Fim: {step.finished_at || '—'}</span>
      </div>
      {step.pauses?.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {step.pauses.length} pausa(s): {step.pauses.reduce((a, p) => a + (p.duration_minutes || 0), 0).toFixed(1)} min
        </div>
      )}
    </div>
  );
}

export default function NewOrder() {
  const navigate = useNavigate();
  const { data: products  } = useApi('/products');
  const { data: operators } = useApi('/operators');
  const { data: stages    } = useApi('/stages?legacy=false');

  const [form, setForm] = useState({
    product_id: '', operator_id: '', production_date: today, planned_qty: '',
  });
  const [steps, setSteps]         = useState([]);
  const [stepForm, setStepForm]   = useState({ stage_id: '', started_at: '', finished_at: '' });
  const [pauseStep, setPauseStep] = useState(null);
  const [pauseForm, setPauseForm] = useState({ paused_at: '', resumed_at: '' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  function addStep() {
    if (!stepForm.stage_id) return;
    const gross = (stepForm.started_at && stepForm.finished_at)
      ? Math.round((new Date(stepForm.finished_at) - new Date(stepForm.started_at)) / 6000) / 10
      : null;
    setSteps(prev => [...prev, { ...stepForm, id: Date.now(), pauses: [], gross_time_minutes: gross }]);
    setStepForm({ stage_id: '', started_at: '', finished_at: '' });
  }

  function addPause(stepId) {
    if (!pauseForm.paused_at) return;
    const dur = (pauseForm.paused_at && pauseForm.resumed_at)
      ? Math.round((new Date(pauseForm.resumed_at) - new Date(pauseForm.paused_at)) / 6000) / 10
      : null;
    setSteps(prev => prev.map(s =>
      s.id === stepId
        ? { ...s, pauses: [...s.pauses, { ...pauseForm, duration_minutes: dur }] }
        : s
    ));
    setPauseStep(null);
    setPauseForm({ paused_at: '', resumed_at: '' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product_id || !form.production_date)
      return setError('Produto e Data são obrigatórios.');
    setSaving(true);
    setError(null);
    try {
      const order = await api.post('/orders', {
        ...form,
        product_id:  Number(form.product_id),
        operator_id: form.operator_id ? Number(form.operator_id) : undefined,
        planned_qty: form.planned_qty  ? Number(form.planned_qty)  : undefined,
      });

      for (const step of steps) {
        const created = await api.post(`/orders/${order.id}/steps`, {
          stage_id: Number(step.stage_id),
          started_at:  step.started_at  || undefined,
          finished_at: step.finished_at || undefined,
        });
        for (const pause of step.pauses) {
          await api.post(`/orders/steps/${created.id}/pauses`, pause);
        }
      }

      navigate('/orders');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-foreground">Nova Ordem de Produção</h1>

      {error && (
        <p className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Dados da ordem */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Dados da Ordem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Produto *</Label>
            <select value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              required>
              <option value="">Selecione…</option>
              {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Usuário</Label>
              <select value={form.operator_id}
                onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Sem usuário</option>
                {(operators || []).map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={form.production_date}
                onChange={e => setForm(f => ({ ...f, production_date: e.target.value }))}
                required />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Quantidade Planejada (kg)</Label>
            <Input type="number" step="0.001" value={form.planned_qty}
              onChange={e => setForm(f => ({ ...f, planned_qty: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Etapas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Etapas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <select value={stepForm.stage_id}
              onChange={e => setStepForm(f => ({ ...f, stage_id: e.target.value }))}
              className="col-span-3 border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Selecione a etapa…</option>
              {(stages || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div className="col-span-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Início</Label>
                <Input type="datetime-local" value={stepForm.started_at}
                  onChange={e => setStepForm(f => ({ ...f, started_at: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Término</Label>
                <Input type="datetime-local" value={stepForm.finished_at}
                  onChange={e => setStepForm(f => ({ ...f, finished_at: e.target.value }))} />
              </div>
            </div>

            {stepForm.started_at && stepForm.finished_at && (
              <div className="col-span-3 text-xs text-brand-400 font-medium">
                Tempo bruto: {
                  Math.round((new Date(stepForm.finished_at) - new Date(stepForm.started_at)) / 6000) / 10
                } min
              </div>
            )}

            <Button type="button" variant="outline" onClick={addStep} className="col-span-3">
              + Adicionar Etapa
            </Button>
          </div>

          <div className="space-y-2">
            {steps.map(step => (
              <div key={step.id}>
                <StepRow step={step} stages={stages || []} onRemove={() => setSteps(s => s.filter(x => x.id !== step.id))} />
                <button type="button" onClick={() => setPauseStep(step.id)}
                  className="mt-1 text-xs text-primary hover:text-primary/80 ml-2">
                  + Registrar pausa nesta etapa
                </button>
                {pauseStep === step.id && (
                  <div className="mt-2 ml-4 grid grid-cols-2 gap-2 bg-muted/40 border border-border rounded p-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Pausa em</Label>
                      <Input type="datetime-local" value={pauseForm.paused_at}
                        onChange={e => setPauseForm(f => ({ ...f, paused_at: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Retorno em</Label>
                      <Input type="datetime-local" value={pauseForm.resumed_at}
                        onChange={e => setPauseForm(f => ({ ...f, resumed_at: e.target.value }))} />
                    </div>
                    <Button type="button" onClick={() => addPause(step.id)} className="col-span-2" size="sm">
                      Confirmar Pausa
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Salvando…' : 'Salvar Ordem'}
      </Button>
    </form>
  );
}
