const BASE = 'http://localhost:3001/api';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  return res.json();
}

export const api = {
  login: (login, senha) => req('POST', '/auth/login', { login, senha }),
  trocaSenha: (login, senhaAtual, novaSenha) => req('POST', '/auth/troca-senha', { login, senhaAtual, novaSenha }),
  cadastrarCliente: (dados) => req('POST', '/clientes', dados),
  getServicos: () => req('GET', '/servicos'),
  cadastrarServico: (dados) => req('POST', '/servicos', dados),
  getSolicitacoes: (login) => req('GET', `/solicitacoes/${login}`),
  atualizarSolicitacoes: (login, solicitacoes) => req('PUT', `/solicitacoes/${login}`, { solicitacoes }),
  getCliente: (login) => req('GET', `/clientes/${login}`),
};
