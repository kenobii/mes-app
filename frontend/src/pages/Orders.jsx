import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../utils/format';
import EditModal    from '../components/orders/EditModal';
import DeleteConfirm from '../components/orders/DeleteConfirm';

const today    = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

const statusColor = {
  'Concluído':    'bg-green-100 text-green-800',
  'Em Andamento': 'bg-blue-100 text-blue-800',
  'Pendente':     'bg-yellow-100 text-yellow-800',
  'Cancelado':    'bg-red-100 text-red-800',
};

const COLUMNS = [
  { label: 'Data',       key: 'production_date'   },
  { label: 'Produto',    key: 'product_name'      },
  { label: 'Usuário',    key: 'operator_name'     },
  { label: 'Planejado',  key: 'planned_qty'       },
  { label: 'Produzido',  key: 'produced_qty'      },
  { label: 'Eficiência', key: 'efficiency_pct'    },
  { label: 'Tempo Líq.', key: 'total_net_minutes' },
  { label: 'Status',     key: 'status'            },
  { label: '',           key: null                },
];

function applySort(arr, key, dir) {
  if (!key) return arr;
  return [...arr].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function exportCSV(rows) {
  const headers = ['Data','Produto','Usuário','Planejado','Unidade','Produzido','Eficiência (%)','Tempo Líq. (min)','Status'];
  const lines = rows.map(o => [
    o.production_date,
    o.product_name,
    o.operator_name || '',
    o.planned_qty   ?? '',
    o.unit          || '',
    o.produced_qty  ?? '',
    o.efficiency_pct ?? '',
    o.total_net_minutes ? Math.round(o.total_net_minutes) : '',
    o.status,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv  = [headers.join(','), ...lines].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'ordens.csv'; a.click();
  URL.revokeObjectURL(url);
}


export default function Orders() {
  const { isGuest } = useAuth();
  const [from,     setFrom]     = useState(monthAgo);
  const [to,       setTo]       = useState(today);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState({ key: null, dir: 'asc' });
  const [editing,  setEditing]  = useState(null);
  const [deleting, setDeleting] = useState(null);

  const qs = `?date_from=${from}&date_to=${to}`;
  const { data: orders, loading, refetch } = useApi(`/orders${qs}`, [from, to]);

  const filtered = (orders || []).filter(o =>
    !search || o.product_name.toLowerCase().includes(search.toLowerCase())
  );
  const rows = applySort(filtered, sort.key, sort.dir);

  function handleSort(key) {
    if (!key) return;
    setSort(s => s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
    );
  }

  return (
    <div className="space-y-4">
      {editing  && <EditModal   order={editing}  onClose={() => setEditing(null)}  onSaved={refetch} />}
      {deleting && <DeleteConfirm order={deleting} onClose={() => setDeleting(null)} onDeleted={refetch} />}

      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl shadow-sm p-4">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border rounded px-2 py-1 text-sm" />
        <span className="text-gray-400">→</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border rounded px-2 py-1 text-sm" />
        <input
          placeholder="Buscar produto…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-1 text-sm flex-1 min-w-[160px]"
        />
        <button onClick={() => exportCSV(rows)} disabled={rows.length === 0}
          className="border border-gray-300 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded text-sm disabled:opacity-40">
          Exportar CSV
        </button>
        {!isGuest && (
          <Link to="/orders/new"
            className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded text-sm font-medium">
            + Nova Ordem
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key ?? '__actions'}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-left font-medium ${col.key ? 'cursor-pointer select-none hover:bg-gray-100 hover:text-gray-800' : ''}`}
                  >
                    {col.label}
                    {col.key && (
                      <span className="ml-1">
                        {sort.key === col.key
                          ? sort.dir === 'asc' ? '↑' : '↓'
                          : <span className="opacity-20">↕</span>
                        }
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2 text-gray-500">{fmtDate(o.production_date)}</td>
                  <td className="px-4 py-2 font-medium">{o.product_name}</td>
                  <td className="px-4 py-2 text-gray-500">{o.operator_name || '—'}</td>
                  <td className="px-4 py-2">{o.planned_qty  != null ? `${o.planned_qty} ${o.unit}`  : '—'}</td>
                  <td className="px-4 py-2">{o.produced_qty != null ? `${o.produced_qty} ${o.unit}` : '—'}</td>
                  <td className="px-4 py-2">
                    {o.efficiency_pct != null ? (
                      <span className={`font-semibold ${
                        o.efficiency_pct >= 100 ? 'text-green-600' :
                        o.efficiency_pct >= 80  ? 'text-yellow-600' : 'text-red-600'
                      }`}>{o.efficiency_pct}%</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {o.total_net_minutes ? `${Math.round(o.total_net_minutes)} min` : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link to={`/orders/${o.id}`}
                      className="text-xs text-gray-500 hover:text-gray-800 hover:underline mr-2">
                      Ver
                    </Link>
                    {!isGuest && (
                      <>
                        <button onClick={() => setEditing(o)}
                          className="text-xs text-brand-600 hover:text-brand-800 hover:underline mr-2">
                          Editar
                        </button>
                        <button onClick={() => setDeleting(o)}
                          className="text-xs text-red-400 hover:text-red-600 hover:underline">
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
