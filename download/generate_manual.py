#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manual do Operador - CaixaFacil
Geracao do PDF via ReportLab
"""

import os, sys, hashlib

# Setup PDF skill path
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
_scripts = os.path.join(PDF_SKILL_DIR, "scripts")
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, CondPageBreak, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ─── Font Registration ───
pdfmetrics.registerFont(TTFont('NotoSansSC', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSCBold', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', '/usr/share/fonts/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('CarlitoBold', '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSansSC', normal='NotoSansSC', bold='NotoSansSCBold')
registerFontFamily('Carlito', normal='Carlito', bold='CarlitoBold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# Font fallback for mixed content
try:
    from pdf import install_font_fallback
    install_font_fallback()
except:
    pass

# ─── Cascade Palette (auto-generated) ───
PAGE_BG       = colors.HexColor('#eff0f0')
SECTION_BG    = colors.HexColor('#e9ebec')
CARD_BG       = colors.HexColor('#e4e7e8')
TABLE_STRIPE  = colors.HexColor('#f3f4f5')
HEADER_FILL   = colors.HexColor('#4d626d')
COVER_BLOCK   = colors.HexColor('#44545c')
BORDER        = colors.HexColor('#b7c2c7')
ICON          = colors.HexColor('#3d6579')
ACCENT        = colors.HexColor('#c8233e')
ACCENT_2      = colors.HexColor('#9057ba')
TEXT_PRIMARY   = colors.HexColor('#171919')
TEXT_MUTED     = colors.HexColor('#737a7d')
SEM_SUCCESS   = colors.HexColor('#3e8656')
SEM_WARNING   = colors.HexColor('#a98847')
SEM_ERROR     = colors.HexColor('#98554f')
SEM_INFO      = colors.HexColor('#456e97')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ─── Page dimensions ───
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 1.0 * inch
RIGHT_MARGIN = 1.0 * inch
TOP_MARGIN = 0.85 * inch
BOTTOM_MARGIN = 0.85 * inch
AVAILABLE_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ─── Styles ───
styles = {}

styles['title'] = ParagraphStyle(
    name='Title', fontName='Carlito', fontSize=22, leading=28,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceBefore=0, spaceAfter=12,
)

styles['h1'] = ParagraphStyle(
    name='H1', fontName='Carlito', fontSize=18, leading=24,
    textColor=ACCENT, alignment=TA_LEFT, spaceBefore=18, spaceAfter=10,
)

styles['h2'] = ParagraphStyle(
    name='H2', fontName='Carlito', fontSize=14, leading=20,
    textColor=HEADER_FILL, alignment=TA_LEFT, spaceBefore=14, spaceAfter=8,
)

styles['h3'] = ParagraphStyle(
    name='H3', fontName='Carlito', fontSize=12, leading=17,
    textColor=ICON, alignment=TA_LEFT, spaceBefore=10, spaceAfter=6,
)

styles['body'] = ParagraphStyle(
    name='Body', fontName='Carlito', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceBefore=0, spaceAfter=6,
)

styles['body_indent'] = ParagraphStyle(
    name='BodyIndent', fontName='Carlito', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceBefore=0, spaceAfter=6,
    leftIndent=20,
)

styles['bullet'] = ParagraphStyle(
    name='Bullet', fontName='Carlito', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceBefore=2, spaceAfter=2,
    leftIndent=20, bulletIndent=8, bulletFontSize=10.5,
)

styles['note'] = ParagraphStyle(
    name='Note', fontName='Carlito', fontSize=10, leading=16,
    textColor=SEM_INFO, alignment=TA_LEFT, spaceBefore=6, spaceAfter=6,
    leftIndent=16, borderLeftWidth=3, borderLeftColor=SEM_INFO,
    borderPadding=8,
)

styles['warning'] = ParagraphStyle(
    name='Warning', fontName='Carlito', fontSize=10, leading=16,
    textColor=SEM_WARNING, alignment=TA_LEFT, spaceBefore=6, spaceAfter=6,
    leftIndent=16, borderLeftWidth=3, borderLeftColor=SEM_WARNING,
    borderPadding=8,
)

styles['tip'] = ParagraphStyle(
    name='Tip', fontName='Carlito', fontSize=10, leading=16,
    textColor=SEM_SUCCESS, alignment=TA_LEFT, spaceBefore=6, spaceAfter=6,
    leftIndent=16, borderLeftWidth=3, borderLeftColor=SEM_SUCCESS,
    borderPadding=8,
)

styles['table_header'] = ParagraphStyle(
    name='TableHeader', fontName='Carlito', fontSize=10,
    textColor=colors.white, alignment=TA_CENTER,
)

styles['table_cell'] = ParagraphStyle(
    name='TableCell', fontName='Carlito', fontSize=9.5,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)

styles['table_cell_center'] = ParagraphStyle(
    name='TableCellCenter', fontName='Carlito', fontSize=9.5,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)

styles['toc_h1'] = ParagraphStyle(
    name='TOCH1', fontName='Carlito', fontSize=13, leading=22,
    leftIndent=20, textColor=TEXT_PRIMARY,
)

styles['toc_h2'] = ParagraphStyle(
    name='TOCH2', fontName='Carlito', fontSize=11, leading=18,
    leftIndent=40, textColor=TEXT_MUTED,
)

# ─── Helper functions ───

def heading(text, level=1):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    style = styles.get(f'h{level}', styles['h2'])
    p = Paragraph(f'<a name="{key}"/><b>{text}</b>', style)
    p.bookmark_name = text
    p.bookmark_level = level - 1
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def body(text):
    return Paragraph(text, styles['body'])

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', styles['bullet'])

def note(text):
    return Paragraph(text, styles['note'])

def warning(text):
    return Paragraph(text, styles['warning'])

def tip(text):
    return Paragraph(text, styles['tip'])

def make_table(headers, rows, col_ratios=None):
    """Create a styled table with Paragraph cells."""
    if col_ratios is None:
        col_ratios = [1.0 / len(headers)] * len(headers)
    col_widths = [r * AVAILABLE_W for r in col_ratios]

    data = []
    header_row = [Paragraph(f'<b>{h}</b>', styles['table_header']) for h in headers]
    data.append(header_row)

    for row in rows:
        data_row = [Paragraph(str(cell), styles['table_cell']) for cell in row]
        data.append(data_row)

    table = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    # Alternating row colors
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    table.setStyle(TableStyle(style_cmds))
    return table


# ─── TOC DocTemplate ───

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


H1_ORPHAN = (PAGE_H - TOP_MARGIN - BOTTOM_MARGIN) * 0.15

def add_major_section(text):
    return [
        CondPageBreak(H1_ORPHAN),
        heading(text, level=1),
    ]

def add_sub_section(text):
    return heading(text, level=2)

def add_sub_sub_section(text):
    return heading(text, level=3)


# ─── Build Story ───

OUTPUT_DIR = "/home/z/my-project/download"
BODY_PDF = os.path.join(OUTPUT_DIR, "manual_body.pdf")
FINAL_PDF = os.path.join(OUTPUT_DIR, "Manual_do_Operador_CaixaFacil.pdf")

doc = TocDocTemplate(
    BODY_PDF,
    pagesize=A4,
    leftMargin=LEFT_MARGIN,
    rightMargin=RIGHT_MARGIN,
    topMargin=TOP_MARGIN,
    bottomMargin=BOTTOM_MARGIN,
)

story = []

# ─── TOC ───
toc = TableOfContents()
toc.levelStyles = [styles['toc_h1'], styles['toc_h2']]
story.append(Paragraph('<b>Sumario</b>', styles['title']))
story.append(Spacer(1, 12))
story.append(toc)
story.append(PageBreak())


# ═══════════════════════════════════════════════════════════
# CAPITULO 1: Introducao
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('1. Introducao ao CaixaFacil'))

story.append(body(
    'O <b>CaixaFacil</b> e um sistema completo de gestao empresarial desenvolvido especialmente '
    'para empresas que operam maquinas de entretenimento, como fliperamas, sinucas, jukeboxes '
    'e outros equipamentos similares. A plataforma funciona como um SaaS (Software as a Service) '
    'multi-tenant, o que significa que cada empresa possui seus dados isolados e protegidos, '
    'garantindo privacidade e seguranca das informacoes.'
))
story.append(body(
    'O sistema e acessivel tanto por computadores (via navegador web) quanto por dispositivos '
    'moveis, sendo uma PWA (Progressive Web App) que pode ser instalada na tela inicial do '
    'celular como um aplicativo nativo. Isso proporciona uma experiencia fluida tanto no escritorio '
    'quanto em campo, durante as visitas de cobranca aos clientes.'
))
story.append(body(
    'Com o CaixaFacil, voce pode gerenciar clientes, maquinas, leituras de cobranca, pagamentos, '
    'fluxo de caixa, gerar relatorios financeiros e ainda contar com um assistente de inteligencia '
    'artificial integrado que ajuda a responder perguntas e executar acoes diretamente pelo chat.'
))

story.append(add_sub_section('1.1 Principais Funcionalidades'))
story.append(body(
    'A tabela abaixo resume os modulos principais do sistema e sua funcao dentro da operacao diaria:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Modulo', 'Descricao', 'Acesso'],
    [
        ['Dashboard', 'Visao geral com indicadores financeiros, alertas e resumos', 'Todos'],
        ['Clientes', 'Cadastro completo de clientes com dados de contato e localizacao', 'Todos'],
        ['Maquinas', 'Gestao de equipamentos vinculados a clientes', 'Todos'],
        ['Tipos de Maquina', 'Categorizacao dos equipamentos (fliperama, sinuca, etc.)', 'Admin'],
        ['Cobranca', 'Coleta de leituras e geracao de debitos automaticos', 'Supervisor+'],
        ['Pagamentos', 'Controle de pagamentos com status e vencimentos', 'Todos'],
        ['Fluxo de Caixa', 'Contas a pagar e receber com resumo financeiro', 'Todos'],
        ['Relatorios', 'Extratos detalhados por periodo e cliente', 'Todos'],
        ['Usuarios', 'Gerenciamento da equipe com niveis de acesso', 'Admin'],
        ['Assinatura', 'Gestao do plano SaaS da empresa', 'Todos'],
        ['Backup', 'Backup completo e restauracao dos dados', 'Admin'],
        ['Chat IA', 'Assistente com inteligencia artificial integrada', 'Todos'],
    ],
    [0.28, 0.48, 0.24]
))
story.append(Spacer(1, 6))
story.append(Paragraph('Tabela 1: Modulos do sistema CaixaFacil', ParagraphStyle(
    name='Caption', fontName='Carlito', fontSize=9, textColor=TEXT_MUTED,
    alignment=TA_CENTER, spaceBefore=3, spaceAfter=6,
)))

story.append(add_sub_section('1.2 Niveis de Acesso'))
story.append(body(
    'O sistema possui tres niveis de acesso que definem o que cada usuario pode fazer dentro da plataforma. '
    'O administrador da empresa e responsavel por criar usuarios e atribuir seus niveis de permissao. '
    'Essa estrutura garante que operadores tenham acesso apenas as funcoes necessarias para seu trabalho '
    'diario, protegendo dados sensiveis e acoes destrutivas.'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Nivel', 'Permissoes'],
    [
        ['OPERADOR', 'Visualizar dashboards, clientes, maquinas, pagamentos, relatorios e fluxo de caixa'],
        ['SUPERVISOR', 'Tudo do Operador + criar/editar clientes, registrar leituras de cobranca, marcar pagamentos'],
        ['ADMINISTRADOR', 'Acesso total: usuarios, tipos de maquina, backup/restore, configuracoes avancadas'],
    ],
    [0.25, 0.75]
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 2: Primeiros Passos
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('2. Primeiros Passos'))

story.append(add_sub_section('2.1 Acessando o Sistema'))
story.append(body(
    'Para acessar o CaixaFacil, abra o navegador de internet (Chrome, Firefox, Edge ou Safari) '
    'e digite o endereco do sistema. Na tela inicial, voce vera a opcao de selecionar uma empresa '
    'ja salva ou adicionar uma nova. O sistema memoriza as empresas acessadas recentemente no '
    'navegador, facilitando o acesso rapido nas proximas vezes.'
))
story.append(body(
    'O fluxo de login funciona da seguinte maneira: primeiro, selecione a empresa com a qual deseja '
    'trabalhar (ou cadastre uma nova). Em seguida, insira seu email e senha de acesso. Caso seja '
    'o primeiro acesso de uma empresa recem-criada, o sistema concede automaticamente um periodo '
    'de teste gratuito de 7 dias para que voce possa explorar todas as funcionalidades antes de '
    'escolher um plano de assinatura.'
))

story.append(add_sub_section('2.2 Criando uma Nova Empresa'))
story.append(body(
    'Se voce e um novo usuario, clique no botao <b>"Nova Empresa"</b> na tela de selecao. '
    'Preencha os campos obrigatorios: nome da empresa, email do administrador, senha (minimo '
    'de 6 caracteres) e telefone opcional. Apos o cadastro, o sistema cria automaticamente '
    'seu usuario como Administrador da empresa e inicia o periodo de teste gratuito. Voce '
    'sera redirecionado diretamente para o Dashboard principal.'
))

story.append(add_sub_section('2.3 Navegacao'))
story.append(body(
    'A interface do CaixaFacil foi projetada com foco em usabilidade, especialmente para '
    'dispositivos moveis. A navegacao e organizada de duas formas complementares:'
))
story.append(bullet(
    '<b>Barra inferior (Mobile):</b> Cinco abas de acesso rapido no rodape da tela: '
    'Inicio (Dashboard), Clientes, Cobranca, Financeiro e Assinatura. Essa barra e '
    'ideal para operacoes rapidas no dia a dia.'
))
story.append(bullet(
    '<b>Menu lateral (Hamburguer):</b> Acesse pelo icone de tres linhas no canto superior '
    'esquerdo. Este menu expandido mostra todas as opcoes disponiveis, incluindo modulos '
    'avancados como Tipos de Maquina, Usuarios, Backup, Relatorios e configuracoes do sistema.'
))
story.append(bullet(
    '<b>Tema visual:</b> O sistema suporta modo claro e modo escuro. Alterne o tema pelo '
    'menu lateral. A escolha e salva automaticamente no seu navegador.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 3: Dashboard
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('3. Dashboard'))

story.append(body(
    'O Dashboard e a tela principal do sistema e a primeira que voce ve ao fazer login. '
    'Ele oferece uma visao panoramica e consolidada de todos os indicadores importantes '
    'da sua empresa, permitindo tomar decisoes rapidas sem precisar navegar por varios modulos. '
    'Os dados sao atualizados em tempo real a cada acesso, refletindo o estado atual das operacoes.'
))

story.append(add_sub_section('3.1 Cartoes de Indicadores (KPIs)'))
story.append(body(
    'Na parte superior do Dashboard, quatro cartoes coloridos exibem os principais indicadores '
    'do seu negocio:'
))
story.append(bullet(
    '<b>Clientes Ativos:</b> Mostra a quantidade de clientes ativos em relacao ao total cadastrado. '
    'Este cartao usa um gradiente verde para facilitar a identificacao visual.'
))
story.append(bullet(
    '<b>Maquinas Ativas:</b> Exibe o numero de maquinas em operacao versus o total. '
    'O cartao azul permite visualizar rapidamente a capacidade instalada da empresa.'
))
story.append(bullet(
    '<b>A Receber:</b> Apresenta o valor total de contas pendentes de recebimento em formato '
    'monetario, acompanhado da quantidade de itens pendentes. Gradiente em tons de ambarlo alerta '
    'sobre valores a cobrar.'
))
story.append(bullet(
    '<b>Recebido (Mes):</b> Exibe o total recebido no mes corrente, com gradiente verde '
    'para indicar positivamente o desempenho financeiro atual.'
))

story.append(add_sub_section('3.2 Alertas'))
story.append(body(
    'A secao de alertas aparece condicionalmente quando ha situacoes que exigem atencao. '
    'O sistema monitora automaticamente tres tipos de alertas:'
))
story.append(bullet(
    '<b>Clientes bloqueados:</b> Indica quantos clientes estao com acesso bloqueado, '
    'exigindo intervencao do supervisor ou administrador para desbloqueio.'
))
story.append(bullet(
    '<b>Pagamentos em atraso:</b> Mostra a quantidade de pagamentos que ultrapassaram a data '
    'de vencimento sem serem liquidados. Esses itens aparecem em vermelho para chamara atencao.'
))
story.append(bullet(
    '<b>Maquinas em manutencao:</b> Lista maquinas que estao temporariamente fora de operacao, '
    'ajudando a controlar o retorno equipamentos a atividade.'
))

story.append(add_sub_section('3.3 Graficos e Resumos'))
story.append(body(
    'Abaixo dos indicadores e alertas, o Dashboard exibe um grafico de barras mostrando a '
    'distribuicao de maquinas por tipo (fliperama, sinuca, jukebox, etc.), permitindo '
    'visualizar a composicao do parque de equipamentos da empresa. Segue-se uma lista dos '
    'pagamentos recentes e dos clientes cadastrados mais recentes, facilitando o acesso '
    'rapido as informacoes mais relevantes do momento.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 4: Gestao de Clientes
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('4. Gestao de Clientes'))

story.append(body(
    'O modulo de Clientes e o coracao do relacionamento comercial da sua empresa. Aqui voce '
    'cadastra e gerencia todas as informacoes dos locais onde suas maquinas estao instaladas, '
    'incluindo dados de contato, localizacao, observacoes e o percentual de acerto (divisao de '
    'renda) de cada cliente. Um cadastro bem mantido e fundamental para a precisao das cobranças '
    'e a qualidade do atendimento.'
))

story.append(add_sub_section('4.1 Cadastrando um Cliente'))
story.append(body(
    'Para cadastrar um novo cliente, acesse o menu lateral e selecione <b>Clientes</b>. '
    'Clique no botao de adicionar (geralmente representado pelo simbolo de "+") para abrir o '
    'formulario de cadastro. Os campos disponiveis sao:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Campo', 'Tipo', 'Obrigatorio', 'Descricao'],
    [
        ['Nome', 'Texto', 'Sim', 'Razao social ou nome do estabelecimento'],
        ['CPF/CNPJ', 'Texto', 'Nao', 'Documento de identificacao fiscal'],
        ['Email', 'Texto', 'Nao', 'Endereco de email para contato'],
        ['Telefone 1', 'Texto', 'Nao', 'Telefone principal de contato'],
        ['Telefone 2', 'Texto', 'Nao', 'Telefone secundario'],
        ['Endereco', 'Texto', 'Nao', 'Rua, numero e complemento'],
        ['Cidade', 'Texto', 'Nao', 'Cidade onde se localiza'],
        ['Estado / CEP', 'Texto', 'Nao', 'Sigla do estado e CEP'],
        ['Observacoes', 'Texto', 'Nao', 'Anotacoes gerais sobre o cliente'],
        ['WhatsApp Grupo', 'Texto', 'Nao', 'Link do grupo WhatsApp para fotos de leitura'],
        ['Acerto Percentual', 'Numero', 'Nao', 'Percentual de divisao de renda (padrao 50%)'],
    ],
    [0.22, 0.10, 0.12, 0.56]
))
story.append(Spacer(1, 18))

story.append(add_sub_section('4.2 Editando e Bloqueando Clientes'))
story.append(body(
    'Para editar as informacoes de um cliente existente, clique no cartao do cliente desejado '
    'e altere os campos necessarios. Supervisores e administradores tambem podem bloquear '
    'clientes clicando na opcao correspondente. Ao bloquear, o sistema pede um motivo, que '
    'ficara registrado e sera exibido no cartao do cliente com um fundo vermelho e o selo '
    '"Bloqueado". Clientes bloqueados nao aparecem na selecao de cobranca.'
))
story.append(tip(
    '<b>Dica:</b> Utilize o campo "Observacoes" para registrar informacoes uteis como horario '
    'de funcionamento, nome do responsavel no local ou particularidades do contrato.'
))

story.append(add_sub_section('4.3 Excluindo Clientes'))
story.append(warning(
    '<b>Atencao:</b> A exclusao de clientes e uma acao irreversivel disponivel apenas para '
    'administradores. Antes de excluir, certifique-se de que nao ha maquinas vinculadas ou '
    'debitos pendentes vinculados ao cliente.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 5: Gestao de Maquinas
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('5. Gestao de Maquinas'))

story.append(body(
    'O modulo de Maquinas permite gerenciar todo o parque de equipamentos da sua empresa. '
    'Cada maquina e vinculada a um cliente e a um tipo de maquina, e possui informacoes detalhadas '
    'como codigo de identificacao, marca, modelo, numero de serie, valor mensal, localizacao '
    'fisica, tipo de moeda e as leituras atuais de entrada e saida. A gestao eficiente das '
    'maquinas e essencial para o controle financeiro e operacional do negocio.'
))

story.append(add_sub_section('5.1 Status das Maquinas'))
story.append(body(
    'Cada maquina pode estar em um dos quatro status possiveis, identificados visualmente '
    'por cores no sistema:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Status', 'Cor', 'Descricao'],
    [
        ['ATIVA', 'Padrao (normal)', 'Maquina em operacao normal, gerando receita'],
        ['INATIVA', 'Cinza', 'Maquina desligada ou removida do local temporariamente'],
        ['MANUTENCAO', 'Ambar', 'Maquina aguardando reparo ou em conserto'],
        ['VENDIDA', 'Vermelho', 'Maquina que foi vendida e nao pertence mais ao inventario'],
    ],
    [0.20, 0.30, 0.50]
))
story.append(Spacer(1, 18))

story.append(add_sub_section('5.2 Cadastrando uma Maquina'))
story.append(body(
    'O cadastro de maquinas esta disponivel apenas para administradores. Acesse o menu lateral, '
    'selecione <b>Maquinas</b> e clique no botao de adicionar. Os campos obrigatorios sao: '
    '<b>Codigo</b> (identificador unico por cliente), <b>Tipo de Maquina</b> (selecione entre '
    'os tipos cadastrados) e <b>Cliente</b> (selecione o proprietario do local). Alem desses, '
    'voce pode preencher campos complementares como descricao, marca, modelo, numero de serie, '
    'valor mensal do aluguel, localizacao fisica, tipo de moeda aceita e observacoes.'
))

story.append(add_sub_section('5.3 Filtros'))
story.append(body(
    'Para facilitar a localizacao de maquinas especificas, o modulo oferece dois filtros na '
    'parte superior da lista: um filtro por tipo de maquina (dropdown) e outro por status '
    '(Ativa, Inativa, Manutencao, Vendida). Combine os filtros para encontrar rapidamente '
    'o grupo de equipamentos desejado.'
))

story.append(add_sub_section('5.4 Tipos de Moeda'))
story.append(body(
    'O campo "Moeda" define o tipo de moeda que a maquina aceita e e utilizado no calculo '
    'automatico dos valores de cobranca. Os tipos disponiveis sao:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Codigo', 'Valor (R$)', 'Descricao'],
    [
        ['M001', 'R$ 0,01', 'Moeda de 1 centavo'],
        ['M005', 'R$ 0,05', 'Moeda de 5 centavos'],
        ['M010', 'R$ 0,10', 'Moeda de 10 centavos'],
        ['M025', 'R$ 0,25', 'Moeda de 25 centavos'],
    ],
    [0.20, 0.25, 0.55]
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 6: Tipos de Maquina
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('6. Tipos de Maquina'))

story.append(body(
    'O modulo de Tipos de Maquina permite criar categorias para classificar seus equipamentos. '
    'Essa categorizacao e fundamental para a organizacao do sistema, influenciando tanto a '
    'listagem de maquinas quanto os graficos do Dashboard. Exemplos comuns de tipos incluem: '
    'Fliperama, Sinuca, Jukebox, Video Game, Bilhar, among others.'
))
story.append(body(
    'Acesso a este modulo e restrito a administradores. Para cada tipo, voce define: '
    '<b>Descricao</b> (nome do tipo, unico por empresa), <b>Nome da Entrada</b> (rotulo para '
    'a leitura de entrada, padrao "E"), <b>Nome da Saida</b> (rotulo para a leitura de saida, '
    'padrao "S"), <b>Classe</b> (primaria ou secundaria) e o <b>Status</b> (ativo ou inativo). '
    'A classe permite organizar os tipos em hierarquias, onde tipos primarios sao as categorias '
    'principais e secundarios sao subcategorias.'
))
story.append(note(
    '<b>Importante:</b> Nao e possivel excluir um tipo de maquina que tenha maquinas vinculadas. '
    'Desative o tipo (marque como inativo) em vez de exclui-lo.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 7: Cobranca (Leituras)
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('7. Cobranca (Leituras)'))

story.append(body(
    'O modulo de Cobranca e o nucleo operacional do CaixaFacil. E aqui que voce registra as '
    'leituras dos contadores das maquinas, calcula os valores a cobrar e gera automaticamente '
    'os debitos no Fluxo de Caixa. Este processo e fundamental para o faturamento da empresa '
    'e deve ser realizado com precisao em cada visita ao cliente.'
))

story.append(add_sub_section('7.1 Fluxo de Cobranca Passo a Passo'))
story.append(body(
    'O processo de cobranca segue uma sequencia logica que o sistema guia automaticamente:'
))
story.append(bullet(
    '<b>Passo 1 - Selecionar o Cliente:</b> No dropdown de clientes, escolha aquele que deseja '
    'cobrar. Apenas clientes ativos e nao bloqueados aparecem na lista.'
))
story.append(bullet(
    '<b>Passo 2 - Carregar Maquinas:</b> Apos selecionar o cliente, o sistema carrega '
    'automaticamente todas as maquinas vinculadas a ele, exibindo as leituras atuais '
    '(entrada e saida) de cada equipamento.'
))
story.append(bullet(
    '<b>Passo 3 - Inserir Novas Leitura:</b> Para cada maquina, digite os novos valores '
    'de entrada e saida lidos no equipamento. O sistema valida automaticamente se os '
    'novos valores sao maiores que os anteriores, impedindo erros de digitacao.'
))
story.append(bullet(
    '<b>Passo 4 - Calculo Automatico:</b> O sistema calcula a diferenca entre as leituras '
    'e converte em valor monetario com base no tipo de moeda configurado para a maquina.'
))
story.append(bullet(
    '<b>Passo 5 - Despesas Extras:</b> Opcionalmente, registre despesas adicionais com '
    'descricao e valor.'
))
story.append(bullet(
    '<b>Passo 6 - Saldo Anterior:</b> O sistema carrega automaticamente os debitos em aberto '
    'do cliente no Fluxo de Caixa, somando ao saldo anterior.'
))
story.append(bullet(
    '<b>Passo 7 - Valor Recebido:</b> Informe o valor em dinheiro recebido no local, se houver.'
))
story.append(bullet(
    '<b>Passo 8 - Confirmar:</b> Ao salvar, o sistema registra as leituras, atualiza os '
    'contadores das maquinas, cria um registro de debito no Fluxo de Caixa e exibe um '
    'resumo com todos os valores calculados.'
))

story.append(add_sub_section('7.2 Captura de Fotos e IA (OCR)'))
story.append(body(
    'Uma das funcionalidades mais avancadas do CaixaFacil e a capacidade de ler os contadores '
    'das maquinas diretamente de fotos, utilizando inteligencia artificial com visao computacional. '
    'Isso elimina a necessidade de digitar manualmente os valores, reduzindo erros e agilizando '
    'o processo de cobranca em campo.'
))
story.append(body(
    'Existem dois modos de captura de fotos:'
))
story.append(bullet(
    '<b>Foto individual:</b> Abra o modal de captura para uma maquina especifica, tire uma foto '
    'do display do equipamento (usando a camera do celular ou selecionando da galeria). '
    'A IA analisa a imagem, extrai os valores de entrada e saida com um indice de confianca, '
    'e voce pode aceitar ou corrigir os valores antes de confirmar.'
))
story.append(bullet(
    '<b>Processamento em lote:</b> Selecione multiplas fotos de uma vez (da camera ou galeria). '
    'O sistema processa cada foto em dois estagios: primeiro, identifica a qual maquina a foto '
    'pertence (lendo etiquetas ou codigos no equipamento); segundo, extrai os valores de leitura '
    'do display. Um indicador de progresso mostra o andamento, e os resultados podem ser '
    'revisados antes de salvar.'
))
story.append(tip(
    '<b>Dica:</b> Para melhores resultados com a leitura por IA, tire fotos com boa iluminacao, '
    'evitando reflexos no display da maquina. Segure o celular estavelmente e enquadre o display '
    'completo na imagem.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 8: Pagamentos
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('8. Pagamentos'))

story.append(body(
    'O modulo de Pagamentos permite acompanhar e gerenciar todos os recebimentos da empresa. '
    'Cada pagamento possui um valor, data de vencimento, data de pagamento efetivo, forma de '
    'pagamento e status. O sistema classifica automaticamente os pagamentos como "Em Atraso" '
    'quando a data de vencimento e ultrapassada sem liquidacao, facilitando o controle da '
    'inadimplencia.'
))

story.append(add_sub_section('8.1 Status dos Pagamentos'))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Status', 'Cor', 'Descricao'],
    [
        ['PENDENTE', 'Ambar', 'Pagamento aguardando liquidacao'],
        ['PAGO', 'Verde', 'Pagamento liquidado com sucesso'],
        ['ATRASADO', 'Vermelho', 'Vencimento ultrapassado sem pagamento'],
        ['CANCELADO', 'Cinza', 'Pagamento cancelado manualmente'],
    ],
    [0.20, 0.20, 0.60]
))
story.append(Spacer(1, 18))

story.append(add_sub_section('8.2 Marcando Pagamentos como Pagos'))
story.append(body(
    'Para marcar um pagamento como pago, localize o pagamento pendente na lista e clique no '
    'botao correspondente (geralmente um icone de check ou o botao "Marcar como Pago"). '
    'Essa acao esta disponivel para usuarios com nivel Supervisor ou superior. O sistema '
    'registra automaticamente a data do pagamento e a forma (padrao: PIX). Voce pode '
    'tambem filtrar os pagamentos por status usando o dropdown na parte superior da tela.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 9: Fluxo de Caixa
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('9. Fluxo de Caixa'))

story.append(body(
    'O Fluxo de Caixa e o modulo financeiro central do sistema, onde voce gerencia todas as '
    'contas a pagar e receber da empresa. As contas sao criadas manualmente ou geradas '
    'automaticamente pelo modulo de Cobranca quando uma leitura e salva. O resumo financeiro '
    'na parte superior da tela exibe os totais de contas a receber, a pagar, o saldo liquido '
    'e o total de itens pendentes.'
))

story.append(add_sub_section('9.1 Criando uma Conta'))
story.append(body(
    'Para criar uma conta manualmente, clique no botao de adicionar e preencha o formulario '
    'com: descricao, valor, data, tipo (A Pagar ou A Receber), cliente vinculado (opcional) '
    'e observacoes. Contas do tipo "A Receber" representam dinheiro que a empresa tem a '
    'receber, enquanto "A Pagar" representam despesas e obrigacoes financeiras.'
))

story.append(add_sub_section('9.2 Liquidando e Desfazendo Lancamentos'))
story.append(body(
    'Para liquidar (marcar como paga) uma conta, simplesmente clique no toggle de status '
    'ao lado do item desejado. A conta passara de "Pendente" para "Paga" e o sistema '
    'registrara a data de pagamento automaticamente. Se necessario, voce pode reverter '
    'a operacao clicando novamente no toggle, voltando a conta para o status pendente. '
    'O filtro por tipo (Todos, A Receber, A Pagar) e por cliente ajuda a localizar '
    'rapidamente os lancamentos desejados.'
))

story.append(add_sub_section('9.3 Filtros e Resumo'))
story.append(body(
    'O modulo oferece filtros por cliente e por tipo de conta. O resumo financeiro e '
    'atualizado automaticamente com base nos filtros aplicados, mostrando: Total a '
    'Receber, Total a Pagar, Saldo (diferenca entre receber e pagar) e Total Pendente. '
    'Esses indicadores permitem uma visao financeira rapida e precisa da situacao da empresa.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 10: Relatorios
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('10. Relatorios'))

story.append(body(
    'O modulo de Relatorios gera extratos detalhados das operacoes da empresa. Voce pode '
    'filtrar por periodo (data inicio e data fim) e por cliente (todos ou um especifico). '
    'O relatorio inclui uma secao de resumo com totais de lancamentos, entradas, saidas, '
    'saldo, despesas, debito total e valor a cobrar. Abaixo, uma tabela detalhada lista '
    'cada leitura com data, cliente, maquina, valores de entrada e saida, saldo calculado '
    'e despesas.'
))

story.append(add_sub_section('10.1 Compartilhando Relatorios'))
story.append(body(
    'Apos gerar o relatorio, voce tem duas opcoes de compartilhamento:'
))
story.append(bullet(
    '<b>Imprimir:</b> Utiliza a funcao de impressao do navegador (Ctrl+P ou Cmd+P), '
    'gerando uma versao em papel ou PDF do relatorio.'
))
story.append(bullet(
    '<b>Enviar via WhatsApp:</b> Formata os dados do relatorio como texto e abre '
    'automaticamente o WhatsApp com a mensagem pre-preenchida, pronta para ser enviada '
    'ao contato desejado. Ideal para compartilhar resumos com clientes ou parceiros.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 11: Usuarios
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('11. Gerenciamento de Usuarios'))

story.append(body(
    'O modulo de Usuarios esta disponivel apenas para administradores e permite gerenciar '
    'quem tem acesso ao sistema, quais permissoes cada pessoa possui e acompanhar o ultimo '
    'acesso de cada usuario. E recomendavel criar usuarios individuais para cada membro da '
    'equipe em vez de compartilhar credenciais, garantindo rastreabilidade e seguranca.'
))

story.append(add_sub_section('11.1 Criando um Usuario'))
story.append(body(
    'Clique no botao de adicionar e preencha: nome completo, email (unico por empresa), '
    'senha, telefone opcional e nivel de acesso (Operador, Supervisor ou Administrador). '
    'O email sera utilizado para login e deve ser unico dentro da empresa.'
))

story.append(add_sub_section('11.2 Desativando Usuarios'))
story.append(body(
    'Se um membro da equipe nao precisa mais de acesso, voce pode desativa-lo usando o '
    'toggle de status. Usuarios desativados nao conseguem fazer login, mas seus dados e '
    'historico de acoes permanecem no sistema para auditoria. A reativacao pode ser feita '
    'a qualquer momento pelo administrador.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 12: Assinatura
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('12. Assinatura e Planos'))

story.append(body(
    'O CaixaFacil opera como um servico SaaS com planos mensais ou anuais. Na aba de '
    'Assinatura, voce pode visualizar seu plano atual, o status da assinatura (Ativa, '
    'Trial, Vencida, Cancelada ou Suspensa) e a data de inicio. Durante o periodo de '
    'teste gratuito (7 dias), todos os recursos estao disponiveis sem restricoes.'
))

story.append(add_sub_section('12.1 Planos Disponiveis'))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Plano', 'Clientes', 'Usuarios', 'IA Vision', 'Relatorios Avancados', 'Backup'],
    [
        ['Basico', 'Ate 50', '2', 'Nao', 'Nao', 'Nao'],
        ['Profissional', 'Ate 200', '5', 'Nao', 'Sim', 'Nao'],
        ['Premium', 'Ate 500', '10', 'Sim', 'Sim', 'Sim'],
        ['Enterprise', 'Ilimitado', 'Ilimitado', 'Sim', 'Sim', 'Sim'],
    ],
    [0.18, 0.15, 0.15, 0.15, 0.20, 0.17]
))
story.append(Spacer(1, 18))

story.append(add_sub_section('12.2 Renovacao e Pagamento'))
story.append(body(
    'Para assinar ou trocar de plano, selecione a opcao desejada e clique em contratar. '
    'Voce sera redirecionado para a pagina de pagamento do MercadoPago, onde pode pagar '
    'via PIX, cartao de credito, boleto ou outras formas disponiveis. Apos o pagamento, '
    'o sistema detecta automaticamente a confirmacao (via webhook) e ativa a nova assinatura '
    'em poucos segundos. Voce pode alternar entre cobranca mensal e anual, sendo o plano '
    'anual mais economico no longo prazo.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 13: Backup e Restauracao
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('13. Backup e Restauracao'))

story.append(body(
    'O modulo de Backup permite criar copias de seguranca completas de todos os dados da sua '
    'empresa e restaura-los quando necessario. Essa funcionalidade e restrita a administradores '
    'e e uma pratica essencial de seguranca digital. Recomendamos realizar backups regulares, '
    'especialmente antes de operacoes criticas como exclusoes em massa ou alteracoes significativas.'
))

story.append(add_sub_section('13.1 Criando um Backup'))
story.append(body(
    'Para criar um backup, acesse o menu lateral, selecione <b>Backup / Restaurar</b> e clique '
    'em "Gerar Backup". O sistema ira exportar todos os dados da empresa (clientes, maquinas, '
    'leituras, pagamentos, usuarios, configuracoes e todos os demais registros) em um arquivo '
    'JSON que sera baixado automaticamente para o seu dispositivo. O nome do arquivo inclui '
    'o nome da empresa e a data do backup para facilitar a organizacao.'
))

story.append(add_sub_section('13.2 Restaurando um Backup'))
story.append(warning(
    '<b>Atencao:</b> A restauracao substitui TODOS os dados atuais da empresa pelos dados '
    'contidos no arquivo de backup. Essa operacao e irreversivel. Antes de prosseguir, o '
    'sistema solicita que voce digite a palavra "RESTAURAR" como confirmacao de seguranca.'
))
story.append(body(
    'Para restaurar, clique em "Restaurar Backup", selecione o arquivo JSON previamente salvo, '
    'e confirme a operacao digitando "RESTAURAR" no campo de confirmacao. O sistema validara '
    'a estrutura do arquivo antes de aplicar, garantindo que seja um backup valido do CaixaFacil.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 14: Chat IA - Assistente Inteligente (CAPITULO ESPECIAL)
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('14. Chat IA - Assistente Inteligente'))

story.append(body(
    'O Chat IA e uma das funcionalidades mais poderosas e inovadoras do CaixaFacil. Trata-se '
    'de um assistente virtual com inteligencia artificial integrado diretamente na interface '
    'do sistema, acessivel por meio de um balao flutuante no canto inferior direito da tela. '
    'Este capitulo explica detalhadamente como funciona essa tecnologia, o que ela pode fazer, '
    'suas limitacoes e como extrair o maximo proveito dela no dia a dia da sua operacao.'
))

story.append(add_sub_section('14.1 O que e o Chat IA?'))
story.append(body(
    'O Chat IA e um agente conversacional que compreende a linguagem natural em portugues '
    'e e capaz de interagir com os dados do seu negocio em tempo real. Diferente de um chat '
    'comum que apenas responde perguntas pre-programadas, o assistente do CaixaFacil analisa '
    'o contexto da sua empresa, acessa dados reais do banco de dados e pode executar acoes '
    'como listar contas, criar lancamentos financeiros, liquidar debitos e muito mais, tudo '
    'isso atraves de uma conversa simples e intuitiva.'
))
story.append(body(
    'Imagine a seguinte situacao: voce esta em campo, precisa saber quais contas de um cliente '
    'especifico estao pendentes. Em vez de navegar por varios modulos do sistema, basta abrir '
    'o chat e digitar: "Quais as contas pendentes do cliente Bar do Joao?" O assistente '
    'consultara o banco de dados, processara a informacao e lhe retornara a lista completa, '
    'tudo em poucos segundos.'
))

story.append(add_sub_section('14.2 Como Acessar o Chat'))
story.append(body(
    'Para abrir o Chat IA, procure o icone de balao de chat no canto inferior direito de '
    'qualquer tela do sistema (quando autenticado). Clique no balao para expandir a janela '
    'de conversa. Voce pode minimiza-la clicando no botao de minimizar, ou fecha-la clicando '
    'no X. Quando o chat e reaberto, uma nova sessao e iniciada, mas a IA ainda possui '
    'memoria das conversas anteriores (ver secao 14.5 sobre Memoria).'
))

story.append(add_sub_section('14.3 Formas de Interacao'))
story.append(body(
    'O Chat IA oferece tres formas de interacao para se adaptar a sua situacao e preferencia:'
))
story.append(bullet(
    '<b>Texto:</b> Digite sua mensagem na caixa de texto e pressione Enter ou clique no '
    'botao de enviar. A IA processara sua mensagem e respondera em instantes.'
))
story.append(bullet(
    '<b>Voz (microfone):</b> Clique no icone do microfone para falar. O sistema utiliza '
    'a tecnologia de reconhecimento de voz (Web Speech API) para converter sua fala em '
    'texto automaticamente, em portugues brasileiro. Ideal para uso em campo, quando '
    'digitar no celular e inconveniente.'
))
story.append(bullet(
    '<b>Resposta de voz (TTS):</b> O sistema pode ler as respostas em voz alta, utilizando '
    'sintese de voz em portugues brasileiro. Ative ou desative essa funcao pelo botao de '
    'alto-falante. Isso e util quando voce esta em campo e precisa das maos livres.'
))

story.append(add_sub_section('14.4 Acoes Disponiveis'))
story.append(body(
    'A IA pode executar diversas acoes no sistema em resposta aos seus comandos. A tabela '
    'abaixo lista todas as acoes disponiveis, seus requisitos e se exigem confirmacao:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Acao', 'O que faz', 'Destrutiva?', 'Confirmacao'],
    [
        ['listar_contas', 'Lista contas com filtros (cliente, tipo, pago)', 'Nao', 'Nao'],
        ['listar_clientes', 'Lista clientes cadastrados (ate 30)', 'Nao', 'Nao'],
        ['listar_maquinas', 'Lista maquinas (opcionalmente por cliente)', 'Nao', 'Nao'],
        ['resumo_financeiro', 'Gera resumo financeiro completo', 'Nao', 'Nao'],
        ['criar_conta', 'Cria uma conta no fluxo de caixa', 'Sim', 'Obrigatoria'],
        ['liquidar_conta', 'Marca uma conta como paga', 'Sim', 'Obrigatoria'],
        ['excluir_conta', 'Remove uma conta do sistema', 'Sim', 'Obrigatoria'],
    ],
    [0.18, 0.38, 0.14, 0.15]  # adjusted to slightly less than 1.0
))
story.append(Spacer(1, 18))

story.append(add_sub_section('14.4.1 Acoes de Consulta (Sem Confirmacao)'))
story.append(body(
    'As acoes de consulta sao seguras e nao alteram dados do sistema. Voce pode utiliza-las '
    'livremente quantas vezes quiser. Exemplos de comandos que acionam acoes de consulta:'
))
story.append(bullet('"Liste todas as contas a receber do cliente Maria"'))
story.append(bullet('"Quais maquinas o cliente Bar do Joao possui?"'))
story.append(bullet('"Me mostre o resumo financeiro da empresa"'))
story.append(bullet('"Quais sao os meus clientes ativos?"'))
story.append(bullet('"Contas pagas este mes"'))

story.append(add_sub_section('14.4.2 Acoes Destrutivas (Com Confirmacao)'))
story.append(body(
    'As acoes destrutivas modificam dados do sistema e, por isso, exigem confirmacao explicita '
    'do usuario antes de serem executadas. Quando voce solicita uma acao destrutiva, a IA '
    'apresenta um quadro de confirmacao com os detalhes da operacao e dois botoes: '
    '<b>Confirmar</b> (executa a acao) e <b>Cancelar</b> (desiste da operacao). A acao so '
    'e realizada se voce clicar explicitamente em "Confirmar". Isso protege seus dados contra '
    'comandos acidentais ou mal interpretados pela IA.'
))
story.append(body('Exemplos de comandos que exigem confirmacao:'))
story.append(bullet('"Crie uma conta a receber de R$ 500 para o cliente Maria"'))
story.append(bullet('"Marque a conta 123 como paga"'))
story.append(bullet('"Exclua a conta 456"'))
story.append(warning(
    '<b>Importante:</b> Nunca confie cegamente nas acoes da IA. Sempre revise os detalhes '
    'apresentados no quadro de confirmacao antes de clicar em "Confirmar". A IA pode '
    'interpretar incorretamente valores, nomes de clientes ou IDs de contas.'
))

story.append(add_sub_section('14.5 Memoria e Contexto'))
story.append(body(
    'O Chat IA possui um sistema de memoria sofisticado que funciona em tres camadas, '
    'garantindo uma experiencia de conversa fluida e contextual:'
))

story.append(add_sub_sub_section('14.5.1 Contexto da Sessao (Multi-turn)'))
story.append(body(
    'Dentro de uma mesma sessao de chat (enquanto a janela estiver aberta), a IA lembra '
    'as ultimas 10 mensagens trocadas na conversa. Isso permite que voce faca perguntas '
    'sequenciais sem precisar repetir informacoes. Por exemplo, se voce pergunta "Liste '
    'as contas a receber" e em seguida pergunta "E as do cliente Joao?", a IA entende '
    'que voce ainda esta falando sobre contas a receber e aplica o filtro automaticamente.'
))

story.append(add_sub_sub_section('14.5.2 Memoria Persistente (Historico)'))
story.append(body(
    'O sistema armazena todas as conversas no banco de dados da empresa, organizadas por '
    'sessao. Essa memoria persiste entre sessoes e e utilizada para gerar um resumo do '
    'contexto das ultimas 24 horas de conversa. Quando voce abre o chat, a IA recebe '
    'automaticamente esse resumo, permitindo-lhe entender o contexto recente das suas '
    'interacoes, mesmo que tenha aberto uma nova sessao.'
))
story.append(body(
    'Importante destacar que <b>as conversas anteriores nao aparecem na interface do chat</b>. '
    'O historico e utilizado apenas como memoria interna para a IA, de forma invisivel ao '
    'usuario. Isso mantem a interface limpa e organizada, sem sobrecarregar a tela com '
    'conversas passadas. O chat sempre abre com uma tela em branco, pronto para novas interacoes.'
))

story.append(add_sub_sub_section('14.5.3 Limpeza Automatica'))
story.append(body(
    'Os registros de historico do chat seguem uma politica de limpeza automatica para '
    'evitar o crescimento descontrolado do banco de dados. O processo funciona em dois '
    'estagios:'
))
story.append(bullet(
    '<b>Soft Delete (apos 30 dias):</b> Mensagens com mais de 30 dias sao marcadas como '
    '"deletadas" (soft delete) na tabela do banco de dados. Elas ainda existem fisicamente '
    'mas nao sao mais consultadas pela IA nem aparecem em nenhum relatorio.'
))
story.append(bullet(
    '<b>Hard Delete (apos 37 dias):</b> Mensagens que foram marcadas como deletadas ha '
    'mais 7 dias sao permanentemente removidas do banco de dados (hard delete), liberando '
    'espaco de armazenamento de forma definitiva.'
))
story.append(note(
    '<b>Nota tecnica:</b> A limpeza nao e um trigger do banco de dados (gatilho automatico). '
    'E executada dentro do sistema de sincronizacao do schema (sync-schema), que roda '
    'automaticamente quando a aplicacao e inicializada ou acessada via API. Isso garante '
    'que a limpeza ocorra de forma controlada e segura.'
))

story.append(add_sub_section('14.6 Instrucoes Permanentes'))
story.append(body(
    'O sistema suporta instrucoes permanentes que jamais sao removidas pela limpeza automatica. '
    'Essas instrucoes permitem que voce "treine" a IA para lembrar de preferencias, procedimentos '
    'e prioridades especificas do seu negocio. Elas sao uteis para personalizar o comportamento '
    'do assistente ao longo do tempo.'
))
story.append(body('<b>Como usar instrucoes permanentes:</b>'))
story.append(bullet(
    '<b>Criar:</b> Digite no chat: "Anote uma instrucao: [sua instrucao aqui]". '
    'Exemplo: "Anote uma instrucao: Sempre apresentar as contas a receber primeiro".'
))
story.append(bullet(
    '<b>Listar:</b> Digite "Lista instrucoes" para ver todas as instrucoes salvas.'
))
story.append(bullet(
    '<b>Remover:</b> Digite "Remova instrucao: [texto da instrucao]" para excluir uma '
    'instrucao especifica.'
))
story.append(body(
    'As instrucoes sao armazenadas em uma tabela separada no banco de dados (ChatInstrucao) '
    'e nao sao afetadas pela politica de limpeza de 30 dias. Elas persistem indefinidamente '
    'ate que voce as remova manualmente. A IA inclui todas as instrucoes ativas no seu '
    'contexto, garantindo que elas sejam seguidas em todas as interacoes futuras.'
))
story.append(tip(
    '<b>Dica:</b> Use instrucoes permanentes para definir padroes como: ordem de apresentacao '
    'de dados, formato preferido de respostas, prioridade de clientes, procedimentos de '
    'cobranca personalizados e qualquer outra preferencia operacional.'
))

story.append(add_sub_section('14.7 Contexto que a IA Recebe'))
story.append(body(
    'Para proporcionar respostas precisas e relevantes, a IA recebe automaticamente o seguinte '
    'contexto a cada interacao, sem que voce precise fornecer nenhuma informacao adicional:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Informacao', 'Descricao'],
    [
        ['Dados da empresa', 'Nome, plano, status de atividade'],
        ['Contagem de clientes', 'Total, ativos e bloqueados'],
        ['Contagem de maquinas', 'Total, ativas, em manutencao e inativas'],
        ['Resumo financeiro', 'Total a receber, a pagar e saldo'],
        ['Leituras recentes', 'Ultimas 30 dias de coleta'],
        ['Pagamentos recentes', 'Ultimos 30 dias de pagamentos'],
        ['Ultimas contas', '10 contas mais recentes do fluxo de caixa'],
        ['Historico (24h)', 'Resumo das conversas das ultimas 24 horas'],
        ['Instrucoes', 'Todas as instrucoes permanentes ativas'],
        ['Sessao atual', 'Ultimas 10 mensagens da conversa atual'],
    ],
    [0.30, 0.70]
))
story.append(Spacer(1, 18))

story.append(add_sub_section('14.8 Modelos de IA Suportados'))
story.append(body(
    'O CaixaFacil suporta multiplos modelos de inteligencia artificial de diferentes provedores, '
    'todos configurados pelo administrador no painel de configuracoes do sistema. Os provedores '
    'atuais disponiveis sao:'
))
story.append(bullet(
    '<b>Google Gemini:</b> Modelos gemini-2.5-flash-lite, gemini-2.0-flash-lite, gemini-2.5-flash, '
    'gemini-2.0-flash e gemini-2.5-pro. Oferece rapidez e qualidade nas respostas em portugues.'
))
story.append(bullet(
    '<b>Zhipu AI (GLM):</b> Modelos glm-4.6v-flash, glm-4.6v e glm-5v-turbo. Alternativa '
    'robusta com suporte a visao computacional, util para analise de imagens no chat.'
))
story.append(bullet(
    '<b>OpenRouter:</b> Modelos gratuitos como gemma-4-31b-it, gemma-3-27b-it e '
    'nemotron-nano-12b-v2-vl. Ideal como opcao economica quando disponivel.'
))
story.append(note(
    '<b>Nota:</b> A troca de modelo pode ser feita pelo administrador nas configuracoes do sistema '
    '(menu CONFIG SAAS). Cada provedor requer uma chave de API (API Key) propria, que pode ser '
    'obtida nos sites oficiais de cada servico. O sistema possui um botao "Testar Conexao" que '
    'verifica se a chave esta configurada corretamente e mede o tempo de resposta do modelo.'
))

story.append(add_sub_section('14.9 Limitacoes'))
story.append(body(
    'E importante compreender as limitacoes atuais do Chat IA para ter expectativas realistas:'
))
story.append(bullet(
    '<b>Nao aprende permanentemente:</b> A IA nao atualiza seus modelos internos com base nas '
    'suas conversas. Ela opera apenas com o contexto fornecido em cada sessao. Caso voce '
    'precise de preferencias persistentes, utilize o sistema de instrucoes permanentes.'
))
story.append(bullet(
    '<b>Pode cometer erros:</b> Como toda inteligencia artificial, ocasionalmente pode '
    'interpretar incorretamente valores numericos, nomes ou comandos. Sempre confira os '
    'detalhes antes de confirmar acoes destrutivas.'
))
story.append(bullet(
    '<b>Depende de conexao:</b> O chat necessita de conexao com a internet para se comunicar '
    'com os servidores de IA. Em locais sem conexao, o chat ficara indisponivel, embora as '
    'demais funcionalidades do sistema continuem operando normalmente.'
))
story.append(bullet(
    '<b>Contexto limitado:</b> A IA lembra apenas as ultimas 10 mensagens da sessao atual '
    'e o resumo das ultimas 24 horas. Conversas mais antigas sao acessadas apenas pelo '
    'resumo, que pode perder detalhes especificos de interacoes muito antigas.'
))

story.append(add_sub_section('14.10 Exemplos Praticos de Uso'))
story.append(body(
    'Para inspirar o uso do Chat IA no seu dia a dia, aqui estao alguns cenarios praticos '
    'de comandos que voce pode experimentar:'
))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Cenario', 'Comando Exemplo'],
    [
        ['Consultar pendencias', '"Contas a receber do cliente Maria para hoje"'],
        ['Ver resumo geral', '"Qual o resumo financeiro da empresa?"'],
        ['Saber sobre maquinas', '"Quais maquinas estao em manutencao?"'],
        ['Verificar cliente', '"O cliente Bar do Joao esta ativo?"'],
        ['Criar lancamento', '"Crie uma conta a receber de R$ 300 para o cliente Pedro"'],
        ['Liquidar debito', '"Marque a conta 42 como paga"'],
        ['Dar instrucao', '"Anote uma instrucao: Sempre mostrar valor total no resumo"'],
        ['Acompanhar status', '"Liste todos os pagamentos em atraso"'],
    ],
    [0.25, 0.75]
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 15: Dicas e Boas Praticas
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('15. Dicas e Boas Praticas'))

story.append(add_sub_section('15.1 Organizacao dos Dados'))
story.append(body(
    'Mantenha os cadastros de clientes e maquinas sempre atualizados. Um cliente com dados '
    'incompletos (sem telefone ou endereco) dificulta a cobranca e o atendimento. Da mesma forma, '
    'maquinas com status desatualizado (por exemplo, uma que ja foi consertada mas continua '
    'marcada como "Manutencao") comprometem a precisao dos indicadores do Dashboard e dos relatorios.'
))

story.append(add_sub_section('15.2 Backup Regular'))
story.append(body(
    'Estabeleca uma rotina de backup semanal ou quinzenal. Baixe o arquivo JSON e salve-o em '
    'um local seguro, de preferencia em nuvem (Google Drive, Dropbox) ou em um pendrive separado. '
    'Em caso de problemas, a restauracao e rapida e recupera todos os dados da empresa.'
))

story.append(add_sub_section('15.3 Aproveitando o Chat IA'))
story.append(body(
    'Use o Chat IA como seu assistente de campo. Configure instrucoes permanentes com as '
    'preferencias da sua operacao, utilize o microfone em vez de digitar quando estiver em '
    'movimento e faca consultas rapidas antes de visitar um cliente para saber exatamente '
    'quais valores cobrar. Quanto mais voce utiliza o chat, mais produtivo se torna, '
    'especialmente ao combinar as instrucoes permanentes com as acoes de consulta.'
))

story.append(add_sub_section('15.4 Seguranca'))
story.append(body(
    'Nunca compartilhe suas credenciais de login com outros usuarios. Crie contas individuais '
    'para cada membro da equipe com o nivel de acesso apropriado. Revise periodicamente a lista '
    'de usuarios e desative aqueles que nao precisam mais de acesso. Essas praticas simples '
    'protegem os dados da sua empresa e garantem a rastreabilidade de todas as acoes realizadas.'
))
story.append(Spacer(1, 18))


# ═══════════════════════════════════════════════════════════
# CAPITULO 16: Suporte Tecnico
# ═══════════════════════════════════════════════════════════
story.extend(add_major_section('16. Suporte Tecnico'))

story.append(body(
    'Em caso de duvidas, problemas tecnicos ou sugestoes de melhorias, entre em contato com '
    'o suporte do CaixaFacil. O sistema esta em constante evolucao e seu feedback e fundamental '
    'para o desenvolvimento de novas funcionalidades e correcoes.'
))

story.append(add_sub_section('16.1 Problemas Comuns'))
story.append(Spacer(1, 12))
story.append(make_table(
    ['Problema', 'Possivel Solucao'],
    [
        ['Chat IA nao responde', 'Verifique sua conexao com a internet e confira se a API Key esta configurada'],
        ['Leitura por foto nao funciona', 'Tire a foto com boa iluminacao e enquadre o display completo'],
        ['Dashboard nao carrega', 'Atualize a pagina (F5) e verifique a conexao com a internet'],
        ['Erro ao salvar leitura', 'Verifique se os valores digitados sao maiores que as leituras anteriores'],
        ['Pagamento nao aparece', 'Aguarde alguns segundos apos o pagamento via MercadoPago para atualizacao'],
    ],
    [0.30, 0.70]
))
story.append(Spacer(1, 18))


# ─── Build ───
doc.multiBuild(story)
print(f"Body PDF generated: {BODY_PDF}")
