import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import GanttChart from '../components/GanttChart';
import { fmtDateShort } from '../utils/format';
import { STAGE_COLORS } from '../utils/colors';

const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

export default function Dashboard() {
  const [from,       setFrom]       = useState(monthAgo);
  const [to,         setTo]         = useState(today);
  const [operatorId, setOperatorId] = useState('');

  const { data: operators } = useApi('/operators');

  const qs = `?date_from=${from}&date_to=${to}${operatorId ? `&operator_id=${operatorId}` : ''}`;

  const { data: summary        } = useApi(`/dashboard/summary${qs}`,           [from, to, operatorId]);
  const { data: summaryPrev    } = useApi(`/dashboard/summary-prev${qs}`,      [from, to, operatorId]);
  const { data: byStage        } = useApi(`/dashboard/by-stage${qs}`,          [from, to]);
  const { data: daily          } = useApi(`/dashboard/daily${qs}`,             [from, to]);
  const { data: timeline       } = useApi(`/dashboard/timeline${qs}`,          [from, to]);
  const { data: eff            } = useApi(`/dashboard/efficiency${qs}`,        [from, to]);
  const { data: byProductStage } = useApi(`/dashboard/by-product-stage${qs}`,  [from, to]);
  const { data: pauses         } = useApi(`/dashboard/pauses${qs}`,            [from, to, operatorId]);
  const { data: stageTargets   } = useApi('/stage-targets');

  // Etapas que possuem meta cadastrada e dados reais
  const targetCompareData = useMemo(() => {
    if (!byStage || !stageTargets?.length) return [];
    return (stageTargets || [])
      .map(t => {
        const real = (byStage || []).find(s => s.stage === t.stage_name);
        if (!real) return null;
        return { name: t.stage_name, real: real.avg_net_minutes, meta: t.target_minutes };
      })
      .filter(Boolean);
  }, [byStage, stageTargets]);

  const pauseData = (pauses || [])
    .slice(0, 12)
    .map(r => ({ name: r.reason, minutos: r.total_minutes, ocorrencias: r.occurrences }));

  const targetMap = useMemo(() => {
    const m = {};
    for (const t of stageTargets || []) m[t.stage_name] = t.target_minutes;
    return m;
  }, [stageTargets]);

  const stageData = (byStage || [])
    .filter(r => !r.is_legacy)
    .slice(0, 15)
    .map(r => ({ name: r.stage, minutos: r.total_net_minutes, ocorrencias: r.occurrences, meta: targetMap[r.stage] ?? null }));

  const effData = (eff || [])
    .filter(r => r.avg_efficiency_pct != null)
    .slice(0, 12)
    .map(r => ({ name: r.product, eficiencia: r.avg_efficiency_pct }));

  // Etapas únicas (não-legado) para o gráfico empilhado
  const allStages = useMemo(() => {
    if (!byProductStage) return [];
    const seen = new Set();
    for (const p of byProductStage)
      for (const s of p.stages)
        if (!s.is_legacy) seen.add(s.stage);
    return [...seen];
  }, [byProductStage]);

  // Linha por produto — médias
  const productStageData = useMemo(() => {
    if (!byProductStage) return [];
    return byProductStage.map(p => {
      const row = { name: p.product };
      for (const s of p.stages)
        if (!s.is_legacy) row[s.stage] = s.avg_net_minutes;
      return row;
    });
  }, [byProductStage]);

  // Linha por produto — totais
  const productStageTotalData = useMemo(() => {
    if (!byProductStage) return [];
    return byProductStage.map(p => {
      const row = { name: p.product };
      for (const s of p.stages)
        if (!s.is_legacy) row[s.stage] = s.total_net_minutes;
      return row;
    });
  }, [byProductStage]);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl shadow-sm p-4">
        <span className="text-sm font-medium text-gray-600">Período:</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="border rounded px-2 py-1 text-sm" />
        <span className="text-gray-400">→</span>
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}
          className="border rounded px-2 py-1 text-sm" />
        <select value={operatorId} onChange={e => setOperatorId(e.target.value)}
          className="border rounded px-2 py-1 text-sm">
          <option value="">Todos os usuários</option>
          {(operators || []).map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Ordens',          value: summary.total_orders,          prev: summaryPrev?.total_orders },
            { label: 'Produtos',        value: summary.total_products,        prev: summaryPrev?.total_products },
            { label: 'Total Planejado', value: `${summary.total_planned ?? 0} kg`,  prev: summaryPrev?.total_planned,  raw: summary.total_planned },
            { label: 'Total Produzido', value: `${summary.total_produced ?? 0} kg`, prev: summaryPrev?.total_produced, raw: summary.total_produced },
            { label: 'Eficiência Média',value: `${summary.avg_efficiency_pct ?? '—'}%`,
              prev: summaryPrev?.avg_efficiency_pct, raw: summary.avg_efficiency_pct,
              highlight: summary.avg_efficiency_pct >= 100 },
          ].map(kpi => {
            const cur  = kpi.raw  ?? kpi.value;
            const prev = kpi.prev ?? null;
            const delta = (prev != null && cur != null && typeof cur === 'number' && typeof prev === 'number' && prev !== 0)
              ? Math.round((cur - prev) / prev * 100)
              : null;
            return (
              <div key={kpi.label}
                className={`bg-white rounded-xl shadow-sm p-4 flex flex-col gap-1
                  ${kpi.highlight ? 'border-l-4 border-brand-500' : ''}`}>
                <span className="text-xs text-gray-500 uppercase tracking-wide">{kpi.label}</span>
                <span className="text-2xl font-bold text-gray-800">{kpi.value}</span>
                {delta !== null && (
                  <span className={`text-xs font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs período anterior
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tempo por etapa */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Tempo Total por Etapa (min)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageData} layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v} min`]} />
              <Bar dataKey="minutos" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Eficiência por produto */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Eficiência por Produto (%)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={effData} layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 150]} tick={{ fontSize: 11 }}
                tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => [`${v}%`]} />
              <Bar dataKey="eficiencia" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Análise de pausas */}
      {pauseData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Pausas por Motivo (min total)</h2>
          <ResponsiveContainer width="100%" height={Math.max(200, pauseData.length * 32)}>
            <BarChart data={pauseData} layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => [name === 'minutos' ? `${v} min` : v, name === 'minutos' ? 'Total' : 'Ocorrências']} />
              <Bar dataKey="minutos" fill="#f59e0b" radius={[0, 4, 4, 0]}
                label={{ position: 'right', fontSize: 10, fill: '#6b7280', formatter: v => `${v}min` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Etapas por produto — média */}
      {productStageData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Tempo Médio por Etapa / Produto (min)
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(700, productStageData.length * 72) }}>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={productStageData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}min`} />
                  <Tooltip formatter={(v, name) => [`${v} min`, name]} />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 12 }} />
                  {allStages.map((stage, i) => (
                    <Bar key={stage} dataKey={stage} stackId="a"
                      fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Etapas por produto — total */}
      {productStageTotalData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Tempo Total por Etapa / Produto (min)
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(700, productStageTotalData.length * 72) }}>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={productStageTotalData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, angle: -45, textAnchor: 'end' }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}min`} />
                  <Tooltip formatter={(v, name) => [`${v} min`, name]} />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 12 }} />
                  {allStages.map((stage, i) => (
                    <Bar key={stage} dataKey={stage} stackId="a"
                      fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Metas vs Real */}
      {targetCompareData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Metas vs Tempo Médio Real (min/ocorrência)</h2>
          <p className="text-xs text-gray-400 mb-3">Apenas etapas com meta cadastrada.</p>
          <ResponsiveContainer width="100%" height={Math.max(180, targetCompareData.length * 48)}>
            <BarChart data={targetCompareData} layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => [`${v} min`, name === 'real' ? 'Média real' : 'Meta']} />
              <Legend formatter={n => n === 'real' ? 'Média real' : 'Meta'} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="meta" fill="#d1fae5" stroke="#16a34a" strokeWidth={1} radius={[0,4,4,0]} />
              <Bar dataKey="real" radius={[0,4,4,0]}
                fill="#2563eb"
                label={{ position: 'right', fontSize: 10, fill: '#6b7280', formatter: v => `${v}min` }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Produção diária */}
      {daily && daily.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Produção Diária (kg)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }}
                tickFormatter={d => fmtDateShort(d)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="planned"   stroke="#94a3b8" strokeWidth={2} dot={false} name="Planejado" />
              <Line type="monotone" dataKey="produced"  stroke="#16a34a" strokeWidth={2} dot={false} name="Produzido" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Timeline de Ocupação — últimos 3 dias
          </h2>
          <GanttChart data={timeline} />
        </div>
      )}
    </div>
  );
}
