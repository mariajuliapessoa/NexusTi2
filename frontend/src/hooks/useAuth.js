import { useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';

export function useAuth() {
  const [usuario, setUsuario] = useState(null);
  const [restaurando, setRestaurando] = useState(true);

  useEffect(() => {
    const loginSalvo = window.location.hash.replace('#', '');
    if (!loginSalvo) {
      setRestaurando(false);
      return;
    }
    
    api.getCliente(loginSalvo)
      .then(res => {
        if (res.sucesso) {
          setUsuario({ ...res.cliente, logado: true });
        } else {
          window.location.hash = '';
        }
      })
      .catch(() => {
        window.location.hash = '';
      })
      .finally(() => setRestaurando(false));
  }, []);

  const login = useCallback((dados) => {
    window.location.hash = dados.login || dados.email || '';
    setUsuario({ ...dados, logado: true });
  }, []);

  const logout = useCallback(() => {
    window.location.hash = '';
    setUsuario(null);
  }, []);

  return { usuario, login, logout, estaLogado: !!usuario?.logado, restaurando };
}