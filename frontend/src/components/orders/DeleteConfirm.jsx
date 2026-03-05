import { useState } from 'react';
import { api } from '../../api/client';

export default function DeleteConfirm({ order, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/orders/${order.id}`);
      onDeleted();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-800">Excluir Ordem</h2>
        <p className="text-sm text-gray-600">
          Tem certeza que deseja excluir a ordem de <strong>{order.product_name}</strong> em{' '}
          <strong>{order.production_date}</strong>? Esta ação não pode ser desfeita.
        </p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50">
            {deleting ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
