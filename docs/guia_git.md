# 📚 Guia Git - Projeto App Unify

## 🔑 Autenticação SSH

O repositório usa **chave SSH** para autenticação (sem senha).

**Localização da chave:**
```
~/.ssh/github_unify
```

---

## 📁 Diretório do Projeto

Sempre execute os comandos Git dentro deste diretório:
/home/app/projects/Ajust_ERP/

---

## 🚀 Comandos Básicos

### Ver status
```bash
git status
```

### Adicionar arquivos
```bash
git add -A                    # Adiciona tudo
git add nome_do_arquivo.dart  # Adiciona arquivo específico
```

### Criar commit
```bash
git commit -m "tipo: descrição da alteração"
```

**Tipos de commit:**
- `feat:` → Nova funcionalidade
- `fix:` → Correção de bug
- `docs:` → Documentação
- `chore:` → Manutenção/limpeza

### Push para GitHub
```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/github_unify -o StrictHostKeyChecking=no" git push origin main
```


```
