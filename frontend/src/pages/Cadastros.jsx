import { useState, useMemo } from 'react';
import { useApi }  from '../hooks/useApi';
import { api }     from '../api/client';
import { useAuth } from '../context/AuthContext';

/* ─── helpers ─────────────────────────────────────────────── */
function badge(label, color) {
  const map = {
    purple: 'bg-purple-100 text-purple-700',
    green:  'bg-green-100  text-green-700',
    red:    'bg-red-100    text-red-600',
    gray:   'bg-gray-100   text-gray-600',
    amber:  'bg-amber-100  text-amber-700',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[color]}`}>
      {label}
    </span>
  );
}

/* ─── sub-componentes ──────────────────────────────────────── */
function SearchInput({ value, onChange, placeholder = 'Buscar…' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="border rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-brand-400"
    />
  );
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>;
}

function EmptyRow({ cols, msg = 'Nenhum item encontrado.' }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-sm text-gray-400">{msg}</td>
    </tr>
  );
}

/* ─── aba Produtos ─────────────────────────────────────────── */
function TabProdutos({ products, refetch, onError }) {
  const [search,  setSearch]  = useState('');
  const [editId,  setEditId]  = useState(null);
  const [editVal, setEditVal] = useState({});
  const [form,    setForm]    = useState({ name: '', unit: 'KG' });

  const filtered = useMemo(() =>
    (products || []).filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  async function add() {
    if (!form.name.trim()) return;
    try { await api.post('/products', form); setForm({ name: '', unit: 'KG' }); refetch(); }
    catch (e) { onError(e.message); }
  }

  async function save(id) {
    try { await api.put(`/products/${id}`, editVal); setEditId(null); refetch(); }
    catch (e) { onError(e.message); }
  }

  function startEdit(p) {
    setEditId(p.id);
    setEditVal({ name: p.name, unit: p.unit });
  }

  return (
    <div className="space-y-4">
      {/* Formulário de adição */}
      <div className="flex gap-2">
        <input placeholder="Nome do produto" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
          className="border rounded-lg px-2 py-1.5 text-sm w-20">
          {['KG','UND','L','G'].map(u => <option key={u}>{u}</option>)}
        </select>
        <button onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium">
          + Adicionar
        </button>
      </div>

      {/* Busca + contagem */}
      <div className="flex items-center justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto…" />
        <span className="text-xs text-gray-400">{filtered.length} de {products?.length ?? 0}</span>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <Th>Nome</Th>
              <Th className="w-24 text-center">Unidade</Th>
              <Th className="w-24 text-center">Ação</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0
              ? <EmptyRow cols={3} />
              : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  {editId === p.id ? (
                    <>
                      <Td>
                        <input value={editVal.name}
                          onChange={e => setEditVal(v => ({ ...v, name: e.target.value }))}
                          className="border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-400" autoFocus />
                      </Td>
                      <Td className="text-center">
                        <select value={editVal.unit}
                          onChange={e => setEditVal(v => ({ ...v, unit: e.target.value }))}
                          className="border rounded px-1 py-1 text-sm">
                          {['KG','UND','L','G'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </Td>
                      <Td className="text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => save(p.id)}
                            className="bg-brand-600 text-white text-xs px-2 py-1 rounded hover:bg-brand-700">Salvar</button>
                          <button onClick={() => setEditId(null)}
                            className="text-gray-400 text-xs px-2 py-1 rounded hover:text-gray-600 border">Cancelar</button>
                        </div>
                      </Td>
                    </>
                  ) : (
                    <>
                      <Td className="font-medium text-gray-800">{p.name}</Td>
                      <Td className="text-center">{badge(p.unit, 'gray')}</Td>
                      <Td className="text-center">
                        <button onClick={() => startEdit(p)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                          Editar
                        </button>
                      </Td>
                    </>
                  )}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── aba Etapas ───────────────────────────────────────────── */
function TabEtapas({ stages, refetch, onError }) {
  const [search,  setSearch]  = useState('');
  const [editId,  setEditId]  = useState(null);
  const [editVal, setEditVal] = useState({});
  const [form,    setForm]    = useState({ name: '', category: '' });

  const filtered = useMemo(() =>
    (stages || []).filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [stages, search]
  );

  async function add() {
    if (!form.name.trim()) return;
    try { await api.post('/stages', form); setForm({ name: '', category: '' }); refetch(); }
    catch (e) { onError(e.message); }
  }

  async function save(id) {
    try { await api.put(`/stages/${id}`, editVal); setEditId(null); refetch(); }
    catch (e) { onError(e.message); }
  }

  function startEdit(s) {
    setEditId(s.id);
    setEditVal({ name: s.name, category: s.category || '' });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input placeholder="Nome da etapa" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <input placeholder="Categoria (opcional)" value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="w-44 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <button onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium">
          + Adicionar
        </button>
      </div>

      <div className="flex items-center justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar etapa…" />
        <span className="text-xs text-gray-400">{filtered.length} de {stages?.length ?? 0}</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <Th>Nome</Th>
              <Th className="w-36">Categoria</Th>
              <Th className="w-20 text-center">Histórico</Th>
              <Th className="w-24 text-center">Ação</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0
              ? <EmptyRow cols={4} />
              : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  {editId === s.id ? (
                    <>
                      <Td>
                        <input value={editVal.name}
                          onChange={e => setEditVal(v => ({ ...v, name: e.target.value }))}
                          className="border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-400" autoFocus />
                      </Td>
                      <Td>
                        <input value={editVal.category}
                          onChange={e => setEditVal(v => ({ ...v, category: e.target.value }))}
                          placeholder="Categoria"
                          className="border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-400" />
                      </Td>
                      <Td className="text-center">—</Td>
                      <Td className="text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => save(s.id)}
                            className="bg-brand-600 text-white text-xs px-2 py-1 rounded hover:bg-brand-700">Salvar</button>
                          <button onClick={() => setEditId(null)}
                            className="text-gray-400 text-xs px-2 py-1 rounded hover:text-gray-600 border">Cancelar</button>
                        </div>
                      </Td>
                    </>
                  ) : (
                    <>
                      <Td className="font-medium text-gray-800">{s.name}</Td>
                      <Td className="text-gray-500">{s.category || <span className="text-gray-300">—</span>}</Td>
                      <Td className="text-center">
                        {s.is_legacy ? <span className="text-amber-500 text-xs font-semibold" title="Dado histórico">★ Legado</span> : null}
                      </Td>
                      <Td className="text-center">
                        <button onClick={() => startEdit(s)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                          Editar
                        </button>
                      </Td>
                    </>
                  )}
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">★ Legado = etapa histórica sem desmembramento de tempo por sub-etapa.</p>
    </div>
  );
}

/* ─── aba Metas ────────────────────────────────────────────── */
function TabMetas({ targets, stages, refetchTargets, onError }) {
  const [form, setForm] = useState({ stage_id: '', target_minutes: '' });

  async function add() {
    if (!form.stage_id || !form.target_minutes) return;
    try {
      await api.post('/stage-targets', {
        stage_id:       Number(form.stage_id),
        target_minutes: Number(form.target_minutes),
      });
      setForm({ stage_id: '', target_minutes: '' });
      refetchTargets();
    } catch (e) { onError(e.message); }
  }

  async function remove(id) {
    try { await api.delete(`/stage-targets/${id}`); refetchTargets(); }
    catch (e) { onError(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={form.stage_id}
          onChange={e => setForm(f => ({ ...f, stage_id: e.target.value }))}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
          <option value="">Selecione a etapa…</option>
          {(stages || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="number" step="0.5" min="0" placeholder="Meta (min)"
          value={form.target_minutes}
          onChange={e => setForm(f => ({ ...f, target_minutes: e.target.value }))}
          className="w-32 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <button onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium">
          + Definir
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Tempo-alvo por ocorrência de cada etapa — usado no gráfico de comparação do Dashboard.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <Th>Etapa</Th>
              <Th className="w-32 text-center">Meta (min)</Th>
              <Th className="w-20 text-center">Ação</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!targets?.length
              ? <EmptyRow cols={3} msg="Nenhuma meta definida." />
              : targets.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <Td className="font-medium text-gray-800">{t.stage_name}</Td>
                  <Td className="text-center">{badge(`${t.target_minutes} min`, 'amber')}</Td>
                  <Td className="text-center">
                    <button onClick={() => remove(t.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Remover
                    </button>
                  </Td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── aba Usuários ─────────────────────────────────────────── */
function TabUsuarios({ operators, refetch, onError, me }) {
  const [search,  setSearch]  = useState('');
  const [form,    setForm]    = useState({ name: '', email: '' });
  const [msg,     setMsg]     = useState(null);
  const [editId,  setEditId]  = useState(null);
  const [editVal, setEditVal] = useState({});

  const filtered = useMemo(() =>
    (operators || []).filter(o => o.name.toLowerCase().includes(search.toLowerCase())),
    [operators, search]
  );

  async function add() {
    if (!form.name.trim()) return;
    try {
      setMsg(null);
      const res = await api.post('/operators', form);
      if (res.emailSent) setMsg(`Senha enviada para ${form.email}`);
      setForm({ name: '', email: '' });
      refetch();
    } catch (e) { onError(e.message); }
  }

  function startEdit(op) {
    setEditId(op.id);
    setEditVal({ name: op.name, email: op.email || '' });
  }

  async function saveEdit(id) {
    try {
      await api.put(`/operators/${id}`, editVal);
      setEditId(null);
      refetch();
    } catch (e) { onError(e.message); }
  }

  async function toggleRole(op) {
    if (op.id === me?.id) return;
    try {
      await api.put(`/operators/${op.id}`, { role: op.role === 'admin' ? 'user' : 'admin' });
      refetch();
    } catch (e) { onError(e.message); }
  }

  async function toggleActive(op) {
    if (op.id === me?.id) return;
    try {
      await api.put(`/operators/${op.id}`, { active: op.active ? 0 : 1 });
      refetch();
    } catch (e) { onError(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input placeholder="Nome" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <input placeholder="Email (opcional)" type="email" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <button onClick={add}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm px-4 py-1.5 rounded-lg font-medium">
          + Adicionar
        </button>
      </div>
      {msg && <p className="text-xs text-green-600 font-medium">{msg}</p>}
      <p className="text-xs text-gray-400">
        Se o email for informado, uma senha temporária será enviada automaticamente.
        Clique no badge de <strong>Perfil</strong> ou <strong>Status</strong> para alternar.
      </p>

      <div className="flex items-center justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar usuário…" />
        <span className="text-xs text-gray-400">{filtered.length} de {operators?.length ?? 0}</span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th className="w-28 text-center">Perfil</Th>
              <Th className="w-24 text-center">Status</Th>
              <Th className="w-24 text-center">Ação</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0
              ? <EmptyRow cols={5} />
              : filtered.map(op => {
                const isSelf = op.id === me?.id;
                return (
                  <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                    {editId === op.id ? (
                      <>
                        <Td>
                          <input value={editVal.name}
                            onChange={e => setEditVal(v => ({ ...v, name: e.target.value }))}
                            className="border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-400" autoFocus />
                        </Td>
                        <Td>
                          <input type="email" value={editVal.email}
                            onChange={e => setEditVal(v => ({ ...v, email: e.target.value }))}
                            placeholder="email@exemplo.com"
                            className="border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-1 focus:ring-brand-400" />
                        </Td>
                        <Td className="text-center text-gray-300">—</Td>
                        <Td className="text-center text-gray-300">—</Td>
                        <Td className="text-center">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => saveEdit(op.id)}
                              className="bg-brand-600 text-white text-xs px-2 py-1 rounded hover:bg-brand-700">Salvar</button>
                            <button onClick={() => setEditId(null)}
                              className="text-gray-400 text-xs px-2 py-1 rounded hover:text-gray-600 border">Cancelar</button>
                          </div>
                        </Td>
                      </>
                    ) : (
                      <>
                        <Td className="font-medium text-gray-800">
                          {op.name}
                          {isSelf && <span className="ml-1 text-xs text-gray-400">(você)</span>}
                        </Td>
                        <Td className="text-gray-500">{op.email || <span className="text-gray-300">—</span>}</Td>
                        <Td className="text-center">
                          <button
                            onClick={() => toggleRole(op)}
                            disabled={isSelf}
                            title={isSelf ? 'Não é possível alterar seu próprio perfil' : `Clique para tornar ${op.role === 'admin' ? 'Usuário' : 'Admin'}`}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors
                              ${op.role === 'admin' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                              ${isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                            {op.role === 'admin' ? 'Admin' : 'Usuário'}
                          </button>
                        </Td>
                        <Td className="text-center">
                          <button
                            onClick={() => toggleActive(op)}
                            disabled={isSelf}
                            title={isSelf ? 'Não é possível alterar sua própria conta' : op.active ? 'Clique para desativar' : 'Clique para ativar'}
                            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-colors
                              ${op.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}
                              ${isSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                            {op.active ? 'Ativo' : 'Inativo'}
                          </button>
                        </Td>
                        <Td className="text-center">
                          <button onClick={() => startEdit(op)}
                            className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                            Editar
                          </button>
                        </Td>
                      </>
                    )}
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── página principal ─────────────────────────────────────── */
const TABS = [
  { id: 'produtos',  label: 'Produtos'  },
  { id: 'etapas',   label: 'Etapas'    },
  { id: 'metas',    label: 'Metas'     },
  { id: 'usuarios', label: 'Usuários'  },
];

export default function Cadastros() {
  const { user: me } = useAuth();
  const { data: products,  refetch: refetchProducts  } = useApi('/products');
  const { data: stages,    refetch: refetchStages    } = useApi('/stages');
  const { data: operators, refetch: refetchOperators } = useApi('/operators');
  const { data: targets,   refetch: refetchTargets   } = useApi('/stage-targets');

  const [tab,   setTab]   = useState('produtos');
  const [error, setError] = useState(null);

  const counts = {
    produtos:  products?.length  ?? 0,
    etapas:    stages?.length    ?? 0,
    metas:     targets?.length   ?? 0,
    usuarios:  operators?.length ?? 0,
  };

  return (
    <div className="space-y-4 max-w-4xl w-full">
      <h1 className="text-xl font-bold text-gray-800">Cadastros</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
        </div>
      )}

      {/* Card com abas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Barra de abas */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors relative
                ${tab === t.id
                  ? 'text-brand-700 border-b-2 border-brand-600 bg-white -mb-px'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
              {t.label}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
                ${tab === t.id ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'}`}>
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        <div className="p-5">
          {tab === 'produtos'  && <TabProdutos  products={products}  refetch={refetchProducts}  onError={setError} />}
          {tab === 'etapas'    && <TabEtapas    stages={stages}      refetch={refetchStages}    onError={setError} />}
          {tab === 'metas'     && <TabMetas     targets={targets}    stages={stages}            refetchTargets={refetchTargets} onError={setError} />}
          {tab === 'usuarios'  && <TabUsuarios  operators={operators} refetch={refetchOperators} onError={setError} me={me} />}
        </div>
      </div>
    </div>
  );
}
