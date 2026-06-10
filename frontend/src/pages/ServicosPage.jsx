import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { formatarMoeda, calcularDataPrevista } from '../services/validar';

function formatarDataHoje() {
  return new Date().toLocaleDateString('pt-BR');
}

export default function ServicosPage({ usuario, onNavigate }) {
  const [servicos, setServicos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [servicoSelecionado, setServicoSelecionado] = useState('');
  const [erroPedido, setErroPedido] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [confirmarIndex, setConfirmarIndex] = useState(null); // ← NOVO: substitui window.confirm

  const login = usuario?.login || usuario?.email || '';
  const nomeExibido = usuario?.nome
    ? usuario.nome.charAt(0).toUpperCase() + usuario.nome.slice(1)
    : '—';

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      const [rsServicos, rsPedidos] = await Promise.all([
        api.getServicos(),
        api.getSolicitacoes(login),
      ]);
      if (rsServicos.sucesso) setServicos(rsServicos.servicos);
      if (rsPedidos.sucesso) setPedidos(rsPedidos.solicitacoes);
    } finally {
      setCarregando(false);
    }
  }, [login]);

  useEffect(() => {
    if (!usuario?.logado) return;
    carregarDados();
  }, [carregarDados, usuario]);

  if (!usuario?.logado) {
    return (
      <main className="page-servicos">
        <div className="container">
          <div id="aviso-login" className="aviso-login">
            <div className="painel">
              <h2 style={{ marginBottom: '1rem' }}>Acesso restrito</h2>
              <p>Você precisa estar logado para acessar o painel de serviços.</p>
              <button className="btn btn-primario" onClick={() => onNavigate('login')}>
                Fazer login
              </button>
              <span style={{ color: 'var(--cor-texto-suave)', margin: '0 0.5rem' }}>ou</span>
              <button className="btn btn-secundario" onClick={() => onNavigate('cadastro')}>
                Criar conta
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const servicoAtual = servicos.find(s => String(s.id) === servicoSelecionado);

  function handleAdicionarPedido() {
    if (!servicoSelecionado) {
      setErroPedido('Selecione um serviço para continuar.');
      return;
    }
    setErroPedido('');
    const novoPedido = {
      id_servico: servicoAtual.id,
      servico_nome: servicoAtual.nome,
      preco: servicoAtual.preco,
      prazo: servicoAtual.prazo,
      icone: servicoAtual.icone,
      data_pedido: formatarDataHoje(),
      status: 'EM ELABORAÇÃO',
      _tempId: Date.now(),
    };
    setPedidos(p => [...p, novoPedido]);
    setServicoSelecionado('');
  }

  // ← CORRIGIDO: sem window.confirm, controle por estado
  function handleExcluir(index) {
    setConfirmarIndex(index);
  }

  function confirmarExclusao() {
    setPedidos(p => p.filter((_, i) => i !== confirmarIndex));
    setConfirmarIndex(null);
  }

  function cancelarExclusao() {
    setConfirmarIndex(null);
  }

  async function handleSalvar() {
    setSalvando(true);
    setMensagem('');
    try {
      const payload = pedidos.map(p => ({
        id_servico: p.id_servico,
        data_pedido: p.data_pedido,
        status: p.status,
      }));
      const res = await api.atualizarSolicitacoes(login, payload);
      if (res.sucesso) {
        setMensagem('✅ Pedidos salvos com sucesso!');
        await carregarDados();
      } else {
        setMensagem('❌ Erro ao salvar: ' + (res.mensagem || ''));
      }
    } catch {
      setMensagem('❌ Erro de conexão.');
    } finally {
      setSalvando(false);
      setTimeout(() => setMensagem(''), 4000);
    }
  }

  return (
    <main className="page-servicos">
      <div className="container">
        <div style={{ marginBottom: '2rem' }}>
          <span className="tag-acento">// Painel do cliente</span>
          <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', marginTop: '0.5rem' }}>
            Meus serviços
          </h1>
        </div>

        {/* Dados do usuário */}
        <section className="painel" aria-label="Dados do usuário">
          <h2 className="painel-titulo">👤 Dados do cliente</h2>
          <div className="usuario-info">
            <div className="usuario-campo">
              <span>Nome</span>
              <span>{nomeExibido}</span>
            </div>
            <div className="usuario-campo">
              <span>E-mail</span>
              <span>{usuario.email || login}</span>
            </div>
            <div className="usuario-campo">
              <span>Status</span>
              <span className="status-badge">Cliente ativo</span>
            </div>
          </div>
        </section>

        {/* Confirmação de exclusão — NOVO, substitui window.confirm */}
        {confirmarIndex !== null && (
          <div className="painel" style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            flexWrap: 'wrap', background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.3)'
          }}>
            <span style={{ flex: 1 }}>
              ⚠️ Deseja realmente excluir o pedido de{' '}
              <strong>{pedidos[confirmarIndex]?.servico_nome}</strong>?
            </span>
            <button className="btn btn-perigo" onClick={confirmarExclusao}>
              Confirmar exclusão
            </button>
            <button className="btn btn-secundario" onClick={cancelarExclusao}>
              Cancelar
            </button>
          </div>
        )}

        {/* Tabela de pedidos */}
        <section className="painel" aria-label="Pedidos do cliente">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="painel-titulo" style={{ marginBottom: 0 }}>📋 Meus pedidos</h2>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {mensagem && (
                <span style={{
                  fontSize: '0.9rem',
                  color: mensagem.startsWith('✅') ? 'var(--cor-sucesso)' : 'var(--cor-erro)'
                }}>
                  {mensagem}
                </span>
              )}
              <button className="btn btn-primario" onClick={handleSalvar} disabled={salvando}>
                {salvando ? 'Salvando…' : '💾 Salvar pedidos'}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', marginTop: '1.2rem' }}>
            {carregando ? (
              <p style={{ color: 'var(--cor-texto-suave)', textAlign: 'center', padding: '2rem' }}>
                Carregando…
              </p>
            ) : (
              <table className="tabela-pedidos" aria-label="Tabela de pedidos">
                <thead>
                  <tr>
                    <th scope="col">Data pedido</th>
                    <th scope="col">Serviço</th>
                    <th scope="col">Status</th>
                    <th scope="col">Preço</th>
                    <th scope="col">Data prevista</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.length === 0 ? (
                    <tr className="linha-vazia">
                      <td colSpan={6}>Nenhum pedido encontrado. Solicite um serviço abaixo.</td>
                    </tr>
                  ) : (
                    pedidos.map((p, i) => (
                      <tr
                        key={p.id || p._tempId || i}
                        className="linha-nova"
                        style={confirmarIndex === i ? { background: 'rgba(248,113,113,0.08)' } : {}}
                      >
                        <td>{p.data_pedido}</td>
                        <td>{p.icone} {p.servico_nome}</td>
                        <td><span className="status-badge">{p.status}</span></td>
                        <td><span className="valor-preco">{formatarMoeda(p.preco)}</span></td>
                        <td>{calcularDataPrevista(p.prazo)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn btn-perigo"
                            aria-label={`Excluir pedido de ${p.servico_nome}`}
                            onClick={() => handleExcluir(i)}
                            disabled={confirmarIndex !== null && confirmarIndex !== i}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Nova solicitação */}
        <section className="painel" aria-label="Nova solicitação de serviço">
          <h2 className="painel-titulo">➕ Nova solicitação</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <div
              className={`form-grupo${erroPedido ? ' invalido' : ''}`}
              style={{ gridColumn: '1 / -1' }}
            >
              <label htmlFor="sel-servico">
                Serviço <abbr title="obrigatório">*</abbr>
              </label>
              <select
                id="sel-servico"
                value={servicoSelecionado}
                onChange={e => { setServicoSelecionado(e.target.value); setErroPedido(''); }}
                aria-required="true"
              >
                <option value="">— Selecione um serviço —</option>
                {servicos.map(s => (
                  <option key={s.id} value={String(s.id)}>
                    {s.icone} {s.nome}
                  </option>
                ))}
              </select>
              {erroPedido && (
                <span className="erro-msg" role="alert">{erroPedido}</span>
              )}
            </div>

            <div className="form-grupo">
              <label>Preço (R$)</label>
              <input
                type="text"
                value={servicoAtual ? formatarMoeda(servicoAtual.preco) : ''}
                readOnly disabled placeholder="Automático"
              />
            </div>
            <div className="form-grupo">
              <label>Prazo (dias)</label>
              <input
                type="text"
                value={servicoAtual ? `${servicoAtual.prazo} dia(s)` : ''}
                readOnly disabled placeholder="Automático"
              />
            </div>
            <div className="form-grupo">
              <label>Data prevista de entrega</label>
              <input
                type="text"
                value={servicoAtual ? calcularDataPrevista(servicoAtual.prazo) : ''}
                readOnly disabled placeholder="Automático"
              />
            </div>
            <div className="form-grupo">
              <label>Status</label>
              <input type="text" value="EM ELABORAÇÃO" readOnly disabled />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-primario" onClick={handleAdicionarPedido}>
              ➕ Adicionar pedido
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}