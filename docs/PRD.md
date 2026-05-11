# PRD - Sistema de Controle de Entregas e Tarefas Operacionais

## Visao Geral

O Sistema de Controle de Entregas e Tarefas Operacionais centraliza demandas de rotina em um fluxo unico: entregas, coletas, rotas, manutencoes, estoque e atividades administrativas. O objetivo e reduzir perda de informacao, atrasos, retrabalho e falta de visibilidade operacional.

## Problema

Equipes operacionais costumam controlar demandas por WhatsApp, planilhas, ligacoes e conversas informais. Isso gera dificuldade para saber o que esta pendente, quem e responsavel, qual prazo venceu e qual foi o historico de cada ocorrencia.

## Publico-Alvo

- Pequenas transportadoras.
- Lojas com entrega propria.
- Operacoes de estoque e expedicao.
- Equipes administrativas com tarefas recorrentes.
- Prestadores de servico que precisam controlar rotas, prazos e responsaveis.

## Escopo Atual

- Tela publica para registrar demandas.
- Consulta publica por protocolo e contato.
- Painel operacional protegido por login.
- Indicadores de total, abertas, em separacao, aguardando coleta, em rota, falhas, reentregas, vencidas, entregues e criticas.
- Kanban operacional por status.
- Regras de transicao de status.
- Sugestao automatica de categoria e prioridade.
- Prazo automatico por prioridade.
- Notas publicas e internas.
- Auditoria de acoes.
- Exportacao CSV.
- Backup JSON.
- Documentacao de rotas.
- Deploy preparado para Render.
- Graficos reais no dashboard.
- Rota textual com origem e destino.
- SLA configuravel por prioridade e categoria.
- Relatorio imprimivel para salvar como PDF.
- Tema visual configuravel por cliente.
- Pagina comercial.
- Usuarios com perfis e permissoes.
- Detalhe completo da demanda.
- Anexos por link e upload real de arquivos.
- Seed demo.
- Deploy com dominio, HTTPS, homologacao e producao separados.
- Migrations PostgreSQL e indices de busca.
- Troca de senha e bloqueio/desbloqueio de usuarios.
- Notificacoes por webhook/e-mail para nova demanda, demanda critica e prazo vencido.
- Comprovante obrigatorio na conclusao.

## Fora Do Escopo Atual

- Aplicativo mobile nativo.
- Rastreamento GPS em tempo real.
- Integracao direta com WhatsApp oficial.
- Assinatura digital de comprovante.
- Controle financeiro completo.
- Multiempresa com isolamento por tenant.

## Requisitos Funcionais

- RF01: registrar demanda publica.
- RF02: gerar protocolo unico.
- RF03: classificar prioridade automaticamente.
- RF04: sugerir categoria automaticamente.
- RF05: consultar andamento por protocolo e contato.
- RF06: autenticar administrador.
- RF07: listar demandas com busca e filtros.
- RF08: alterar status conforme fluxo permitido.
- RF09: registrar responsavel ao mover demanda.
- RF10: adicionar notas internas ou publicas.
- RF11: exibir dashboard operacional.
- RF12: exportar CSV.
- RF13: baixar backup JSON.
- RF14: registrar auditoria.
- RF15: documentar rotas principais.
- RF16: exibir graficos reais no dashboard.
- RF17: exibir origem e destino como rota textual.
- RF18: permitir configuracao de tema visual.
- RF19: permitir configuracao de SLA.
- RF20: gerar relatorio imprimivel/PDF.
- RF21: criar usuarios com perfis.
- RF22: exibir detalhe completo da demanda.
- RF23: registrar anexos por link.
- RF24: criar dados demo para apresentacao.
- RF25: enviar arquivos de comprovante.
- RF26: trocar senha do usuario logado.
- RF27: bloquear ou desbloquear usuarios.
- RF28: disparar alertas de prazo vencido.
- RF29: manter schema PostgreSQL com migrations.

## Requisitos Nao Funcionais

- Responsivo para celular, tablet e desktop.
- Breakpoints oficiais: celular ate 768px, tablet de 769px a 1024px e desktop acima de 1024px.
- Menu hamburguer no mobile.
- Persistencia local simples e auditavel em JSON para desenvolvimento/homologacao, com migrations PostgreSQL para producao robusta.
- Login administrativo com cookie `HttpOnly`.
- Senha administrativa com hash `scrypt` em producao, mantendo compatibilidade temporaria com hashes legados.
- Headers de seguranca, expiracao de sessao, limite basico de requisicoes e protecao contra origem cruzada em metodos de escrita.
- Validacao de entradas no servidor.
- Estado local facil de portar para banco relacional em evolucao.
- Testes automatizados com `node:test`.

## Regras De Negocio

- Tipos validos: entrega, coleta e tarefa.
- Status validos: novo, em_separacao, aguardando_coleta, em_rota, entregue, falha_entrega, reentrega e cancelado.
- Prioridade critica vence em 2 horas.
- Prioridade alta vence em 6 horas.
- Prioridade media vence em 24 horas.
- Prioridade baixa vence em 72 horas.
- Status `entregue` e `cancelado` encerram o fluxo.
- Transicoes invalidas retornam erro.
- Consulta publica nao mostra contato interno nem notas internas.
- Entrega concluida exige responsavel, observacao final, data/hora e comprovante.
- SLA por categoria prevalece sobre SLA geral quando configurado.

## Criterios De Aceite

- Usuario registra demanda e recebe protocolo.
- Usuario consulta demanda pelo protocolo e contato.
- Painel bloqueia acesso sem login.
- Admin visualiza indicadores e kanban.
- Admin move demanda apenas por transicoes validas.
- Sistema identifica demandas vencidas.
- CSV e backup estao disponiveis para administracao.
- Testes passam com `npm test`.
- Graficos do painel sao preenchidos com dados reais.
- Relatorio PDF abre para impressao/salvamento.
- Tema visual muda apos configuracao.
- Demo cria demandas de exemplo.
- Upload de comprovante registra anexo real.
- Marcacao como entregue falha sem comprovante.
- Usuario pode trocar senha e admin pode bloquear usuario.

## Roadmap

- PostgreSQL como storage ativo em producao.
- Perfis de usuario por permissao avancada.
- Comprovantes com storage externo.
- Webhook configuravel por cliente.
- Relatorios por periodo.
- SLA por categoria.
- Historico completo por campo alterado.
- Notificacoes por WhatsApp/e-mail.
