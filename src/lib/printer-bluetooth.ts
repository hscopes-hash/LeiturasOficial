// ============================================================
// Bluetooth Thermal Printer Service
// Uses Web Bluetooth API for Android Chrome
// Falls back to native print / share for iOS and unsupported browsers
// ============================================================

import { buildCaixaFacilReceipt, type PrinterWidth } from './escpos';

export type PrinterType = '58mm' | '80mm' | 'generic';
export type ConnectionType = 'bluetooth' | 'none';

export interface PrinterConfig {
  type: PrinterType;
  connectionType: ConnectionType;
  // BLE service/characteristic UUIDs (can be customized per printer model)
  serviceUUID: string;
  writeCharacteristicUUID: string;
  // Max bytes per BLE write (varies by printer)
  maxChunkSize: number;
}

// Common BLE UUIDs for thermal printers
export const PRINTER_PRESETS: Record<string, PrinterConfig> = {
  'goojprt-58mm': {
    type: '58mm',
    connectionType: 'bluetooth',
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    writeCharacteristicUUID: '000018f1-0000-1000-8000-00805f9b34fb',
    maxChunkSize: 100,
  },
  'goojprt-80mm': {
    type: '80mm',
    connectionType: 'bluetooth',
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    writeCharacteristicUUID: '000018f1-0000-1000-8000-00805f9b34fb',
    maxChunkSize: 100,
  },
  'mtp-ii': {
    type: '58mm',
    connectionType: 'bluetooth',
    serviceUUID: '0000ff00-0000-1000-8000-00805f9b34fb',
    writeCharacteristicUUID: '0000ff02-0000-1000-8000-00805f9b34fb',
    maxChunkSize: 100,
  },
  'generic-bt': {
    type: '58mm',
    connectionType: 'bluetooth',
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    writeCharacteristicUUID: '000018f1-0000-1000-8000-00805f9b34fb',
    maxChunkSize: 20, // conservative default
  },
  'none': {
    type: '58mm',
    connectionType: 'none',
    serviceUUID: '',
    writeCharacteristicUUID: '',
    maxChunkSize: 20,
  },
};

// Bluetooth connection state
let bluetoothDevice: BluetoothDevice | null = null;
let writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let isConnected = false;
let activeConfig: PrinterConfig | null = null;

// Get the active printer config (set when connectPrinter is called)
export function getActiveConfig(): PrinterConfig | null {
  return activeConfig;
}

// Check if Web Bluetooth is available
export function isBluetoothAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator as any).bluetooth;
}

// Check if currently connected
export function isPrinterConnected(): boolean {
  return isConnected && writeCharacteristic !== null;
}

// Get the connected device name
export function getConnectedDeviceName(): string | null {
  return bluetoothDevice?.name || null;
}

// Disconnect from printer
export async function disconnectPrinter(): Promise<void> {
  try {
    if (bluetoothDevice && bluetoothDevice.gatt?.connected) {
      bluetoothDevice.gatt.disconnect();
    }
  } catch {
    // Ignore disconnect errors
  }
  bluetoothDevice = null;
  writeCharacteristic = null;
  isConnected = false;
  activeConfig = null;
}

// Connect to a Bluetooth printer
export async function connectPrinter(config: PrinterConfig): Promise<{ success: boolean; error?: string; deviceName?: string }> {
  if (!isBluetoothAvailable()) {
    return { success: false, error: 'Bluetooth nao disponivel. Use o Chrome no Android.' };
  }

  try {
    // Request device with the printer service
    const bt = (navigator as any).bluetooth;

    // Disconnect previous if connected
    await disconnectPrinter();

    // Request device - accepts all Bluetooth devices or filters by service
    let device: BluetoothDevice;
    try {
      device = await bt.requestDevice({
        filters: [{ services: [config.serviceUUID] }],
      });
    } catch {
      // Fallback: accept all devices if service filter fails
      device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: [config.serviceUUID],
      });
    }

    bluetoothDevice = device;

    // Listen for disconnect
    device.addEventListener('gattserverdisconnected', () => {
      isConnected = false;
      writeCharacteristic = null;
      console.log('[Printer] Disconnected');
    });

    // Connect to GATT server
    const server = await device.gatt!.connect();

    // Get service
    const service = await server.getPrimaryService(config.serviceUUID);

    // Get write characteristic
    writeCharacteristic = await service.getCharacteristic(config.writeCharacteristicUUID);

    isConnected = true;
    activeConfig = config;

    return { success: true, deviceName: device.name };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar';
    console.error('[Printer] Connection error:', message);
    return { success: false, error: message };
  }
}

// Write data to printer in chunks
async function writeData(data: Uint8Array, maxChunkSize: number): Promise<void> {
  if (!writeCharacteristic) {
    throw new Error('Printer not connected');
  }

  // Write in chunks to avoid BLE MTU limits
  for (let i = 0; i < data.length; i += maxChunkSize) {
    const chunk = data.slice(i, i + maxChunkSize);
    await writeCharacteristic.writeValue(chunk);
    // Small delay between chunks for printer buffer
    if (i + maxChunkSize < data.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}

// Send raw ESC/POS data to printer
export async function printRaw(data: Uint8Array, config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
  if (!isPrinterConnected()) {
    return { success: false, error: 'Impressora nao conectada' };
  }

  try {
    await writeData(data, config.maxChunkSize);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao imprimir';
    console.error('[Printer] Print error:', message);
    return { success: false, error: message };
  }
}

// ---- High-level: Print CaixaFácil receipt ----
export async function printReceipt(data: Parameters<typeof buildCaixaFacilReceipt>[0], config: PrinterConfig): Promise<{ success: boolean; error?: string }> {
  const width: PrinterWidth = config.type === '80mm' ? 80 : 58;
  const buffer = buildCaixaFacilReceipt({ ...data, width });
  
  return printRaw(buffer, config);
}

// ---- Fallback: Generate printable text for native print / share ----
export function generateReceiptText(data: Parameters<typeof buildCaixaFacilReceipt>[0]): string {
  const w = 32; // assume 58mm
  const sep = '-'.repeat(w);
  let text = '';
  
  text += data.empresaNome + '\n';
  text += sep + '\n';
  text += `CLIENTE: ${data.clienteNome}\n`;
  text += `DATA: ${data.dataHora}\n`;
  text += `OPERADOR: ${data.usuario}\n`;
  text += sep + '\n';
  
  data.maquinas.forEach((m, idx) => {
    // Separador entre máquinas
    if (idx > 0) {
      text += sep + '\n';
    }
    text += `${m.codigo} - ${m.tipo}\n`;
    text += `E ${String(m.entradaAnterior).padStart(6)} ${String(m.entradaNova).padStart(6)} D:${String(m.diferencaEntrada).padStart(6)}\n`;
    text += `S ${String(m.saidaAnterior).padStart(6)} ${String(m.saidaNova).padStart(6)} D:${String(m.diferencaSaida).padStart(6)}\n`;
    text += `SALDO: R$ ${(m.saldo || 0).toFixed(2)}\n`;
  });
  
  text += sep + '\n';
  text += `QTD MAQ: ${data.maquinas.length}\n`;
  text += `ENTRADAS: R$ ${data.totais.entradas.toFixed(2)}\n`;
  text += `SAIDAS...: R$ ${data.totais.saidas.toFixed(2)}\n`;
  text += `JOGADO...: R$ ${data.totais.jogado.toFixed(2)}\n`;
  text += `CLIENTE..: R$ ${data.totais.cliente.toFixed(2)} (${data.totais.acertoPct}%)\n`;
  
  if (data.debitosVencidos && data.debitosVencidos !== 0) {
    text += `DEBITO(SALDO): R$ ${data.debitosVencidos.toFixed(2)}\n`;
  }
  
  // Receitas e Despesas
  const hasReceitas = !!(data.receitas && data.receitas.some(r => r.valor > 0));
  const hasDespesas = !!(data.despesas && data.despesas.some(d => d.valor > 0));
  const temAmbos = hasReceitas && hasDespesas;

  if (hasReceitas) {
    text += sep + '\n';
    const totalRec = data.receitas!.reduce((s, r) => s + r.valor, 0);
    data.receitas!.filter(r => r.valor > 0).forEach(r => {
      text += `  ${r.descricao.padEnd(12)} R$ ${r.valor.toFixed(2)}\n`;
    });
    text += `RECEITAS.: R$ ${totalRec.toFixed(2)}\n`;
  }
  
  if (hasDespesas) {
    const totalDesp = data.despesas!.reduce((s, d) => s + d.valor, 0);
    data.despesas!.filter(d => d.valor > 0).forEach(d => {
      text += `  ${d.descricao.padEnd(12)} R$ ${d.valor.toFixed(2)}\n`;
    });
    text += `DESPESAS.: R$ ${totalDesp.toFixed(2)}\n`;
    text += sep + '\n';
  }
  
  if (data.liquido !== undefined) {
    text += sep + '\n';
    if (temAmbos) {
      const suffix = data.liquido >= 0 ? '[Sobrou]' : '[Faltou]';
      text += `FECHAMENTO: R$ ${data.liquido.toFixed(2)} ${suffix}\n`;
    } else {
      text += `RECEBIDO..: R$ ${data.liquido.toFixed(2)}\n`;
    }
  }
  
  text += sep + '\n';
  return text;
}

// ---- Fallback: Share / Print via browser ----
export async function fallbackPrint(text: string): Promise<void> {
  // Try Web Share API (works on mobile)
  if (typeof navigator !== 'undefined' && !!(navigator as any).share) {
    try {
      await (navigator as any).share({
        title: 'Extrato CaixaFacil',
        text: text,
      });
      return;
    } catch {
      // User cancelled or error - fall through
    }
  }
  
  // Fallback: open a new window with the text for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head><title>Extrato CaixaFacil</title></head>
        <body style="font-family: monospace; white-space: pre; font-size: 12px; margin: 10px;">
          ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}
