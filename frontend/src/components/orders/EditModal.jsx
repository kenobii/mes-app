import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api }    from '../../api/client';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

const today = new Date().toISOString().slice(0, 10);

const selectCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-base font-semibold text-foreground">Editar Ordem</h2>

        {error && <p className="text-destructive text-sm bg-destructive/10 rounded px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Produto</Label>
            <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={selectCls}>
              <option value="">Selecione…</option>
              {(products || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Usuário</Label>
            <select value={form.operator_id} onChange={e => setForm(f => ({ ...f, operator_id: e.target.value }))} className={selectCls}>
              <option value="">Sem usuário</option>
              {(operators || []).map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" value={form.production_date}
              onChange={e => setForm(f => ({ ...f, production_date: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={selectCls}>
              {['Pendente','Em Andamento','Concluído','Cancelado'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Planejado</Label>
            <Input type="number" step="0.001" value={form.planned_qty}
              onChange={e => setForm(f => ({ ...f, planned_qty: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label>Produzido</Label>
            <Input type="number" step="0.001" value={form.produced_qty}
              onChange={e => setForm(f => ({ ...f, produced_qty: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Observações</Label>
          <textarea value={form.notes} rows={2}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
