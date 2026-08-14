# Finanças de Casa

Sistema pessoal de controle financeiro doméstico. Feito para uso individual —
todos os dados ficam salvos apenas no navegador (localStorage), sem backend
ou login.

## Funcionalidades

- **Lançamentos**: entradas e saídas, pagas na conta ou no cartão de crédito.
- **Fatura do Cartão**: compras no cartão são agrupadas por fatura seguindo a
  regra de fechamento — compras até o dia 8 entram na fatura do mês corrente,
  a partir do dia 9 entram na fatura do mês seguinte. Marcar a fatura como
  paga lança o total como saída da conta.
- **Recorrentes**: modelos de entradas/saídas fixas (salário, aluguel,
  assinaturas) para lançar com um clique todo mês.
- **Orçamentos**: limite mensal por categoria (padrão: Feira R$ 1.200 e
  Gasolina R$ 700). O que não é gasto continua fazendo parte do saldo da
  conta normalmente — não existe "reserva" separada.
- **Relatórios**: gastos por categoria, entradas x saídas e evolução do saldo
  mensal.

## Rodando localmente

```bash
npm install
npm run dev
```

## Stack

Vite + React + TypeScript + Tailwind CSS v4 + Zustand (persistido em
localStorage) + React Router + Recharts.
