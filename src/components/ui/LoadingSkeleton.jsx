import { Loader2 } from 'lucide-react';

/**
 * LoadingSkeleton - Skeleton screen para carregamento assíncrono.
 *
 * Evita que a UI "pule" durante o fetch. Estilo consistente com o
 * tema escuro do Albion Online.
 *
 * Variantes:
 *   - card    → caixa genérica de 200x100
 *   - row     → linha horizontal (h-12)
 *   - grid    → grid de cards (3 colunas × 2 linhas)
 *   - list    → lista de itens
 *   - spinner → spinner centralizado com texto
 */

const SkeletonBase = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 rounded ${className}`}
  />
);

const SkeletonCard = () => (
  <SkeletonBase className="h-24 w-full" />
);

const SkeletonRow = () => (
  <SkeletonBase className="h-12 w-full" />
);

const SkeletonGrid = ({ cols = 3, rows = 2 }) => (
  <div className={`grid grid-cols-${cols} sm:grid-cols-${cols} gap-2`}>
    {Array.from({ length: cols * rows }).map((_, i) => (
      <SkeletonBase key={i} className="h-16" />
    ))}
  </div>
);

const SkeletonList = ({ rows = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
);

const SpinnerFallback = ({ text = 'Carregando…' }) => (
  <div className="flex items-center justify-center gap-3 py-8 text-zinc-400">
    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
    <span className="text-sm">{text}</span>
  </div>
);

const LoadingSkeleton = ({ variant = 'spinner', text, rows, cols }) => {
  switch (variant) {
    case 'card':  return <SkeletonCard />;
    case 'row':   return <SkeletonRow />;
    case 'grid':  return <SkeletonGrid cols={cols} rows={rows} />;
    case 'list':  return <SkeletonList rows={rows} />;
    case 'spinner':
    default:      return <SpinnerFallback text={text} />;
  }
};

export default LoadingSkeleton;