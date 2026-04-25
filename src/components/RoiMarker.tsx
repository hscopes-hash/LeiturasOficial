'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Check, X, Loader2 } from 'lucide-react';

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
  const [desenhando, setDesenhando] = useState<'entrada' | 'saida' | null>(null);
  const [inicio, setInicio] = useState<{ x: number; y: number } | null>(null);
  const [modo, setModo] = useState<'entrada' | 'saida'>('entrada');
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  // Desenhar overlay quando imagem ou ROI mudar
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imagem) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxW = container.clientWidth;
      const maxH = container.clientHeight || 300;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      setNaturalSize({ w: canvas.width, h: canvas.height });

      // Desenhar imagem
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Semi-transparente
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Desenhar ROI de entrada
      if (roiEntrada) {
        const ex = (roiEntrada.x / 100) * canvas.width;
        const ey = (roiEntrada.y / 100) * canvas.height;
        const ew = (roiEntrada.w / 100) * canvas.width;
        const eh = (roiEntrada.h / 100) * canvas.height;

        ctx.clearRect(ex, ey, ew, eh);
        ctx.drawImage(img, ex, ey, ew, eh, ex, ey, ew, eh);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 3;
        ctx.strokeRect(ex, ey, ew, eh);

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(ex, ey - 22, ew, 22);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nomeEntrada, ex + ew / 2, ey - 6);
      }

      // Desenhar ROI de saída
      if (roiSaida) {
        const sx = (roiSaida.x / 100) * canvas.width;
        const sy = (roiSaida.y / 100) * canvas.height;
        const sw = (roiSaida.w / 100) * canvas.width;
        const sh = (roiSaida.h / 100) * canvas.height;

        ctx.clearRect(sx, sy, sw, sh);
        ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, sy, sw, sh);

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(sx, sy - 22, sw, 22);
        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nomeSaida, sx + sw / 2, sy - 6);
      }
    };
    img.src = imagem;
  }, [imagem, roiEntrada, roiSaida, nomeEntrada, nomeSaida]);

  // Converter posição do mouse para % do canvas
  const getPosPercent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
    },
    [],
  );

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
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
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

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
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

        {/* Canvas com imagem + overlay */}
        <div ref={containerRef} className="relative rounded-lg overflow-hidden bg-black min-h-[200px]">
          {imagem ? (
            <>
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair w-full"
              />
              <button
                onClick={() => onImagemChange('')}
                className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
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
