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
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [desenhando, setDesenhando] = useState<'entrada' | 'saida' | null>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);
  const [modo, setModo] = useState<'entrada' | 'saida'>('entrada');
  const [imgLoaded, setImgLoaded] = useState(false);

  // Desenhar overlay (escurecimento + ROI) sobre a imagem SEM redesenhar a imagem
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !img || !wrapper || !imgLoaded) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = img.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    // Tamanho do canvas em pixels reais (suporte a retina)
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Escurecer toda a imagem
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);

    // Desenhar ROI de entrada (limpar escurecimento na região)
    if (roiEntrada) {
      const ex = (roiEntrada.x / 100) * w;
      const ey = (roiEntrada.y / 100) * h;
      const ew = (roiEntrada.w / 100) * w;
      const eh = (roiEntrada.h / 100) * h;

      ctx.clearRect(ex, ey, ew, eh);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(ex + 1, ey + 1, ew - 2, eh - 2);
      ctx.setLineDash([]);

      // Label
      const label = nomeEntrada;
      ctx.font = 'bold 12px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = ex + ew / 2 - tw / 2 - 6;
      const ly = ey > 24 ? ey - 26 : ey + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 12, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.textAlign = 'center';
      ctx.fillText(label, ex + ew / 2, ly + 14);
    }

    // Desenhar ROI de saída
    if (roiSaida) {
      const sx = (roiSaida.x / 100) * w;
      const sy = (roiSaida.y / 100) * h;
      const sw = (roiSaida.w / 100) * w;
      const sh = (roiSaida.h / 100) * h;

      ctx.clearRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      ctx.setLineDash([]);

      const label = nomeSaida;
      ctx.font = 'bold 12px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const lx = sx + sw / 2 - tw / 2 - 6;
      const ly = sy > 24 ? sy - 26 : sy + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw + 12, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.textAlign = 'center';
      ctx.fillText(label, sx + sw / 2, ly + 14);
    }
  }, [roiEntrada, roiSaida, nomeEntrada, nomeSaida, imgLoaded]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // Redesenhar ao redimensionar a janela
  useEffect(() => {
    const onResize = () => drawOverlay();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawOverlay]);

  // Converter posição do mouse para % da área visível da imagem
  const getPosPercent = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };
      const rect = img.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
    },
    [],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setDesenhando(modo);
    setInicio(getPosPercent(e));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!desenhando || !inicio) return;

    const current = getPosPercent(e);
    const x = Math.min(inicio.x, current.x);
    const y = Math.min(inicio.y, current.y);
    const w = Math.abs(current.x - inicio.x);
    const h = Math.abs(current.y - inicio.y);

    const roi = { x, y, w, h };
    if (desenhando === 'entrada') onEntradaChange(roi);
    else onSaidaChange(roi);
  };

  const handleMouseUp = () => {
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

      // Aguardar câmera estabilizar
      await new Promise((r) => setTimeout(r, 1500));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      stream.getTracks().forEach((t) => t.stop());

      // PNG para qualidade máxima
      const base64 = canvas.toDataURL('image/png');
      onImagemChange(base64);
    } catch (e) {
      console.error('Erro ao capturar:', e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onImagemChange(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const limparEntrada = () => onEntradaChange(null);
  const limparSaida = () => onSaidaChange(null);

  const corModo = modo === 'entrada' ? 'text-green-400 border-green-500' : 'text-red-400 border-red-500';
  const bgModo = modo === 'entrada' ? 'bg-green-500/10' : 'bg-red-500/10';

  return (
    <div className="space-y-3">
      {/* Imagem de referência */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Imagem de Referência
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCapture}
              className="h-7 text-xs border-zinc-600"
            >
              <Camera className="w-3 h-3 mr-1" />
              Tirar Foto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs border-zinc-600"
            >
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Imagem + overlay de marcação */}
        <div
          ref={wrapperRef}
          className="relative rounded-lg overflow-hidden bg-black/90 min-h-[200px] flex items-center justify-center"
        >
          {imagem ? (
            <>
              {/* Imagem original - renderizada pelo browser em qualidade máxima */}
              <img
                ref={imgRef}
                src={imagem}
                alt="Referência"
                onLoad={() => setImgLoaded(true)}
                className="block max-w-full max-h-[400px] object-contain"
                draggable={false}
              />

              {/* Canvas transparente APENAS para overlay de marcação */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="absolute top-0 left-0 cursor-crosshair"
              />

              <button
                onClick={() => {
                  onImagemChange('');
                  setImgLoaded(false);
                }}
                className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
              <Camera className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Tire uma foto do display ou faça upload</p>
              <p className="text-xs mt-1">A imagem servirá de guia para marcar as regiões</p>
            </div>
          )}
        </div>
      </div>

      {/* Seletor de modo + instruções */}
      {imagem && (
        <>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground flex-1">
              Selecione o modo e desenhe o retângulo na imagem:
            </p>
            <div className="flex rounded-lg overflow-hidden border border-zinc-700">
              <button
                onClick={() => setModo('entrada')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${modo === 'entrada' ? `${bgModo} ${corModo}` : 'text-zinc-400 hover:text-white'}`}
              >
                {nomeEntrada}
              </button>
              <button
                onClick={() => setModo('saida')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${modo === 'saida' ? `${bgModo} ${corModo}` : 'text-zinc-400 hover:text-white'}`}
              >
                {nomeSaida}
              </button>
            </div>
          </div>

          {/* ROI definidos */}
          <div className="flex gap-3">
            {roiEntrada && (
              <div className="flex items-center gap-2 text-xs bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20">
                <Check className="w-3 h-3" />
                {nomeEntrada}: {Math.round(roiEntrada.w)}x{Math.round(roiEntrada.h)}%
                <button onClick={limparEntrada} className="ml-1 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {roiSaida && (
              <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20">
                <Check className="w-3 h-3" />
                {nomeSaida}: {Math.round(roiSaida.w)}x{Math.round(roiSaida.h)}%
                <button onClick={limparSaida} className="ml-1 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
