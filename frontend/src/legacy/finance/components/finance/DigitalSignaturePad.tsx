// @ts-nocheck
import React, { useEffect, useRef } from 'react';

interface DigitalSignaturePadProps {
  label: string;
  value: string;
  signerName?: string;
  onChange: (value: string) => void;
}

const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({ label, value, signerName, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const width = wrapper.clientWidth;
    const height = 150;
    const ratio = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentValue = value;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;

    if (currentValue) {
      const image = new Image();
      image.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
      };
      image.src = currentValue;
    }
  };

  const commitSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, wrapper.clientWidth, 150);
    onChange('');
  };

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  useEffect(() => {
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [value]);

  return (
    <div ref={wrapperRef} className="rounded-[22px] border border-slate-200 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</label>
        <button
          type="button"
          onClick={clearSignature}
          className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6a00] transition hover:text-[#e85f00]"
        >
          Clear
        </button>
      </div>
      <div className="mt-3 rounded-[20px] border border-dashed border-slate-300 bg-white dark:border-white/10 dark:bg-[#071b27]">
        <canvas
          ref={canvasRef}
          className="block h-[150px] w-full touch-none cursor-crosshair"
          onPointerDown={(event) => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            const point = getPoint(event);
            if (!canvas || !ctx || !point) return;
            drawingRef.current = true;
            lastPointRef.current = point;
            canvas.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drawingRef.current) return;
            const point = getPoint(event);
            const lastPoint = lastPointRef.current;
            if (!point || !lastPoint) return;
            drawLine(lastPoint, point);
            lastPointRef.current = point;
          }}
          onPointerUp={(event) => {
            if (!drawingRef.current) return;
            drawingRef.current = false;
            lastPointRef.current = null;
            (event.currentTarget as HTMLCanvasElement).releasePointerCapture(event.pointerId);
            commitSignature();
          }}
          onPointerLeave={() => {
            if (!drawingRef.current) return;
            drawingRef.current = false;
            lastPointRef.current = null;
            commitSignature();
          }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Draw your signature here. {signerName ? `Signed by ${signerName}.` : 'The typed name can still be edited above.'}
      </p>
    </div>
  );
};

export default DigitalSignaturePad;
