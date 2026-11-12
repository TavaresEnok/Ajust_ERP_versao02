# Publicar a extensão Ajust Cofre na Chrome Web Store

Objetivo: o analista clica em **Instalar extensão** no cofre do ERP, abre a página da loja e
clica em **Usar no Chrome**. Sem zip, sem modo de desenvolvedor, e com atualização automática.
A extensão fica **não listada**: não aparece nas buscas da loja, só quem tem o link a encontra.

Arquivos para o envio (pacote `ajust-cofre-pacote-loja.zip`):

| Arquivo | Onde usar |
| --- | --- |
| `ajust-cofre-loja.zip` | Pacote da extensão (passo 2) |
| `captura-1280x800.png` | Capturas de tela (passo 3) |
| `bloco-promocional-440x280.png` | Bloco promocional pequeno (passo 3) |
| `icone-128.png` | Ícone da loja (passo 3) |

Página de privacidade (pública): https://erp.ajustconsulting.com.br/privacidade-extensao

---

## Passo 1: criar a conta de desenvolvedor (uma vez só)

1. Entre em **https://chrome.google.com/webstore/devconsole** com um Gmail ou Google
   Workspace **da empresa** (não pessoal). Quem for dono da conta controla a extensão para
   sempre.
2. Aceite o contrato de desenvolvedor e pague a **taxa única de US$ 5** com cartão.
3. Na aba **Conta**:
   - **Nome do editor**: `Ajust Consulting`. Aparece na página da extensão.
   - **E-mail de contato**: um e-mail da empresa. Clique em **Verificar** e confirme pelo link
     que chega. Sem isso a loja não deixa publicar.
   - **Declaração de comerciante (trader)**: marque **"Não sou comerciante"**. A extensão é
     gratuita e de uso interno.
   - Salve.

## Passo 2: enviar o pacote

1. No painel, clique em **+ Novo item**.
2. Envie o arquivo **`ajust-cofre-loja.zip`**. Não use o zip do Guia de uso: o da loja tem o
   `manifest.json` na raiz.
3. A loja cria o item e abre as abas de cadastro.

## Passo 3: aba "Página na loja" (Store listing)

- **Idioma**: Português (Brasil)
- **Título**: Ajust Cofre (vem do pacote)
- **Resumo**: vem do pacote
- **Descrição** (copie e cole):

```
Extensão de uso interno da equipe da Ajust Consulting, integrada ao cofre de credenciais do Ajust ERP (erp.ajustconsulting.com.br).

No cofre do ERP, o analista clica em "Entrar automaticamente": a extensão abre o sistema do provedor numa aba nova e preenche usuário, senha e o código de verificação em duas etapas (2FA).

Como funciona com segurança:
• Só preenche o endereço exato cadastrado no cofre; se o site redirecionar para outro endereço, nada é preenchido.
• Os dados ficam apenas na memória do navegador e são apagados quando o login termina, quando a aba fecha ou em até 3 minutos.
• A chave do autenticador 2FA nunca sai do ERP; a extensão recebe só códigos de uso único.
• Captchas ("Não sou um robô") continuam sendo marcados pelo próprio analista.
• Cada uso fica registrado na auditoria do Ajust ERP.

Requer uma conta ativa no Ajust ERP.
```

- **Categoria**: Ferramentas (Tools) ou Produtividade (Productivity)
- **Ícone da loja**: `icone-128.png`
- **Capturas de tela**: `captura-1280x800.png`
- **Bloco promocional pequeno**: `bloco-promocional-440x280.png`
- **Site oficial**: https://erp.ajustconsulting.com.br (opcional)
- **URL de suporte**: deixe em branco, ou use o e-mail de contato
- Clique em **Salvar rascunho**.

## Passo 4: aba "Práticas de privacidade" (Privacy practices)

**Descrição da finalidade única** (single purpose):

```
Entrar automaticamente nos sistemas web dos provedores atendidos pela Ajust Consulting, preenchendo usuário, senha e código 2FA que o próprio usuário escolheu no cofre do Ajust ERP.
```

**Justificativa de cada permissão** (copie cada uma no campo correspondente):

- **scripting**:
  `Preencher o formulário de login (usuário, senha e código 2FA) na aba que a extensão abriu para o acesso escolhido pelo usuário no cofre do Ajust ERP.`
- **storage**:
  `Guardar temporariamente, só em memória (chrome.storage.session), os dados do acesso entre o carregamento da tela de login e da tela de 2FA. São apagados ao concluir, ao fechar a aba ou em até 3 minutos.`
- **tabs**:
  `Abrir o sistema do provedor numa aba nova e conferir o endereço dessa aba antes de preencher, para nunca preencher um site diferente do cadastrado.`
- **Permissão de host** (`<all_urls>`):
  `Cada provedor atendido usa um endereço próprio (domínios diferentes e endereços IP com porta), cadastrado no cofre do Ajust ERP, então não há uma lista fixa de sites. A extensão só age na aba que ela mesma abriu, e só se a origem for exatamente a cadastrada. O script de comunicação com o ERP roda apenas em https://erp.ajustconsulting.com.br.`

**Código remoto**: **Não, não estou usando código remoto.**

**Uso de dados**: marque somente **"Informações de autenticação"** (Authentication information).
Deixe todas as outras caixas desmarcadas.

Marque as **três declarações**:
- não vendo ou transfiro dados a terceiros, fora dos casos de uso aprovados;
- não uso nem transfiro dados para fins não relacionados à finalidade única;
- não uso nem transfiro dados para determinar crédito ou conceder empréstimos.

**URL da política de privacidade**:
`https://erp.ajustconsulting.com.br/privacidade-extensao`

Clique em **Salvar rascunho**.

## Passo 5: aba "Distribuição" (Distribution)

- **Pagamento**: Gratuito
- **Visibilidade**: **Não listado** (Unlisted)
- **Regiões**: Todas, ou só Brasil
- Salve.

## Passo 6: enviar para análise

1. Clique em **Enviar para análise** (Submit for review).
2. Na janela que abrir, deixe marcado **"Publicar automaticamente após a aprovação"**.
3. A análise leva de alguns dias a umas 2 semanas. Como a extensão lida com senhas e pede acesso
   a qualquer site, ela costuma passar por uma análise mais detalhada. Se o Google recusar ou
   pedir ajustes, chega um e-mail com o motivo: me mande que eu corrijo.

## Passo 7: depois de aprovada

1. No painel, abra o item e copie o **link da loja**
   (`https://chromewebstore.google.com/detail/ajust-cofre/<código>`).
2. Me envie o link. Eu troco no cofre o botão **Baixar extensão** por **Instalar extensão**,
   apontando para a loja, e atualizo o Guia de uso.
3. Opcional: com o código da extensão, preparo o arquivo de **instalação forçada** (dois
   cliques numa máquina Windows com acesso de administrador) para instalar sem nenhuma
   interação.

### No Edge

O analista abre o mesmo link da loja. Na primeira vez, o Edge pergunta se permite extensões de
outras lojas: clique em **Permitir** e depois em **Usar no Chrome**.

### Versões novas

Eu gero um zip novo com a versão aumentada. Você entra no painel, abre o item, clica em
**Pacote → Enviar novo pacote** e em **Enviar para análise**. Depois da aprovação, os navegadores
atualizam sozinhos em algumas horas.
