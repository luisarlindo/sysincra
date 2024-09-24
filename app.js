const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { engine } = require("express-handlebars");
const Handlebars = require("handlebars");

const app = express();
const PORT = 3000;

// Configuração do body-parser
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração do Handlebars
app.engine("handlebars", engine());
app.set("view engine", "handlebars");
app.set("views", "./views/");

app.use(express.static(path.join(__dirname, "public")));

// Helpers personalizados do Handlebars
Handlebars.registerHelper("ifCond", function (v1, operator, v2, options) {
  switch (operator) {
    case "==":
      return v1 == v2 ? options.fn(this) : options.inverse(this);
    case "===":
      return v1 === v2 ? options.fn(this) : options.inverse(this);
    case "!=":
      return v1 != v2 ? options.fn(this) : options.inverse(this);
    case "!==":
      return v1 !== v2 ? options.fn(this) : options.inverse(this);
    case "<":
      return v1 < v2 ? options.fn(this) : options.inverse(this);
    case "<=":
      return v1 <= v2 ? options.fn(this) : options.inverse(this);
    case ">":
      return v1 > v2 ? options.fn(this) : options.inverse(this);
    case ">=":
      return v1 >= v2 ? options.fn(this) : options.inverse(this);
    default:
      return options.inverse(this);
  }
});

Handlebars.registerHelper("eq", function (a, b, options) {
  return a == b ? options.fn(this) : options.inverse(this);
});

// Funções para carregar e salvar os dados em arquivo JSON local
const DATA_FILE = path.join(__dirname, "database.json");

const loadDatabase = () => {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const data = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(data);
};

const saveDatabase = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Rota para exibir os grupos familiares
app.get("/", (req, res) => {
  const familias = loadDatabase();

  // Ordena os grupos familiares por nome da mãe
  familias.sort((a, b) => {
    // Se a família "a" é indefinida e a "b" não é, "a" vai para o final
    if (a.tipo === "indefinido" && b.tipo !== "indefinido") {
      return 1;
    }
    // Se a família "b" é indefinida e a "a" não é, "b" vai para o final
    if (a.tipo !== "indefinido" && b.tipo === "indefinido") {
      return -1;
    }

    // Se ambos os tipos são iguais (não indefinidos), comparar pelo nome da mãe

    // Se o nome da mãe de "a" estiver vazio e o de "b" não, "a" vai depois
    if (!a.maeNome && b.maeNome) {
      return 1;
    }
    // Se o nome da mãe de "b" estiver vazio e o de "a" não, "b" vai depois
    if (!b.maeNome && a.maeNome) {
      return -1;
    }

    // Se ambos têm o nome da mãe vazio, não há ordenação adicional, então fica na mesma posição
    // Se ambos têm nome da mãe, compara os nomes das mães
    const nomeMaeA = a.maeNome || "";
    const nomeMaeB = b.maeNome || "";
    return nomeMaeA.localeCompare(nomeMaeB, undefined, { sensitivity: "base" });
  });

  res.render("index", { familias });
});

// Rota para exibir o formulário de novo grupo familiar
app.get("/familia/novo", (req, res) => {
  res.render("novo", { pessoas: new Array(7).fill({}) });
});

app.get("/familia/contagem", (req, res) => {
  // Carrega as famílias do banco de dados
  const familias = loadDatabase();

  // Inicializa os contadores de pessoas e filhos
  let contadorPessoas = 0;
  let contadorFilhos = 0;
  let contadorFamilias = 0;

  // Percorre cada família no banco de dados
  familias.forEach((familia) => {
    contadorFamilias++;
    // Verifica se o campo paiNome tem valor e incrementa o contador de pessoas
    if (familia.paiNome) {
      contadorPessoas++;
    }

    // Verifica se o campo maeNome tem valor e incrementa o contador de pessoas
    if (familia.maeNome) {
      contadorPessoas++;
    }

    // Verifica se há outras pessoas e conta cada uma delas
    if (familia.pessoas && Array.isArray(familia.pessoas)) {
      familia.pessoas.forEach((pessoa) => {
        if (pessoa.nome) {
          contadorPessoas++;
        }
      });
    }

    // Verifica se há filhos e conta cada um deles
    if (familia.filhos && Array.isArray(familia.filhos)) {
      contadorFilhos += familia.filhos.length;
    }
  });

  // Envia a resposta com a contagem total de pessoas e filhos cadastrados
  res.json({
    totalDePessoas: contadorPessoas,
    totalDeFilhos: contadorFilhos,
    totalDeFamilias: contadorFamilias,
  });
});

// Rota para salvar o grupo familiar

app.post("/familia/novo", (req, res) => {
  const { paiNome, paiCpf, maeNome, maeCpf, filhos, pessoas } = req.body;

  let novoGrupo = {};

  if ((paiNome && paiCpf) || (maeNome && maeCpf) || filhos) {
    novoGrupo = {
      tipo: "especificado",
      paiNome,
      paiCpf,
      maeNome,
      maeCpf,
      filhos: filhos ? filhos.split(",").map((f) => f.trim()) : [],
    };
  }

  // Processa apenas as pessoas cujos nomes e CPFs foram preenchidos
  const pessoasValidas = pessoas
    ? pessoas
        .filter((pessoa) => pessoa.nome && pessoa.cpf) // Filtra pessoas com nome e CPF
        .map((pessoa) => ({ nome: pessoa.nome, cpf: pessoa.cpf.trim() }))
    : [];

  if (pessoasValidas.length > 0) {
    novoGrupo.tipo = "indefinido";
    novoGrupo.pessoas = pessoasValidas;
  }

  const familias = loadDatabase();
  familias.push(novoGrupo);
  saveDatabase(familias);

  res.redirect("/familia/novo");
});

// Servidor rodando
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
