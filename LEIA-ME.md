# Site do Real Lanches (prévia)

Site de uma página com o cardápio completo do Real Lanches Pastéis & Açaí (Parque Santo Antônio, Taubaté), para computador e celular.

## Abrir

Dê dois cliques no `index.html`. Precisa de internet só para as fontes e o mapa; as fotos estão na pasta `fotos/`.

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | A página |
| `css/estilo.css` | Visual. As cores ficam no topo (`--red`, `--gold`) |
| `js/dados.js` | Loja, horários, telefones, taxas por bairro e o cardápio inteiro (gerado automaticamente) |
| `js/app.js` | Funcionamento: sacola, montagem do lanche, animações, galeria infinita |
| `fotos/cardapio/` | Uma foto por item (do app de pedidos) |
| `fotos/local/` | Logo, capa, fotos da loja e de clientes |
| `_coleta/` | Dados brutos coletados e o script que gera o `dados.js` |
| `REVISAR.md` | O que confirmar com o dono antes de publicar |
| `AVALIACAO-SITE-ATUAL.md` | Avaliação do cardápio atual (Giga Pedidos), boa para mostrar ao dono |

## Mudar algo

- **Preço, nome ou descrição:** edite direto em `js/dados.js`.
- **Pedido pelo app em vez do WhatsApp:** em `js/dados.js`, troque `"pedidoPor": "whatsapp"` por `"pedidoPor": "app"`.
- **Gerar o cardápio de novo:** rode `python gerar_dados.py` dentro de `_coleta`. Isso sobrescreve o `dados.js` (edições feitas à mão nele se perdem).

## O que tem no site

- Abertura com a marca (só na primeira visita)
- Título com fotos dentro das palavras, mural de fotos infinito e selo girando
- Duas fitas cruzadas infinitas que aceleram com a rolagem
- Carrossel infinito de destaques (arrasta com impulso e encaixa)
- Cardápio com abas fixas, busca e filtros por ingrediente; pastéis agrupados por recheio
- Montagem de cada item com as mesmas opções e preços do app (pão, maionese, até 10 adicionais, tamanho, complementos)
- Sacola com entrega (taxa exata por bairro de Taubaté e Tremembé), retirada ou consumo no local, pagamento e troco, e pedido pronto no WhatsApp
- Galeria infinita com as 139 fotos do cardápio
- Fotos da loja com crédito, horários, telefones, mapa e calculadora de taxa de entrega
- Tema escuro (padrão, combina com a logo) e claro
