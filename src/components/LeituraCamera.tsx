'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle, Loader2 } from 'lucide-react';

interface ROI {
  x: number; // % (0-100)
  y: number;
  w: number;
  h: number;
}

interface LeituraCameraProps {
  tipoMaquina: {
    descricao: string;
    nomeEntrada: string;
    nomeSaida: string;
    imagemReferencia?: string | null;
    roiEntrada?: ROI | null;
    roiSaida?: ROI | null;
  };
  onSave: (leitura: { entradaNova: number; saidaNova: number }) => void;
}

export default function LeituraCamera({
  tipoMaquina,
  onSave,
}: LeituraCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const historicoRef = useRef<{ entrada: string; saida: string }[]>([]);

  const [ativo, setAtivo] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [valorEntrada, setValorEntrada] = useState('');
  const [valorSaida, setValorSaida] = useState('');
  const [estavel, setEstavel] = useState(false);
  const [tentativas, setTentativas] = useState(0);

  const roiEntrada = tipoMaquina.roiEntrada;
  const roiSaida = tipoMaquina.roiSaida;

  // =============================================
  // Crop da ROI do frame atual
  // =============================================
  const cropROI = useCallback(
    (video: HTMLVideoElement, roi: ROI): string => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const sx = Math.round(video.videoWidth * roi.x / 100);
      const sy = Math.round(video.videoHeight * roi.y / 100);
      const sw = Math.round(video.videoWidth * roi.w / 100);
      const sh = Math.round(video.videoHeight * roi.h / 100);

      canvas.width = sw;
      canvas.height = sh;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

      return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    },
    [],
  );

  // =============================================
  // Processar frame → chamar AI Vision
  // =============================================
  const processarFrame = useCallback(async () => {
    if (!videoRef.current || processando) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    setProcessando(true);
    setTentativas((prev) => prev + 1);

    try {
      const base64Entrada = roiEntrada ? cropROI(video, roiEntrada) : '';
      const base64Saida = roiSaida ? cropROI(video, roiSaida) : '';

      if (!base64Entrada && !base64Saida) return;

      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64Entrada: base64Entrada,
          imageBase64Saida: base64Saida,
          nomeEntrada: tipoMaquina.nomeEntrada,
          nomeSaida: tipoMaquina.nomeSaida,
        }),
      });

      const data = await res.json();
      const entrada = data.entrada || '';
      const saida = data.saida || '';

      if (entrada || saida) {
        if (entrada) setValorEntrada(entrada);
        if (saida) setValorSaida(saida);

        // Verificar estabilização (últimos 3 frames iguais)
        historicoRef.current.push({ entrada, saida });
        if (historicoRef.current.length > 5) {
          historicoRef.current.shift();
        }

        const ultimos = historicoRef.current.slice(-3);
        if (ultimos.length >= 3) {
          const todosIguais = ultimos.every(
            (f) =>
              f.entrada === ultimos[0].entrada && f.saida === ultimos[0].saida,
          );
          if (todosIguais) {
            setEstavel(true);
            pararLoop();
          }
        }
      }
    } catch (e) {
      console.error('Erro no processamento:', e);
    } finally {
      setProcessando(false);
    }
  }, [cropROI, processando, roiEntrada, roiSaida, tipoMaquina]);

  // =============================================
  // Loop de escaneamento (a cada 800ms)
  // =============================================
  const iniciarLoop = () => {
    historicoRef.current = [];
    setEstavel(false);
    setTentativas(0);
    intervalRef.current = setInterval(processarFrame, 800);
  };

  const pararLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // =============================================
  // Iniciar/Parar câmera
  // =============================================
  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setAtivo(true);
      setTimeout(iniciarLoop, 1000);
    } catch (e) {
      console.error('Erro ao acessar câmera:', e);
    }
  };

  const pararCamera = () => {
    pararLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAtivo(false);
    setEstavel(false);
    setValorEntrada('');
    setValorSaida('');
    setTentativas(0);
    historicoRef.current = [];
  };

  // =============================================
  // Salvar leitura
  // =============================================
  const salvarLeitura = () => {
    onSave({
      entradaNova: parseInt(valorEntrada) || 0,
      saidaNova: parseInt(valorSaida) || 0,
    });
    pararCamera();
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="p-3 bg-zinc-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold">{tipoMaquina.descricao}</span>
        </div>
        {tipoMaquina.imagemReferencia && (
          <img
            src={tipoMaquina.imagemReferencia}
            className="w-12 h-9 object-cover rounded border border-zinc-600"
            alt="Ref"
          />
        )}
      </div>

      {/* Área da câmera */}
      <div className="flex-1 relative overflow-hidden">
        {/* Template de referência (overlay) */}
        {tipoMaquina.imagemReferencia && ativo && !estavel && (
          <div className="absolute top-3 right-3 z-20 bg-black/80 rounded-xl p-2 border border-white/20">
            <img
              src={tipoMaquina.imagemReferencia}
              className="w-28 h-20 object-cover rounded-lg"
              alt="Enquadre assim"
            />
            <p className="text-[10px] text-white/70 text-center mt-1">
              Enquadre assim
            </p>
          </div>
        )}

        {/* Video */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay dos ROI */}
        {ativo && (
          <div className="absolute inset-0 pointer-events-none">
            {roiEntrada && (
              <div
                style={{
                  left: `${roiEntrada.x}%`,
                  top: `${roiEntrada.y}%`,
                  width: `${roiEntrada.w}%`,
                  height: `${roiEntrada.h}%`,
                }}
                className="border-[3px] border-green-400 bg-green-400/10 rounded-lg"
              />
            )}
            {roiSaida && (
              <div
                style={{
                  left: `${roiSaida.x}%`,
                  top: `${roiSaida.y}%`,
                  width: `${roiSaida.w}%`,
                  height: `${roiSaida.h}%`,
                }}
                className="border-[3px] border-red-400 bg-red-400/10 rounded-lg"
              />
            )}

            {roiEntrada && (
              <span
                style={{
                  left: `${roiEntrada.x}%`,
                  top: `calc(${roiEntrada.y}% - 20px)`,
                }}
                className="absolute text-green-400 text-xs font-bold bg-black/60 px-1 rounded"
              >
                {tipoMaquina.nomeEntrada}
              </span>
            )}
            {roiSaida && (
              <span
                style={{
                  left: `${roiSaida.x}%`,
                  top: `calc(${roiSaida.y}% - 20px)`,
                }}
                className="absolute text-red-400 text-xs font-bold bg-black/60 px-1 rounded"
              >
                {tipoMaquina.nomeSaida}
              </span>
            )}
          </div>
        )}

        {/* Indicador de escaneamento */}
        {ativo && !estavel && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full flex items-center gap-2">
            {processando ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            ) : (
              <Camera className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-sm">
              {processando ? 'Processando...' : 'Escaneando...'}
            </span>
            <span className="text-xs text-zinc-400">({tentativas}x)</span>
          </div>
        )}

        {/* Resultado estabilizado */}
        {estavel && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/95 text-white px-8 py-5 rounded-2xl min-w-[280px] text-center space-y-3 border border-green-500/30 shadow-lg shadow-green-500/10">
            <CheckCircle className="w-6 h-6 text-green-400 mx-auto" />
            <div className="flex gap-8 justify-center">
              <div>
                <p className="text-green-400 text-xs font-medium">
                  {tipoMaquina.nomeEntrada}
                </p>
                <p className="text-3xl font-bold tracking-wider">
                  {valorEntrada}
                </p>
              </div>
              <div className="w-px bg-zinc-700" />
              <div>
                <p className="text-red-400 text-xs font-medium">
                  {tipoMaquina.nomeSaida}
                </p>
                <p className="text-3xl font-bold tracking-wider">
                  {valorSaida}
                </p>
              </div>
            </div>
            <Button
              onClick={salvarLeitura}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Salvar Leitura
            </Button>
          </div>
        )}
      </div>

      {/* Botão de controle */}
      <div className="p-4 bg-zinc-900">
        {!ativo ? (
          <Button
            onClick={iniciarCamera}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white"
            size="lg"
          >
            <Camera className="w-5 h-5 mr-2" />
            Iniciar Camera
          </Button>
        ) : (
          <Button
            onClick={pararCamera}
            variant="outline"
            className="w-full border-zinc-600 text-zinc-300"
            size="lg"
          >
            <X className="w-5 h-5 mr-2" />
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
