# Análise de Problemas - Sincronização Meta Ads

## Problemas Identificados

### 1. 🐛 PROBLEMA CRÍTICO: Data do insight usando `new Date()` em vez da data real

**Local:** Linhas 137-148 (métricas de campanha) e 232/247 (criativos)

```javascript
await prisma.metricaCampanha.create({
  data: {
    campanha_id: campanha.id,
    data: new Date(),  // ❌ PROBLEMA: Usa data atual, não a data do insight
    impressoes: parseInt(item.impressions) || 0,
    // ...
  }
});
```

**Impacto:**
- Todos os registros são criados com a data de hoje, não a data real da métrica
- Impossível fazer histórico temporal correto
- GET retorna dados "antigos" porque todos têm a mesma data

**Solução:**
A API Meta não retorna data explícita no level=campaign quando usando `time_range`. O correto é:
- Ou usar o início do `time_range` (since)
- Ou criar um registro único por campanha com a data mais recente do range

---

### 2. 🐛 PROBLEMA: GET `/api/meta/sync` não garante "última métrica por campanha"

**Local:** Linhas 26-33

```javascript
const campanhas = await prisma.campanha.findMany({
  include: {
    metricas: {
      orderBy: { data: 'desc' },
      take: 1,
    },
  },
});
```

**Problema:** Como todas as métricas têm `data: new Date()` (mesmo timestamp), o `orderBy: { data: 'desc' }` não garante pegar a última inserção - pode pegar qualquer uma.

**Solução:** Usar `orderBy: { id: 'desc' }` para pegar o registro mais recente por ID.

---

### 3. 🐛 PROBLEMA: Parse de `actions` pode falhar silenciosamente

**Local:** Linhas 130-135

```javascript
const leads = item.actions?.find(a =>
  ['onsite_conversion.messaging_first_reply', 'lead', 'link_click', 'onsite_conversion.messaging_conversation_started_7d'].includes(a.action_type)
)?.value || 0;
```

**Problema:** Se `item.actions` for `null` ou `undefined`, o optional chaining `?.` previne o erro, mas o `|| 0` mascara dados ausentes que deveriam ser investigados.

**Solução:** Manter o fallback, mas adicionar log de warning quando ações esperadas estiverem ausentes.

---

### 4. 🐛 PROBLEMA: `purchase_roas` parse pode retornar `0` inválido

**Local:** Linha 135

```javascript
const roasMeta = item.purchase_roas?.find(a => a.action_type === 'purchase')?.value || 0;
```

**Problema:** Se `purchase_roas` existir mas o valor for `0` (campanha sem vendas), o `|| 0` é correto. Porém, se o campo não existir, também retorna `0`, mascarando a ausência do dado.

**Solução:** Diferenciar "ROAS = 0" de "ROAS não reportado":

```javascript
const roasMeta = item.purchase_roas?.find(a => a.action_type === 'purchase')?.value ?? null;
```

---

### 5. 🐛 PROBLEMA: Timezone não é considerado em `since/until`

**Local:** Linhas 65-69 (POST)

```javascript
let { since, until } = reqBody;

if (since && until && since > until) {
  [since, until] = [until, since];
}
```

**Problema:**
- A API Meta usa timezone UTC por padrão
- O usuário pode enviar datas em formato local (Brasil = UTC-3)
- Sem conversão, o range pode pegar dias errados

**Solução:** Converter datas locais para UTC antes de enviar para Meta:

```javascript
// Se since/until forem strings YYYY-MM-DD sem timezone, assumir America/Sao_Paulo
const toUTC = (dateStr) => {
  const local = new Date(dateStr + 'T00:00:00-03:00');
  return local.toISOString().split('T')[0];
};
```

---

### 6. 🐛 PROBLEMA: Duplicidade de registros `MetricaCampanha`

**Local:** Linha 137

```javascript
await prisma.metricaCampanha.create({ ... });
```

**Problema:** Cada sync cria NOVOS registros sem verificar se já existe métrica para aquela campanha + data. Com múltiplos syncs no mesmo dia, há duplicidade.

**Solução:** Usar `upsert` com unique constraint em `(campanha_id, data)`:

```javascript
await prisma.metricaCampanha.upsert({
  where: {
    campanha_id_data: { campanha_id: campanha.id, data: dataUsada },
  },
  update: { ... },
  create: { ... },
});
```

---

## Resumo dos Problemas por Categoria

| Categoria | Problema | Severidade |
|-----------|----------|------------|
| Data/Timezone | `new Date()` em vez de data do insight | 🔴 Crítica |
| Data/Timezone | Timezone não convertido (UTC vs local) | 🟡 Média |
| Duplicidade | Cria registros duplicados por sync | 🟡 Média |
| GET endpoint | `orderBy: data` não garante último registro | 🟡 Média |
| Parse de dados | `actions` sem validação de ausência | 🟢 Baixa |
| Parse de dados | `purchase_roas` mascara ausência com 0 | 🟢 Baixa |

---

## Patch Mínimo Recomendado

As correções prioritárias (menor mudança, maior impacto):

1. **Corrigir data do registro** - Usar data fixa do range (`since`) em vez de `new Date()`
2. **Corrigir GET** - Usar `orderBy: { id: 'desc' }` para pegar último registro
3. **Prevenir duplicidade** - Adicionar unique index e usar `upsert`
