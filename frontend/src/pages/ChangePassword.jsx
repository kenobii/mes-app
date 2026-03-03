import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api }    from '../api/client';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [form,    setForm]    = useState({ password: '', confirm: '' });
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm)
      return setError('As senhas não coincidem.');
    if (form.password.length < 6)
      return setError('A senha deve ter no mínimo 6 caracteres.');

    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { password: form.password });
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-bold text-gray-800">Definir nova senha</h1>
          <p className="text-sm text-gray-400 mt-1">Olá, {user?.name}. Por segurança, defina uma senha pessoal.</p>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 text-center">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-600">Nova senha</span>
            <input
              type="password" required autoFocus
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-600">Confirmar senha</span>
            <input
              type="password" required
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              className="mt-1 block w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <button type="submit" disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
            {loading ? 'Salvando…' : 'Salvar senha'}
          </button>
        </form>

        <button onClick={logout}
          className="w-full text-xs text-gray-400 hover:text-gray-600 text-center">
          Sair e fazer login com outra conta
        </button>
      </div>
    </div>
  );
}
