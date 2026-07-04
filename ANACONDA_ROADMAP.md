# Anaconda Roadmap (Desktop Collector)

Objetivo: entregar um cliente Windows simples para jogador leigo, com instalador assistido, execução em segundo plano e coleta passiva de dados úteis para o site VENUM.

## Estado atual

- Instalador assistido planejado como artefato principal: `Anaconda-Setup.exe`.
- Cliente roda em background com systray e startup automático.
- Sem entrada manual de chave para usuário final (token embutido no build).
- Telemetria já suporta fama, coleta, kills de mobs e progresso de missão.

## Estratégia de coleta (sem sobrecarga no banco)

1. **Eventos locais em lote**
   - Coletar eventos localmente e enviar em lotes curtos.
   - Limite por lote no servidor para proteger write spikes.

2. **Dedupe no servidor**
   - Preços de mercado deduplicados por `item_id + city` antes de persistir.
   - Escrita em chunks para evitar burst de RPCs.

3. **Sharding de clientes para preços**
   - Nem todo cliente precisa enviar preço em toda janela.
   - Somente um subconjunto determinístico dos clientes sobe dados de preço por período.

4. **Agregação assíncrona**
   - Persistir observação bruta e agregar para tabelas finais por pipeline SQL.
   - Mantém rastreabilidade sem travar UX.

## Implantação recomendada

1. Build local do cliente (Go) + build do instalador Inno Setup.
2. Publicar no site:
   - `public/downloads/Anaconda-Setup.exe` (primário)
   - `public/downloads/anaconda.zip` (fallback)
3. Deploy Vercel.
4. Validar endpoint de saúde `/api/celeste?action=status`.
5. Confirmar chegada de dados em `celeste_clients` e `celeste_observations`.

## Próxima etapa técnica (modo estilo Albion Data)

Para ficar mais próximo do modelo Albion Data Client:

- Adicionar módulo opcional de captura passiva de rede (Windows) para pacotes de mercado.
- Manter modo fallback por log quando captura de rede não estiver disponível.
- Garantir operação somente leitura/passiva (sem injeção ou escrita no tráfego do jogo).
- Gate por feature-flag para rollout gradual (10% -> 30% -> 100%).

## Dados extras sugeridos para o site

- Heatmap por horário (pico de atividade de guilda).
- Taxa de conclusão por tipo de missão.
- Tendência de preço (mediana 1h/6h/24h) para BlackMarket.
- Eficiência de farm (fama por hora por atividade).
- Alertas de variação brusca de item/cidade.
