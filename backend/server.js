const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, 'nexus.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Save helper
  function saveDB() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS cliente (
      login TEXT PRIMARY KEY,
      senha TEXT NOT NULL,
      nome TEXT NOT NULL,
      email TEXT NOT NULL,
      cpf TEXT NOT NULL,
      nascimento TEXT NOT NULL,
      telefone TEXT,
      estado_civil TEXT,
      escolaridade TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS servico_ti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT NOT NULL,
      preco REAL NOT NULL,
      prazo INTEGER NOT NULL,
      icone TEXT DEFAULT '💻'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS solicitacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_cliente TEXT NOT NULL,
      id_servico INTEGER NOT NULL,
      data_pedido TEXT NOT NULL,
      status TEXT DEFAULT 'EM ELABORAÇÃO',
      FOREIGN KEY (login_cliente) REFERENCES cliente(login),
      FOREIGN KEY (id_servico) REFERENCES servico_ti(id)
    )
  `);

  saveDB();

  // Seed default services if empty
  const count = db.exec('SELECT COUNT(*) as c FROM servico_ti');
  const total = count[0]?.values[0][0] ?? 0;
  if (total === 0) {
    const services = [
      ['Segurança da Informação', 'Proteção completa contra ameaças digitais: firewall, criptografia, pentest e monitoramento 24/7.', 4500.00, 30, '🛡️'],
      ['Cloud Computing', 'Migração e gestão de ambientes cloud (AWS, Azure, GCP) com alta disponibilidade e custo otimizado.', 3200.00, 20, '☁️'],
      ['Suporte Técnico', 'Atendimento presencial e remoto para infraestrutura de redes, hardware e software corporativo.', 800.00, 5, '⚙️'],
      ['Desenvolvimento de Software', 'Sistemas web e mobile sob medida, APIs RESTful e integração com ERPs e plataformas de terceiros.', 12000.00, 60, '💻'],
      ['Business Intelligence', 'Painéis de dados e relatórios gerenciais para tomada de decisão baseada em dados reais.', 6500.00, 45, '📊'],
      ['Backup e Recuperação', 'Políticas robustas de backup automatizado com disaster recovery para continuidade de negócios.', 1200.00, 10, '🔄'],
    ];
    const stmt = db.prepare('INSERT INTO servico_ti (nome, descricao, preco, prazo, icone) VALUES (?, ?, ?, ?, ?)');
    services.forEach(s => stmt.run(s));
    stmt.free();
    saveDB();
  }

  return saveDB;
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (e) {
    throw e;
  }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
}

let saveDB;

initDB().then(save => {
  saveDB = save;

  // ── AUTH ──────────────────────────────────────────────
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { login, senha } = req.body;
      if (!login || !senha) return res.json({ sucesso: false, mensagem: 'Login e senha obrigatórios.' });
      const cliente = queryOne('SELECT * FROM cliente WHERE login = ?', [login]);
      if (!cliente) return res.json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
      const ok = await bcrypt.compare(senha, cliente.senha);
      if (!ok) return res.json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
      const { senha: _, ...dados } = cliente;
      res.json({ sucesso: true, cliente: dados });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message });
    }
  });

  // ── TROCA DE SENHA ────────────────────────────────────
  app.post('/api/auth/troca-senha', async (req, res) => {
    try {
      const { login, senhaAtual, novaSenha } = req.body;
      const cliente = queryOne('SELECT * FROM cliente WHERE login = ?', [login]);
      if (!cliente) return res.json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
      const ok = await bcrypt.compare(senhaAtual, cliente.senha);
      if (!ok) return res.json({ sucesso: false, mensagem: 'Senha atual incorreta.' });
      const hash = await bcrypt.hash(novaSenha, 10);
      run('UPDATE cliente SET senha = ? WHERE login = ?', [hash, login]);
      saveDB();
      res.json({ sucesso: true });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message });
    }
  });

  // ── CADASTRO DE CLIENTE ───────────────────────────────
  app.post('/api/clientes', async (req, res) => {
    try {
      const { login, senha, nome, email, cpf, nascimento, telefone, estado_civil, escolaridade } = req.body;
      const existe = queryOne('SELECT login FROM cliente WHERE login = ?', [login]);
      if (existe) return res.json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado.' });
      const hash = await bcrypt.hash(senha, 10);
      run(
        'INSERT INTO cliente (login, senha, nome, email, cpf, nascimento, telefone, estado_civil, escolaridade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [login, hash, nome, email, cpf, nascimento, telefone || '', estado_civil || '', escolaridade || '']
      );
      saveDB();
      res.json({ sucesso: true });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message });
    }
  });

  // ── SERVIÇOS TI ───────────────────────────────────────
  app.get('/api/servicos', (req, res) => {
    try {
      const servicos = queryAll('SELECT * FROM servico_ti ORDER BY id');
      res.json({ sucesso: true, servicos });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message, servicos: [] });
    }
  });

  app.post('/api/servicos', (req, res) => {
    try {
      const { nome, descricao, preco, prazo, icone } = req.body;
      if (!nome || !descricao || preco == null || prazo == null) {
        return res.json({ sucesso: false, mensagem: 'Todos os campos são obrigatórios.' });
      }
      run(
        'INSERT INTO servico_ti (nome, descricao, preco, prazo, icone) VALUES (?, ?, ?, ?, ?)',
        [nome, descricao, parseFloat(preco), parseInt(prazo), icone || '💻']
      );
      saveDB();
      res.json({ sucesso: true });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message });
    }
  });

  // ── SOLICITAÇÕES ──────────────────────────────────────
  app.get('/api/solicitacoes/:login', (req, res) => {
    try {
      const { login } = req.params;
      const solicitacoes = queryAll(`
        SELECT s.id, s.data_pedido, s.status, s.id_servico,
               st.nome as servico_nome, st.preco, st.prazo, st.icone
        FROM solicitacao s
        JOIN servico_ti st ON s.id_servico = st.id
        WHERE s.login_cliente = ?
        ORDER BY s.id
      `, [login]);
      res.json({ sucesso: true, solicitacoes });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message, solicitacoes: [] });
    }
  });

  app.put('/api/solicitacoes/:login', (req, res) => {
    try {
      const { login } = req.params;
      const { solicitacoes } = req.body;
      run('DELETE FROM solicitacao WHERE login_cliente = ?', [login]);
      if (Array.isArray(solicitacoes) && solicitacoes.length > 0) {
        const stmt = db.prepare(
          'INSERT INTO solicitacao (login_cliente, id_servico, data_pedido, status) VALUES (?, ?, ?, ?)'
        );
        solicitacoes.forEach(s => {
          stmt.run([login, s.id_servico, s.data_pedido, s.status || 'EM ELABORAÇÃO']);
        });
        stmt.free();
      }
      saveDB();
      res.json({ sucesso: true });
    } catch (e) {
      res.status(500).json({ sucesso: false, mensagem: e.message });
    }
  });

  app.get('/api/clientes/:login', (req, res) => {
  try {
    const { login } = req.params;
    const cliente = queryOne(
      'SELECT login, nome, email, cpf, nascimento, telefone, estado_civil, escolaridade FROM cliente WHERE login = ?',
      [login]
    );
    if (!cliente) return res.json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
    res.json({ sucesso: true, cliente });
  } catch (e) {
    res.status(500).json({ sucesso: false, mensagem: e.message });
  }
});



  const PORT = 3001;
  app.listen(PORT, () => console.log(`Nexus TI Backend rodando na porta ${PORT}`));
});

app.get('/api/clientes/:login', (req, res) => {
  try {
    const { login } = req.params;
    const cliente = queryOne(
      'SELECT login, nome, email, cpf, nascimento, telefone, estado_civil, escolaridade FROM cliente WHERE login = ?',
      [login]
    );
    if (!cliente) return res.json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
    res.json({ sucesso: true, cliente });
  } catch (e) {
    res.status(500).json({ sucesso: false, mensagem: e.message });
  }
});
