-- ═══════════════════════════════════════
-- VORTEK — Schema SQL Server
-- ═══════════════════════════════════════

CREATE DATABASE vortek;
GO
USE vortek;
GO

-- Clientes
CREATE TABLE clientes (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  nome        NVARCHAR(100) NOT NULL,
  email       NVARCHAR(150) NOT NULL UNIQUE,
  senha_hash  NVARCHAR(255) NOT NULL,
  telefone    NVARCHAR(20),
  ativo       BIT DEFAULT 1,
  criado_em   DATETIME2 DEFAULT GETDATE()
);

-- Projetos
CREATE TABLE projetos (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id  INT NOT NULL REFERENCES clientes(id),
  nome        NVARCHAR(150) NOT NULL,
  tipo        NVARCHAR(80),
  descricao   NVARCHAR(MAX),
  status      NVARCHAR(50) DEFAULT 'Em andamento',
  progresso   INT DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  inicio      DATE,
  previsao    DATE,
  criado_em   DATETIME2 DEFAULT GETDATE()
);

-- Etapas do projeto
CREATE TABLE etapas (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  projeto_id  INT NOT NULL REFERENCES projetos(id),
  nome        NVARCHAR(100) NOT NULL,
  concluida   BIT DEFAULT 0,
  ordem       INT DEFAULT 0
);

-- Arquivos
CREATE TABLE arquivos (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  projeto_id  INT NOT NULL REFERENCES projetos(id),
  nome        NVARCHAR(200) NOT NULL,
  caminho     NVARCHAR(500) NOT NULL,
  tamanho     BIGINT,
  tipo        NVARCHAR(50),
  enviado_em  DATETIME2 DEFAULT GETDATE()
);

-- Cobranças
CREATE TABLE cobrancas (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id  INT NOT NULL REFERENCES clientes(id),
  projeto_id  INT REFERENCES projetos(id),
  descricao   NVARCHAR(200),
  valor       DECIMAL(10,2) NOT NULL,
  status      NVARCHAR(20) DEFAULT 'Pendente',
  vencimento  DATE,
  pago_em     DATETIME2,
  criado_em   DATETIME2 DEFAULT GETDATE()
);

-- Tickets de suporte
CREATE TABLE tickets (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id  INT NOT NULL REFERENCES clientes(id),
  projeto_id  INT REFERENCES projetos(id),
  titulo      NVARCHAR(200) NOT NULL,
  mensagem    NVARCHAR(MAX) NOT NULL,
  status      NVARCHAR(20) DEFAULT 'Aberto',
  criado_em   DATETIME2 DEFAULT GETDATE()
);

-- Mensagens dos tickets
CREATE TABLE ticket_mensagens (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  ticket_id   INT NOT NULL REFERENCES tickets(id),
  autor       NVARCHAR(50) DEFAULT 'cliente',
  mensagem    NVARCHAR(MAX) NOT NULL,
  criado_em   DATETIME2 DEFAULT GETDATE()
);

-- Atividades (log)
CREATE TABLE atividades (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  cliente_id  INT NOT NULL REFERENCES clientes(id),
  texto       NVARCHAR(300) NOT NULL,
  criado_em   DATETIME2 DEFAULT GETDATE()
);
