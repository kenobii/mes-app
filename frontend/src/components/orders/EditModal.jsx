import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api }    from '../../api/client';

const today = new Date().toISOString().slice(0, 10);

export default function EditModal({ order, onClose, onSaved }) {
  const { data: products  } = useApi('/products');
  const { data: operators } = useApi('/operators');

  const [form, setForm] = useState({
    product_id:      order.product_id      ?? '',
    operator_id:     order.operator_id     ?? '',
    production_date: order.production_date ?? today,
    status:          order.status          ?? 'Pendente',
    planned_qty:     order.planned_qty     ?? '',
    produced_qty:    order.produced_qty    ?? '',
    notes:           order.notes           ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/orders/${order.id}`, {
        ...form,
        product_id:   form.product_id   ? Number(form.product_id)   : undefined,
        operator_id:  form.operator_id  ? Number(form.operator_id)  : null,
        planned_qty:  form.planned_qty  !== '' ? Number(form.planned_qty)  : null,
        produced_qty: form.produced_qty !== '' ? Number(form.produced_qty) : null,
      });
      onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Editar Ordem</h2>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="text-sm text-gray-600">Produto</span>
            <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm">
              <option value="">Selecione…</option>
              {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Usuário</span>
            <select value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm">
              <option value="">Sem usuário</option>
              {(operators || []).map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Data</span>
            <input type="date" value={form.production_date}
              onChange={e => setForm(f => ({ ...f, production_date: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Status</span>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm">
              {['Pendente','Em Andamento','Concluído','Cancelado'].map(s =>
                <option key={s}>{s}</option>
              )}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Planejado</span>
            <input type="number" step="0.001" value={form.planned_qty}
              onChange={e => setForm(f => ({ ...f, planned_qty: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Produzido</span>
            <input type="number" step="0.001" value={form.produced_qty}
              onChange={e => setForm(f => ({ ...f, produced_qty: e.target.value }))}
              className="mt-1 block w-full border rounded px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-gray-600">Observações</span>
          <textarea value={form.notes} rows={2}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="mt-1 block w-full border rounded px-3 py-2 text-sm resize-none" />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-sm disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
