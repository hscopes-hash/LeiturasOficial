'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Check, X } from 'lucide-react';

interface ROI {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RoiMarkerProps {
  imagem: string | null;
  roiEntrada: ROI | null;
  roiSaida: ROI | null;
  nomeEntrada: string;
  nomeSaida: string;
  onEntradaChange: (roi: ROI | null) => void;
  onSaidaChange: (roi: ROI | null) => void;
  onImagemChange: (imagem: string) => void;
}

export default function RoiMarker({
  imagem,
  roiEntrada,
  roiSaida,
  nomeEntrada,
  nomeSaida,
  onEntradaChange,
  onSaidaChange,
  onImagemChange,
}: RoiMarkerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgDataRef = useRef<HTMLImageElement | null>(null);
  const [desenhando, setDesenhando] = useState<'entrada' | 'saida' | null>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);
  const [modo, setModo] = useState<'entrada' | 'saida'>('entrada');
  const [, forceUpdate] = useState(0);

  // Carrega a imagem uma vez e guarda no ref
  useEffect(() => {
    if (!imagem) {
      imgDataRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      imgDataRef.current = img;
      forceUpdate(n => n + 1); // trigger redraw
    };
    img.src = imagem;
  }, [imagem]);

  // Desenhar tudo: imagem + overlay escuro + ROI
  const draw = useCallback((temporario?: ROI | null) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgDataRef.current;
    if (!canvas || !container || !img) return;

    const dpr = window.devicePixelRatio || 1;

    // Calcular tamanho de exibição respeitando max-width do container e max-height 400px
    const maxW = container.clientWidth;
    const maxH = 400;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const displayW = Math.round(img.naturalWidth * scale);
    const displayH = Math.round(img.naturalHeight * scale);

    // Tamanho real do canvas (suporta retina)
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 1. Desenhar imagem
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // 2. Overlay escuro
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, displayW, displayH);

    // 3. Desenhar ROI de entrada (se existir)
    const entrada = temporario && modo === 'entrada' ? temporario : roiEntrada;
    if (entrada) {
      const ex = (entrada.x / 100) * displayW;
      const ey = (entrada.y / 100) * displayH;
      const ew = (entrada.w / 100) * displayW;
      const eh = (entrada.h / 100) * displayH;

      // Limpar overlay na região (mostra imagem original)
      ctx.clearRect(ex, ey, ew, eh);
      ctx.drawImage(img, entrada.x / 100, entrada.y / 100, entrada.w / 100, entrada.h / 100, ex, ey, ew, eh);

      // Borda tracejada
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(ex, ey, ew, eh);
      ctx.setLineDash([]);

      // Label
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#4ade80';
      const label = nomeEntrada;
      const tw = ctx.measureText(label).width;
      const lx = ex + ew / 2 - tw / 2 - 8;
      const ly = ey > 28 ? ey - 28 : ey + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 16, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'center';
      ctx.fillText(label, ex + ew / 2, ly + 15);
    }

    // 4. Desenhar ROI de saída (se existir)
    const saida = temporario && modo === 'saida' ? temporario : roiSaida;
    if (saida) {
      const sx = (saida.x / 100) * displayW;
      const sy = (saida.y / 100) * displayH;
      const sw = (saida.w / 100) * displayW;
      const sh = (saida.h / 100) * displayH;

      ctx.clearRect(sx, sy, sw, sh);
      ctx.drawImage(img, saida.x / 100, saida.y / 100, saida.w / 100, saida.h / 100, sx, sy, sw, sh);

      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);

      ctx.font = 'bold 13px system-ui, sans-serif';
      const label = nomeSaida;
      const tw = ctx.measureText(label).width;
      const lx = sx + sw / 2 - tw / 2 - 8;
      const ly = sy > 28 ? sy - 28 : sy + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 16, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText(label, sx + sw / 2, ly + 15);
    }
  }, [roiEntrada, roiSaida, nomeEntrada, nomeSaida, modo]);

  // Redesenhar quando imagem carrega ou ROI muda
  useEffect(() => {
    draw();
  }, [draw]);

  // Redesenhar ao redimensionar
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  // Mouse → %
  const getPosPercent = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDesenhando(modo);
    setInicio(getPosPercent(e));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!desenhando || !inicio) return;
    const current = getPosPercent(e);
    const x = Math.min(inicio.x, current.x);
    const y = Math.min(inicio.y, current.y);
    const w = Math.abs(current.x - inicio.x);
    const h = Math.abs(current.y - inicio.y);
    draw({ x, y, w, h }); // preview em tempo real
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!desenhando || !inicio) return;
    const current = getPosPercent(e);
    const x = Math.min(inicio.x, current.x);
    const y = Math.min(inicio.y, current.y);
    const w = Math.abs(current.x - inicio.x);
    const h = Math.abs(current.y - inicio.y);
    const roi = { x, y, w, h };
    if (desenhando === 'entrada') onEntradaChange(roi);
    else onSaidaChange(roi);
    setDesenhando(null);
    setInicio(null);
  };

  const handleCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 1500));

      const cvs = document.createElement('canvas');
      cvs.width = video.videoWidth;
      cvs.height = video.videoHeight;
      cvs.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      onImagemChange(cvs.toDataURL('image/png'));
    } catch (e) {
      console.error('Erro ao capturar:', e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onImagemChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const corModo = modo === 'entrada' ? 'text-green-400 border-green-500' : 'text-red-400 border-red-500';
  const bgModo = modo === 'entrada' ? 'bg-green-500/10' : 'bg-red-500/10';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Imagem de Referência</label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCapture} className="h-7 text-xs border-zinc-600">
              <Camera className="w-3 h-3 mr-1" /> Tirar Foto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 text-xs border-zinc-600">
              Upload
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </div>
        </div>

        {/* Container: medir largura disponível */}
        <div ref={containerRef} className="relative rounded-lg overflow-hidden bg-black/90 min-h-[200px] flex items-center justify-center">
          {imagem && imgDataRef.current ? (
            <>
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  if (desenhando) {
                    setDesenhando(null);
                    setInicio(null);
                    draw(); // remove preview
                  }
                }}
                className="cursor-crosshair block"
              />
              <button
                onClick={() => onImagemChange('')}
                className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : imagem ? (
            <div className="text-zinc-400 text-sm py-12">Carregando imagem...</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
              <Camera className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Tire uma foto do display ou faça upload</p>
              <p className="text-xs mt-1">A imagem servirá de guia para marcar as regiões</p>
            </div>
          )}
        </div>
      </div>

      {imagem && imgDataRef.current && (
        <>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground flex-1">Selecione o modo e desenhe o retângulo na imagem:</p>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              <button onClick={() => setModo('entrada')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${modo === 'entrada' ? `${bgModo} ${corModo}` : 'text-zinc-400 hover:text-white'}`}>
                {nomeEntrada}
              </button>
              <button onClick={() => setModo('saida')} className={`px-3 py-1.5 text-xs font-medium transition-colors ${modo === 'saida' ? `${bgModo} ${corModo}` : 'text-zinc-400 hover:text-white'}`}>
                {nomeSaida}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            {roiEntrada && (
              <div className="flex items-center gap-2 text-xs bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20">
                <Check className="w-3 h-3" /> {nomeEntrada}: {Math.round(roiEntrada.w)}x{Math.round(roiEntrada.h)}%
                <button onClick={() => onEntradaChange(null)} className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            )}
            {roiSaida && (
              <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20">
                <Check className="w-3 h-3" /> {nomeSaida}: {Math.round(roiSaida.w)}x{Math.round(roiSaida.h)}%
                <button onClick={() => onSaidaChange(null)} className="ml-1 hover:text-red-400"><X className="w-3 h-3" /></button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
