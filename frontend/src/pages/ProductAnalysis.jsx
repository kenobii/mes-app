import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ErrorBar,
} from 'recharts';
import { useApi } from '../hooks/useApi';

const today    = new Date().toISOString().slice(0, 10);
const yearAgo  = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);

const STAGE_COLORS = [
  '#16a34a','#2563eb','#d97706','#7c3aed','#db2777',
  '#0891b2','#65a30d','#c2410c','#0d9488','#7e22ce',
  '#ea580c','#0284c7','#65a30d','#9333ea','#be123c',
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1 max-w-[220px]">
      <p className="font-semibold text-gray-800">{d.stage}</p>
      <p className="text-gray-600">Média: <span className="font-medium text-gray-900">{d.avg_net_minutes} min</span></p>
      <p className="text-gray-400">Mín: {d.min_net_minutes} min · Máx: {d.max_net_minutes} min</p>
      <p className="text-gray-400">Pausas médias: {d.avg_pause_minutes} min</p>
      <p className="text-gray-400">{d.occurrences} ocorrência{d.occurrences !== 1 ? 's' : ''}</p>
      {d.is_legacy ? <p className="text-yellow-600">★ Etapa histórica genérica</p> : null}
    </div>
  );
}

export default function ProductAnalysis() {
  const [from,       setFrom]       = useState(yearAgo);
  const [to,         setTo]         = useState(today);
  const [productId,  setProductId]  = useState('');
  const [showLegacy, setShowLegacy] = useState(false);

  const { data: products } = useApi('/products');
  const qs = `?date_from=${from}&date_to=${to}${productId ? `&product_id=${productId}` : ''}`;
  const { data: raw, loading } = useApi(`/dashboard/by-product-stage${qs}`, [from, to, productId]);

  // Produto selecionado (ou todos se nenhum selecionado)
  const selected = useMemo(() => {
    if (!raw) return null;
    if (productId) return raw.find(r => r.product_id === Number(productId)) || null;
    return null;
  }, [raw, productId]);

  // Dados do gráfico: etapas do produto selecionado
  const chartData = useMemo(() => {
    if (!selected) return [];
    return selected.stages
      .filter(s => showLegacy || !s.is_legacy)
      .map(s => ({
        ...s,
        errorBar: [s.avg_net_minutes - s.min_net_minutes, s.max_net_minutes - s.avg_net_minutes],
      }));
  }, [selected, showLegacy]);

  // Tabela comparativa: todos os produtos × etapas (modo "todos")
  const allData = useMemo(() => {
    if (!raw || productId) return null;
    return raw;
  }, [raw, productId]);

  const totalAvg = chartData.filter(d => !d.is_legacy).reduce((a, b) => a + b.avg_net_minutes, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-800">Tempo Médio por Etapa</h1>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm" />
        <span className="text-gray-400">→</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm" />

        <select value={productId} onChange={e => setProductId(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]">
          <option value="">Todos os produtos</option>
          {(products || []).map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showLegacy} onChange={e => setShowLegacy(e.target.checked)}
            className="rounded" />
          Incluir etapas históricas (★)
        </label>
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>}

      {/* ── Gráfico de 1 produto ── */}
      {selected && !loading && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-800">
                  {selected.product}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {chartData.filter(d => !d.is_legacy).length} etapas ·{' '}
                  Tempo líquido total médio:{' '}
                  <span className="font-medium text-gray-700">{totalAvg.toFixed(0)} min</span>
                  {' '}({(totalAvg / 60).toFixed(1)}h)
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }}
                  label={{ value: 'minutos', position: 'insideBottomRight', offset: -4, fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" width={150} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avg_net_minutes" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {chartData.map((entry, i) => (
                    <Cell key={entry.stage_id}
                      fill={entry.is_legacy ? '#f59e0b' : STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela detalhada */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  {['Etapa','Ocorrências','Mín (min)','Média (min)','Máx (min)','Pausas médias','Variação'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chartData.map(row => {
                  const variation = row.max_net_minutes - row.min_net_minutes;
                  const variationPct = row.avg_net_minutes > 0
                    ? Math.round((variation / row.avg_net_minutes) * 100) : 0;
                  return (
                    <tr key={row.stage_id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">
                        {row.is_legacy && <span className="text-yellow-500 mr-1">★</span>}
                        {row.stage}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{row.occurrences}x</td>
                      <td className="px-4 py-2 text-gray-500">{row.min_net_minutes}</td>
                      <td className="px-4 py-2 font-semibold text-gray-800">{row.avg_net_minutes}</td>
                      <td className="px-4 py-2 text-gray-500">{row.max_net_minutes}</td>
                      <td className="px-4 py-2 text-gray-500">{row.avg_pause_minutes}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          variationPct > 50 ? 'bg-red-100 text-red-700' :
                          variationPct > 25 ? 'bg-yellow-100 text-yellow-700' :
                                              'bg-green-100 text-green-700'
                        }`}>±{variationPct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tabela comparativa: todos os produtos ── */}
      {allData && !productId && !loading && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              Todos os Produtos — Etapas com Maior Tempo Médio
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Selecione um produto acima para ver o gráfico detalhado.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  {['Produto','Etapa principal','Tempo médio','Etapas','Tempo total médio'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allData.map(prod => {
                  const nonLegacy = prod.stages.filter(s => !s.is_legacy);
                  const top = nonLegacy[0];
                  const total = nonLegacy.reduce((a, s) => a + s.avg_net_minutes, 0);
                  if (!top) return null;
                  return (
                    <tr key={prod.product_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setProductId(String(prod.product_id))}>
                      <td className="px-4 py-2 font-medium text-gray-800 max-w-[200px]">
                        {prod.product}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{top.stage}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-brand-500"
                            style={{ width: `${Math.min(top.avg_net_minutes / 6, 120)}px` }} />
                          <span className="text-xs font-medium">{top.avg_net_minutes} min</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{nonLegacy.length}</td>
                      <td className="px-4 py-2 text-gray-700 font-medium">
                        {total.toFixed(0)} min
                        <span className="text-gray-400 text-xs ml-1">({(total/60).toFixed(1)}h)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
