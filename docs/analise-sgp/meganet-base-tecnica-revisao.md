# Meganet — revisão do conteúdo das 51 anotações

Leitura de 23/10/2026 via API, sem alteração no SGP. Conteúdo operacional examinado com campos de autenticação omitidos. Não houve teste de conexão a equipamentos. Esta revisão não certifica validade de senhas ou atualidade das informações.

## Correção da interpretação anterior

55 registros importados não equivalem a 55 equipamentos nem a 55 acessos validados. O parser anterior reconhecia alguns títulos, mas não interpretava tabelas, portas, dependências, contas de banco ou histórico. Os 23 alertas automáticos não delimitam todos os erros possíveis. Toda a amostra deve ser reconciliada com a origem antes de ser considerada revisada.

## Classificação individual por identificador de origem

| Anotação | Conteúdo observado | Tratamento proposto |
|---|---|---|
|3696|RB identificada no título|Equipamento e acesso; preservar identificação original|
|3632|Quatro switches Datacom: Jardim Atlântico, Monte, Engenho Maranguape e Água Fria|Quatro equipamentos distintos; separar cada bloco e seus acessos|
|3622|CCR de cliente Macedo Rocha|Equipamento de cliente atendido pelo provedor; registrar vínculo, sem criar outro provedor automaticamente|
|3600|RB Cisney, razão social de cliente e endereço|Equipamento e contexto do cliente final|
|3532|SGP Knet com vários campos de autenticação|Sistema com contas distintas; confirmar finalidade das contas|
|3530|OLT Huawei MA5680T com porta específica|Equipamento com endpoint e porta separados|
|3529|CCR 2116 concentrador Knet|Equipamento com função concentrador e contexto Knet|
|3528|CCR 2004 borda Knet|Equipamento com função borda e contexto Knet|
|3330|Conteúdo inteiramente ocultado por conter autenticação|Revisão protegida adicional necessária; não classificado por suposição|
|3213|phpIPAM web, SSH/Linux e banco de dados|Sistema, servidor e banco relacionados; não são necessariamente métodos do mesmo equipamento|
|3138|RB 1016 Gato Mercado, Winbox|Equipamento e método Winbox|
|3129|Switch TP-Link Serrambi, IP, URL e Telnet|Equipamento com acessos Web e Telnet; não abrir Telnet como site|
|3092|RB 2011 Igreja da Árvore, Winbox|Equipamento e local de instalação|
|2964|Grafana, Zabbix, Linux, porta e banco|Conjunto de serviços relacionados; comparar com 783 e 735 sem sobrescrever|
|2890|OLT Huawei Maranguape / Fox UP|Equipamento, POP e contexto operacional|
|2887|CGNAT Hillstone|Equipamento/função e contas de acesso|
|2859|PTP Ubiquiti, gateway, AP, station, acessos externos, SSID e alimentação pela ether7|Enlace com duas pontas, gateway e relação física; SSID não é usuário|
|2857|OLT GPON Serrambi Sítio, endereço externo/privado e caminho rádio-switch-GE01|Equipamento, endpoints e procedimento/topologia relacionados a 2859 e 2224|
|2785|Huawei S6730 Jardim Atlântico com três endereços e duas portas|Múltiplos endpoints; não presumir correspondência por posição|
|2744|LibreNMS Debian|Servidor/sistema operacional associado ao monitoramento|
|2743|LibreNMS aplicação|Aplicação; verificar relação com 2744|
|2526|OLT VSOL EPON Serrambi|Equipamento; conferir formatação e campos antes da extração|
|2224|RB3011 Serrambi com dois endereços Winbox|Equipamento e endpoints; possível gateway descrito em 2857/2859|
|2223|OLT VSOL GPON Porto de Galinhas|Equipamento e acesso web|
|2208|Huawei S5720 POP Monte, dois IPs e duas portas SSH|Endpoints e contas; associação das portas requer conferência|
|2129|AnyDesk PC Central Grafana, código e autenticação|Acesso remoto com identificador, não IP/URL; verificar contas distintas|
|1990|Endereço seguido de dois “NOVO IP” e porta Winbox|Histórico de endereços; não escolher automaticamente o primeiro nem afirmar qual está ativo|
|1962|OLT Huawei Jardim Atlântico, Telnet|Equipamento e porta Telnet específica|
|1827|RB1100 Lar de Acolhimento, Winbox|Equipamento e contexto de cliente final|
|1808|Speedtest, SSH|Serviço/servidor e acesso administrativo|
|1795|SGP Konecta Telecom|Sistema de entidade relacionada; manter contexto sem inferir propriedade|
|1791|OLT Huawei Água Fria / Konecta Telecom|Equipamento, POP e contexto relacionado|
|1661|OLT Huawei POP Monte, Telnet|Equipamento e endpoint|
|1559|OLT VSOL|Identificação insuficiente para unir a outra OLT VSOL|
|1323|URL, conta Gmail e senha|Conta/sistema; finalidade ainda não confirmada|
|1250|ASN, prefixos IPv4 e IPv6|Dados de rede do provedor; não é credencial e não deve pedir usuário/senha|
|1230|Servidor PowerEdge R410, acessos interno e externo|Servidor e endpoints; confirmar camada de gestão antes de classificar como hipervisor|
|1157|DNS Ajust, endereço e porta|Serviço DNS e acesso administrativo; não fundir com DNS Meganet|
|969|Acesso, código e autenticação|Registro de acesso por identificador; classificação protegida adicional|
|799|Links COMMCORP/BRDigital, Algar, designação, capacidade e contato|Circuitos/fornecedores; campos vazios são desconhecidos, não zero|
|783|Grafana, Zabbix, Linux e porta SSH|Conjunto de serviços; comparar com 2964/735 antes de consolidar|
|782|URL, email e senha|Conta/sistema com finalidade a confirmar|
|746|Huawei S6720 Tabajara, dois IPs e portas SSH|Equipamento com múltiplos endpoints|
|735|Grafana|Possível acesso relacionado a outras notas; sem fusão automática|
|725|NE8000 autenticador/BGP, SSH e várias credenciais|Equipamento com múltiplas funções e contas/privilégios|
|705|SGP Meganet e várias autenticações|Sistema com contas distintas; não reduzir a uma senha|
|702|DNS Meganet / DNS-cache, SSH|Serviço e endpoint; distinto de 1157 até confirmação|
|701|Huawei MA5680T, dois IPs e porta|Equipamento; comparar com 700/3530 sem inferir igualdade pelo modelo|
|700|OLT Huawei POP Tabajara, dois IPs e porta|Equipamento e POP; conferir possível sobreposição com 701|
|696|CCR1036 Gerência|Equipamento com função de gerência|
|695|SGP máquina, IP e autenticação|Servidor de hospedagem; relacionar ao SGP aplicação somente após confirmação|

## Adaptação necessária no ERP

Uma única área do provedor, com três conjuntos claros:

1. Equipamentos e sistemas: nome, função, local/POP e relação com outros itens. Cada item tem acessos próprios, sem tratar servidor e aplicação como o mesmo objeto.
2. Informações de rede: ASN, prefixos, enlaces, fornecedores, designações e capacidades. Sem campos obrigatórios de senha.
3. Orientações: texto organizado com passos, caminhos físicos, comandos, dependências e histórico. Vinculável ao provedor ou a equipamentos/sistemas.

Acesso precisa separar método, endereço, porta e contexto interno/externo/VPN. Deve aceitar Web, SSH, Telnet, Winbox, acesso remoto e banco de dados. Contas e privilégios não podem ser reduzidos a um único par usuário/senha.

Metadados de migração ficam internos. Exibir situação “A conferir”, “Conferido” ou “Histórico”; “conferido” não significa conexão testada. Preservar a origem criptografada e as alterações auditadas. Não transformar todo conteúdo em uma anotação genérica que obrigue o operador a repetir a interpretação.

## Próxima execução segura

Não reimportar nem fundir automaticamente. Reconciliar os 55 registros existentes por ID de origem, começando pelos casos 1250/799 (não credenciais), 3632 (quatro equipamentos), 3213/2964 (camadas diferentes) e 2857/2859 (topologia). Fazer prévia de alterações antes de gravar; manter originais e rollback. Pendências de identidade, conta e endereço atual precisam de confirmação humana, não de acesso experimental aos equipamentos.

Nesta revisão, nenhum registro do ERP foi reorganizado ou removido.
