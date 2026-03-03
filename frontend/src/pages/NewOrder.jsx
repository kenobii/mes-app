import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi }      from '../hooks/useApi';
import { api }         from '../api/client';

const today = new Date().toISOString().slice(0, 10);

function StepRow({ step, stages, onRemove }) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {stages.find(s => s.id === step.stage_id)?.name || 'Etapa'}
        </span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs">remover</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <span>Início: {step.started_at || '—'}</span>
        <span>Fim: {step.finished_at || '—'}</span>
      </div>
      {step.pauses?.length > 0 && (
        <div className="text-xs text-gray-400">
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
      <h1 className="text-xl font-bold text-gray-800">Nova Ordem de Produção</h1>

      {error && <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">{error}</p>}

      {/* Dados da ordem */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Dados da Ordem</h2>

        <label className="block">
          <span className="text-sm text-gray-600">Produto *</span>
          <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
            className="mt-1 block w-full border rounded px-3 py-2 text-sm" required>
            <option value="">Selecione…</option>
            {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-600">Usuário</span>
            <select value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm">
              <option value="">Sem usuário</option>
              {(operators || []).map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">Data *</span>
            <input type="date" value={form.production_date}
              onChange={e => setForm(f => ({ ...f, production_date: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm" required />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-gray-600">Quantidade Planejada (kg)</span>
          <input type="number" step="0.001" value={form.planned_qty}
            onChange={e => setForm(f => ({ ...f, planned_qty: e.target.value }))}
            className="mt-1 block w-full border rounded px-3 py-2 text-sm" />
        </label>
      </div>

      {/* Etapas */}
      <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Etapas</h2>

        <div className="grid grid-cols-3 gap-3">
          <select value={stepForm.stage_id} onChange={e => setStepForm(f => ({ ...f, stage_id: e.target.value }))}
            className="border rounded px-2 py-1.5 text-sm col-span-3">
            <option value="">Selecione a etapa…</option>
            {(stages || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="col-span-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">Início</span>
              <input type="datetime-local" value={stepForm.started_at}
                onChange={e => setStepForm(f => ({ ...f, started_at: e.target.value }))}
                className="mt-1 block w-full border rounded px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Término</span>
              <input type="datetime-local" value={stepForm.finished_at}
                onChange={e => setStepForm(f => ({ ...f, finished_at: e.target.value }))}
                className="mt-1 block w-full border rounded px-2 py-1.5 text-sm" />
            </label>
          </div>
          {stepForm.started_at && stepForm.finished_at && (
            <div className="col-span-3 text-xs text-brand-600 font-medium">
              Tempo bruto: {
                Math.round((new Date(stepForm.finished_at) - new Date(stepForm.started_at)) / 6000) / 10
              } min
            </div>
          )}
          <button type="button" onClick={addStep}
            className="col-span-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded px-3 py-1.5">
            + Adicionar Etapa
          </button>
        </div>

        <div className="space-y-2">
          {steps.map(step => (
            <div key={step.id}>
              <StepRow step={step} stages={stages || []} onRemove={() => setSteps(s => s.filter(x => x.id !== step.id))} />
              <button type="button" onClick={() => setPauseStep(step.id)}
                className="mt-1 text-xs text-blue-500 hover:text-blue-700 ml-2">
                + Registrar pausa nesta etapa
              </button>
              {pauseStep === step.id && (
                <div className="mt-2 ml-4 grid grid-cols-2 gap-2 bg-blue-50 rounded p-2">
                  <label className="block">
                    <span className="text-xs text-gray-500">Pausa em</span>
                    <input type="datetime-local" value={pauseForm.paused_at}
                      onChange={e => setPauseForm(f => ({ ...f, paused_at: e.target.value }))}
                      className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-gray-500">Retorno em</span>
                    <input type="datetime-local" value={pauseForm.resumed_at}
                      onChange={e => setPauseForm(f => ({ ...f, resumed_at: e.target.value }))}
                      className="mt-1 block w-full border rounded px-2 py-1 text-xs" />
                  </label>
                  <button type="button" onClick={() => addPause(step.id)}
                    className="col-span-2 bg-blue-500 text-white text-xs rounded px-2 py-1">
                    Confirmar Pausa
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <button type="submit" disabled={saving}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl">
        {saving ? 'Salvando…' : 'Salvar Ordem'}
      </button>
    </form>
  );
}
