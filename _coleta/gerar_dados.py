import json, os, re, unicodedata
os.chdir(os.path.dirname(os.path.abspath(__file__)))
P = json.load(open('produtos.json', encoding='utf-8'))
M = json.load(open('manifest.json', encoding='utf-8'))
OUT = os.path.join("..", "js", "dados.js")

PEQ = {'com', 'de', 'e', 'da', 'do', 'das', 'dos', 'na', 'no', 'ao', 'a', 'o', 'em', 'sem'}
FIX = {'hamburguer': 'hambúrguer', 'hamburgao': 'hamburgão', 'pao': 'pão', 'frances': 'francês', 'katchup': 'ketchup',
       'porcao': 'porção', 'file': 'filé', 'brocolis': 'brócolis', 'brocólis': 'brócolis', 'pure': 'purê', 'pessego': 'pêssego',
       'guarana': 'guaraná', 'strogonof': 'strogonoff', 'antartica': 'antarctica', 'sprit': 'sprite', 'oregano': 'orégano',
       'acai': 'açaí', 'avela': 'avelã', 'tubaina': 'tubaína'}
UP = {'egg': 'Egg', 'big': 'Big', 'kitkat': 'KitKat', 'h2o': 'H2O', '2l': '2 L', '2lt': '2 L', '1litro': '1 litro',
      '600': '600 ml', '600ml': '600 ml', '300ml': '300 ml', '400ml': '400 ml', '500ml': '500 ml', '700ml': '700 ml'}


def word(w, first):
    lw = w.lower()
    if lw in FIX:
        lw = FIX[lw]
    if lw in UP:
        return UP[lw]
    if not first and lw in PEQ:
        return lw
    if re.fullmatch(r'x-.+', lw):
        return 'X-' + word(lw[2:], True)
    return lw[:1].upper() + lw[1:]


def titulo(s):
    s = re.sub(r'\s*\(.*?\)\s*', '', s).strip()
    s = re.sub(r'\s+', ' ', s)
    return ' '.join(word(w, i == 0) for i, w in enumerate(s.split(' ')))


def frase(s):
    s = re.sub(r'\s*,\s*', ', ', s.strip())
    s = re.sub(r'\s+', ' ', s).strip(' .')
    if not s:
        return ''
    parts = []
    for t in s.split(' '):
        lw = t.lower()
        core = lw.strip(',.')
        rep = FIX.get(core, core)
        if core == '2carnes':
            rep = '2 carnes'
        parts.append(lw.replace(core, rep))
    s = ' '.join(parts)
    s = s.replace('90g', '90 g').replace('chedder', 'cheddar').replace('brocolis.palmito', 'brócolis, palmito')
    return s[:1].upper() + s[1:] + '.'


def num(t):
    m = re.findall(r'R\$\s*([\d.]+,\d{2})', t)
    return float(m[-1].replace('.', '').replace(',', '.')) if m else 0


def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def opcao_nome(n):
    low = n.lower()
    if low.startswith(('sem ', 'com ')):
        t = ' '.join(FIX.get(w, w) for w in low.split(' '))
        return t[:1].upper() + t[1:]
    t = titulo(n)
    return t[:1] + t[1:].lower() if ' ' in t else t


GT = {'Maionese?': 'Maionese', 'Adicional': 'Adicionais', 'Adicionais de Pastéis': 'Adicionais',
      'Escolha o Tamanho do Pastel': 'Tamanho', 'TAMANHO': 'Tamanho'}
grupos, gkey = {}, {}


def reg(g):
    t = GT.get(g['titulo'], g['titulo'])
    t = t[:1].upper() + t[1:]
    tipos = {o['tipo'] for o in g['opcoes']}
    unico = 'radio' in tipos
    d = {'titulo': t, 'tipo': 'unico' if unico else 'multi', 'obrigatorio': bool(g['min']),
         'modo': 'preco' if re.search('tamanho', t, re.I) else 'soma',
         'max': None if unico else (g['max'] or None),
         'opcoes': [[opcao_nome(o['nome']), o['preco']] for o in g['opcoes']]}
    k = json.dumps(d, ensure_ascii=False, sort_keys=True)
    if k not in gkey:
        base = slug(t)[:12] or 'g'
        n, i = base, 2
        while n in grupos:
            n = f'{base}{i}'
            i += 1
        gkey[k] = n
        grupos[n] = d
    return gkey[k]


CAT = {
    'Lanches': ('lanches', 'Lanches', 'Lanches', 'Pão francês ou de hambúrguer, maionese do seu jeito e mais de 20 adicionais.'),
    'Pastéis': ('pasteis', 'Pastéis', 'Pastéis', 'Cada sabor sai em 20 cm ou 30 cm. Escolha o recheio e turbine com adicionais.'),
    'Pastéis Doces': ('doces', 'Pastéis doces', 'Doces', 'Também em 20 cm ou 30 cm, com coberturas extras.'),
    'Porções de Fritas': ('porcoes', 'Porções', 'Porções', 'Batata, mandioca, polenta e anéis de cebola.'),
    'Açaí': ('acai', 'Açaí', 'Açaí', 'De 300 ml a 1 litro, com mais de 20 complementos.'),
    'Bebidas': ('bebidas', 'Bebidas', 'Bebidas', 'Refrigerantes em lata, 600 ml e 2 litros, suco e água.'),
    'Balas e Doces': ('balas', 'Balas e chocolates', 'Balas', 'Para levar junto com o pedido.'),
}
ORDEM = ['Lanches', 'Pastéis', 'Pastéis Doces', 'Porções de Fritas', 'Açaí', 'Bebidas', 'Balas e Doces']
SUBS = [('Carne', r'^carne'), ('Frango', r'^frango'), ('Pizza', r'^pizza'), ('Calabresa', r'^calabresa'),
        ('Palmito', r'^palmito'), ('Purê bacon', r'^purê bacon'), ('Brócolis', r'^brócolis'), ('Queijos', r'queijo|minas')]
DESTAQUES = {'X-Tudo', 'X-Big Tudo', 'X-Bacon', 'Galinhão', 'Real Salgado', 'Pastel de Hambúrguer', 'Carne Purê Catupiry',
             'Açaí 500 ml', 'Porção de Batata Frita com Queijo, Cheddar e Bacon', 'Real Doce', 'Creme de Avelã', 'Pernil com Vinagrete'}
EXCLUI = {'vinagrete', 'kitkat'}

cats = {c: [] for c in ORDEM}
ids = set()
for p in P:
    if p['nome'].strip().lower() in EXCLUI:
        continue
    nome = titulo(p['nome'])
    if nome.lower().startswith('kitkat chocolate'):
        nome = 'KitKat Chocolate Branco'
    desc = frase(p['desc']) if p['desc'] else ''
    if p['nome'].strip() == 'TRIDENT':
        desc = 'Chiclete. Consulte os sabores disponíveis.'
    if desc.lower() in ('doce.', 'chocolate.'):
        desc = ''
    gs = [reg(g) for g in p['grupos'] if g['opcoes']]
    preco = num(p['preco'])
    apartir = 'partir' in p['preco']
    if apartir:
        tam = [grupos[k] for k in gs if grupos[k]['modo'] == 'preco']
        if tam:
            preco = min(o[1] for o in tam[0]['opcoes'])
    i = slug(nome)
    while i in ids:
        i += '-2'
    ids.add(i)
    it = {'id': i, 'nome': nome, 'desc': desc, 'preco': preco}
    if apartir:
        it['apartir'] = True
    if p['pid'] in M:
        it['img'] = M[p['pid']]
    if gs:
        it['grupos'] = gs
    if nome in DESTAQUES:
        it['destaque'] = True
    if p['cat'] == 'Pastéis':
        low = nome.lower()
        sub = 'Especiais'
        for s, rx in SUBS:
            if re.search(rx, low):
                sub = s
                break
        it['sub'] = sub
    cats[p['cat']].append(it)

subord = [s for s, _ in SUBS] + ['Especiais']
cats['Pastéis'].sort(key=lambda x: subord.index(x['sub']))
out = []
for c in ORDEM:
    cid, nome, curto, desc = CAT[c]
    out.append({'id': cid, 'nome': nome, 'curto': curto, 'desc': desc, 'itens': cats[c]})


import unicodedata as _u
_B = json.load(open('bairros.json', encoding='utf-8'))
def _bt(t):
    t = re.sub(r'\s+', ' ', t.strip())
    ws = t.lower().split(' ')
    out = []
    for i, w in enumerate(ws):
        if i and w in PEQ: out.append(w)
        elif w.startswith('('): out.append('(' + w[1:2].upper() + w[2:])
        else: out.append(w[:1].upper() + w[1:])
    return ' '.join(out).replace('( ', '(').replace(' )', ')').replace('Jd ', 'Jd. ')
def _k(t): return _u.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
BAIRROS = {}
for cid, lst in _B.items():
    seen = {}
    for b in lst:
        if b.get('is_desabilitar'): continue
        nome = _bt(b['titulo'])
        if _k(nome) in seen: continue
        seen[_k(nome)] = [nome, float(b['valor'])]
    BAIRROS[cid] = sorted(seen.values(), key=lambda x: _k(x[0]))

LOJA = {
    'nome': 'Real Lanches', 'nomeCompleto': 'Real Lanches Pastéis & Açaí', 'slogan': 'Lanches, pastéis & açaí',
    'bairro': 'Parque Santo Antônio', 'cidade': 'Taubaté · SP',
    'endereco': 'R. Emíliano Scacheti, 47 · Parque Santo Antônio', 'cep': '12061-150',
    'telefone': '(12) 3413-1565', 'telefoneLink': '1234131565',
    'whatsapp': '5512992107930', 'whatsappTexto': '(12) 99210-7930',
    'instagram': 'real.pqstoantonio', 'facebook': 'reallanchesepasteis',
    'pedidosOnline': 'https://realstoantonio.gigapedidos.com.br/',
    'mapa': 'https://www.google.com/maps/dir//Real+Lanches+Past%C3%A9is+%26+A%C3%A7a%C3%AD,+R.+Em%C3%ADliano+Scacheti,+47+-+Parque+Santo+Antonio,+Taubat%C3%A9+-+SP,+12061-150',
    'mapaEmbed': 'https://www.google.com/maps?q=Real+Lanches+Past%C3%A9is+%26+A%C3%A7a%C3%AD,+R.+Em%C3%ADliano+Scacheti,+47,+Taubat%C3%A9+-+SP&output=embed',
    'avaliar': 'https://g.page/r/CYHYzI1hiJEAEB0/review',
    'nota': '4,7', 'avaliacoes': '840',
    'entrega': {'taxa': 'R$ 3,00 a R$ 8,00', 'tempo': 'cerca de 45 min', 'retirada': 'cerca de 25 min'},
    'horarios': {'0': [], '1': [['19:00', '00:00']], '2': [['19:00', '00:00']], '3': [['19:00', '00:00']],
                 '4': [['19:00', '00:00']], '5': [['19:00', '00:00']], '6': [['19:00', '00:00']]},
    'acessibilidade': 'Entrada e assentos acessíveis para cadeira de rodas',
    'whatsapp2': '5512997651565', 'whatsapp2Texto': '(12) 99765-1565',
    'pedidoPor': 'whatsapp',
    'pagamentos': ['Dinheiro', 'Cartão de crédito', 'Cartão de débito'],
    'pagamentoNota': 'Na entrega, o entregador leva a máquina do cartão.',
    'cidadesEntrega': BAIRROS,
    'fotos': {'logo': 'fotos/local/logo-real.jpg', 'pasteis': 'fotos/local/banner-pasteis.jpg',
              'lanche': 'fotos/local/lanche-banner-real.jpg', 'acai': 'fotos/local/acai-morango-banana.jpg',
              'fachada': 'fotos/local/fachada-dia.jpg'},
    'galeriaLocal': [
        ['fotos/local/banner-pasteis.jpg', 'Pastéis e porções', 'Real Lanches (página de links)'],
        ['fotos/local/lanche-banner-real.jpg', 'Lanche no pão francês', 'Real Lanches no Google Maps'],
        ['fotos/local/acai-morango-banana.jpg', 'Açaí com morango e banana', 'Real Lanches no Google Maps'],
        ['fotos/local/pastel-embrulhado.jpg', 'Pastel para viagem', 'Ivan Ferreira no Google Maps'],
        ['fotos/local/acai-copos.jpg', 'Açaí no copo', 'Wanderleia Vitor no Google Maps'],
        ['fotos/local/lanches-cesta.jpg', 'Lanches na cesta', 'carla souza no Google Maps'],
        ['fotos/local/acai-morangos.jpg', 'Açaí com morangos', 'cliente no Google Maps'],
        ['fotos/local/fachada-dia.jpg', 'Fachada de dia', 'cliente no Google Maps'],
        ['fotos/local/fachada-noite-2017.jpg', 'Fachada à noite', 'Sócrates Delleon no Google Maps'],
    ],
}

js = ('/* ==========================================================================\n'
      '   DADOS DO SITE · Real Lanches Pastéis & Açaí (Taubaté/SP)\n'
      '   Gerado em 19/10/2026 a partir do cardápio online (Giga Pedidos), da página\n'
      '   de links (golinks) e do Google Maps. Preços e opções iguais aos de lá.\n'
      '   Para editar: troque textos e preços abaixo. "grupos" aponta para GRUPOS.\n'
      '   ========================================================================== */\n')
js += 'window.LOJA = ' + json.dumps(LOJA, ensure_ascii=False, indent=1) + ';\n\n'
js += 'window.GRUPOS = ' + json.dumps(grupos, ensure_ascii=False) + ';\n\n'
js += 'window.CATEGORIAS = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
open(OUT, 'w', encoding='utf-8').write(js)

print({c['id']: len(c['itens']) for c in out}, 'grupos:', len(grupos))
print([(k, v['titulo'], v['tipo'], v['modo'], v['max'], len(v['opcoes'])) for k, v in grupos.items()])
print([i['nome'] for c in out for i in c['itens'] if i.get('destaque')])
print([(i['nome'], i['sub']) for i in out[1]['itens'] if i['sub'] == 'Especiais'])
print([i['nome'] + ' | ' + i['desc'][:60] for i in out[0]['itens'][:4]])
print('sem foto:', [i['nome'] for c in out for i in c['itens'] if 'img' not in i])
print({k:len(v) for k,v in BAIRROS.items()}, BAIRROS['Taubaté'][:8], BAIRROS['Tremembé'][:6])
