// ============================================================
// ESC/POS Command Library for Thermal Printers
// Supports 58mm (32 chars) and 80mm (48 chars) paper widths
// ============================================================

export type PrinterWidth = 58 | 80;

export interface EscPosOptions {
  width?: PrinterWidth;
  title?: string;
  subtitle?: string;
  lines?: EscPosLine[];
  cutPaper?: boolean;
  beep?: boolean;
}

export interface EscPosLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  doubleSize?: boolean;
}

// ---- ESC/POS Commands ----
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';
const ESC_INIT = ESC + '@';
const ESC_BOLD_ON = ESC + 'E\x01';
const ESC_BOLD_OFF = ESC + 'E\x00';
const ESC_UNDERLINE_ON = ESC + '-\x01';
const ESC_UNDERLINE_OFF = ESC + '-\x00';
const ESC_ALIGN_LEFT = ESC + 'a\x00';
const ESC_ALIGN_CENTER = ESC + 'a\x01';
const ESC_ALIGN_RIGHT = ESC + 'a\x02';
const ESC_DOUBLE_ON = GS + '!\x11'; // double height + width
const ESC_DOUBLE_OFF = GS + '!\x00';
const GS_CUT = GS + 'V\x00'; // full cut
const ESC_BEEP = ESC + '\x42\x03\x03'; // beep 3 times, 3x100ms
const ESC_FEED_3 = ESC + 'd\x03'; // feed 3 lines

// Max characters per line for each paper width
const MAX_CHARS: Record<PrinterWidth, number> = {
  58: 32,
  80: 48,
};

// Remove diacritics for printer compatibility
function removeDiacritics(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

// Pad text to fit a specific width
function padLine(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
  const clean = removeDiacritics(text);
  if (clean.length >= width) return clean.substring(0, width);
  switch (align) {
    case 'center': {
      const totalPad = width - clean.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      return ' '.repeat(leftPad) + clean + ' '.repeat(rightPad);
    }
    case 'right':
      return ' '.repeat(width - clean.length) + clean;
    default:
      return clean + ' '.repeat(width - clean.length);
  }
}

// Split long text into multiple lines
function wrapText(text: string, maxWidth: number): string[] {
  const clean = removeDiacritics(text);
  if (clean.length <= maxWidth) return [clean];
  const lines: string[] = [];
  let remaining = clean;
  while (remaining.length > 0) {
    lines.push(remaining.substring(0, maxWidth));
    remaining = remaining.substring(maxWidth);
  }
  return lines;
}

// Generate a horizontal separator line
function separator(width: PrinterWidth): string {
  return '-'.repeat(MAX_CHARS[width]);
}

// ---- Main ESC/POS Builder ----
export function buildEscPosBuffer(options: EscPosOptions): Uint8Array {
  const width: PrinterWidth = options.width || 58;
  const maxChars = MAX_CHARS[width];
  const encoder = new TextEncoder();

  const commands: string[] = [];
  
  // Initialize
  commands.push(ESC_INIT);
  
  // Title (if provided)
  if (options.title) {
    commands.push(ESC_ALIGN_CENTER);
    commands.push(ESC_DOUBLE_ON);
    commands.push(ESC_BOLD_ON);
    const titleLines = wrapText(options.title, maxChars);
    titleLines.forEach(line => {
      commands.push(padLine(line, maxChars, 'center') + LF);
    });
    commands.push(ESC_DOUBLE_OFF);
    commands.push(ESC_BOLD_OFF);
    commands.push(LF);
  }
  
  // Subtitle (if provided)
  if (options.subtitle) {
    commands.push(ESC_ALIGN_CENTER);
    const subLines = wrapText(options.subtitle, maxChars);
    subLines.forEach(line => {
      commands.push(padLine(line, maxChars, 'center') + LF);
    });
    commands.push(LF);
  }

  // Lines
  if (options.lines && options.lines.length > 0) {
    options.lines.forEach(line => {
      // Set alignment
      switch (line.align) {
        case 'center': commands.push(ESC_ALIGN_CENTER); break;
        case 'right': commands.push(ESC_ALIGN_RIGHT); break;
        default: commands.push(ESC_ALIGN_LEFT);
      }
      
      // Set styles
      if (line.doubleSize) commands.push(ESC_DOUBLE_ON);
      if (line.bold) commands.push(ESC_BOLD_ON);
      if (line.underline) commands.push(ESC_UNDERLINE_ON);
      
      // Split and print wrapped lines
      const wrapped = wrapText(line.text, maxChars);
      wrapped.forEach(wl => {
        if (line.align === 'center') {
          commands.push(padLine(wl, maxChars, 'center') + LF);
        } else if (line.align === 'right') {
          commands.push(padLine(wl, maxChars, 'right') + LF);
        } else {
          commands.push(removeDiacritics(wl) + LF);
        }
      });
      
      // Reset styles
      if (line.underline) commands.push(ESC_UNDERLINE_OFF);
      if (line.bold) commands.push(ESC_BOLD_OFF);
      if (line.doubleSize) commands.push(ESC_DOUBLE_OFF);
    });
  }
  
  // Reset alignment
  commands.push(ESC_ALIGN_LEFT);
  
  // Feed and cut
  commands.push(LF);
  commands.push(ESC_FEED_3);
  if (options.beep) commands.push(ESC_BEEP);
  if (options.cutPaper !== false) commands.push(GS_CUT);

  // Concatenate all commands and encode
  const fullCommand = commands.join('');
  return encoder.encode(fullCommand);
}

// ---- Helper: Build receipt for CaixaFácil ----
export function buildCaixaFacilReceipt(data: {
  empresaNome: string;
  clienteNome: string;
  dataHora: string;
  usuario: string;
  maquinas: {
    codigo: string;
    tipo: string;
    entradaAnterior: number;
    entradaNova: number;
    saidaAnterior: number;
    saidaNova: number;
    diferencaEntrada: number;
    diferencaSaida: number;
    saldo: number;
    moeda: string;
  }[];
  totais: {
    entradas: number;
    saidas: number;
    jogado: number;
    cliente: number;
    acertoPct: number;
  };
  receitas?: { descricao: string; valor: number }[];
  despesas?: { descricao: string; valor: number }[];
  debitosVencidos?: number;
  liquido?: number;
  width?: PrinterWidth;
}): Uint8Array {
  const width: PrinterWidth = data.width || 58;
  const maxChars = MAX_CHARS[width];
  const lines: EscPosLine[] = [];

  // Separator
  lines.push({ text: separator(width), align: 'center' });

  // Client
  lines.push({ text: `CLIENTE: ${data.clienteNome}`, bold: true, align: 'center' });
  lines.push({ text: `DATA: ${data.dataHora}`, align: 'center' });
  lines.push({ text: `OPERADOR: ${data.usuario}`, align: 'center' });
  lines.push({ text: separator(width), align: 'center' });

  // Machine readings
  data.maquinas.forEach((m, idx) => {
    // Separador entre máquinas
    if (idx > 0) {
      lines.push({ text: separator(width), align: 'center' });
    }
    lines.push({ text: `${m.codigo} - ${m.tipo}`, bold: true });
    lines.push({ text: `E ${String(m.entradaAnterior).padStart(6)} ${String(m.entradaNova).padStart(6)} D:${String(m.diferencaEntrada).padStart(6)}` });
    lines.push({ text: `S ${String(m.saidaAnterior).padStart(6)} ${String(m.saidaNova).padStart(6)} D:${String(m.diferencaSaida).padStart(6)}` });
    lines.push({ text: `SALDO: R$ ${data.totais.jogado > 0 ? m.saldo.toFixed(2).replace('.', ',') : '0,00'}`, bold: true });
  });

  lines.push({ text: separator(width), align: 'center' });

  // Totals
  lines.push({ text: `QTD MAQ: ${data.maquinas.length}`, bold: true });
  lines.push({ text: `ENTRADAS: R$ ${data.totais.entradas.toFixed(2).replace('.', ',')}` });
  lines.push({ text: `SAIDAS...: R$ ${data.totais.saidas.toFixed(2).replace('.', ',')}` });
  lines.push({ text: `JOGADO...: R$ ${data.totais.jogado.toFixed(2).replace('.', ',')}`, bold: true });
  lines.push({ text: `CLIENTE..: R$ ${data.totais.cliente.toFixed(2).replace('.', ',')} (${data.totais.acertoPct}%)` });

  // Debitos
  if (data.debitosVencidos && data.debitosVencidos !== 0) {
    lines.push({ text: `DEBITO(SALDO): R$ ${data.debitosVencidos.toFixed(2).replace('.', ',')}` });
  }

  // Receitas e Despesas - detectar se há ambos para escolher RECEBIDO vs FECHAMENTO
  const hasReceitas = !!(data.receitas && data.receitas.some(r => r.valor > 0));
  const hasDespesas = !!(data.despesas && data.despesas.some(d => d.valor > 0));
  const temAmbos = hasReceitas && hasDespesas;

  // Receitas - separador antes
  if (hasReceitas) {
    lines.push({ text: separator(width), align: 'center' });
    const totalRec = data.receitas!.reduce((s, r) => s + r.valor, 0);
    data.receitas!.filter(r => r.valor > 0).forEach(r => {
      lines.push({ text: `  ${r.descricao.padEnd(12)} R$ ${r.valor.toFixed(2).replace('.', ',')}` });
    });
    lines.push({ text: `RECEITAS.: R$ ${totalRec.toFixed(2).replace('.', ',')}` });
  }

  // Despesas - separador depois
  if (hasDespesas) {
    const totalDesp = data.despesas!.reduce((s, d) => s + d.valor, 0);
    data.despesas!.filter(d => d.valor > 0).forEach(d => {
      lines.push({ text: `  ${d.descricao.padEnd(12)} R$ ${d.valor.toFixed(2).replace('.', ',')}` });
    });
    lines.push({ text: `DESPESAS.: R$ ${totalDesp.toFixed(2).replace('.', ',')}` });
    lines.push({ text: separator(width), align: 'center' });
  }

  // RECEBIDO ou FECHAMENTO
  if (data.liquido !== undefined) {
    lines.push({ text: separator(width), align: 'center' });
    if (temAmbos) {
      const suffix = data.liquido >= 0 ? '[Sobrou]' : '[Faltou]';
      lines.push({ text: `FECHAMENTO: R$ ${data.liquido.toFixed(2).replace('.', ',')} ${suffix}`, bold: true, doubleSize: true });
    } else {
      lines.push({ text: `RECEBIDO..: R$ ${data.liquido.toFixed(2).replace('.', ',')}`, bold: true, doubleSize: true });
    }
  }

  return buildEscPosBuffer({
    width,
    title: data.empresaNome,
    lines,
    cutPaper: true,
    beep: true,
  });
}
