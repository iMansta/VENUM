/**
 * Logotipo oficial da guilda I V E N U M I
 */
const VenumLogo = ({
  className = 'h-10 w-auto',
  showCredit = false,
  creditClassName = 'text-[10px] text-gray-500 tracking-widest uppercase',
}) => (
  <div className="flex flex-col items-start gap-1">
    <img
      src="/venum-logo.png"
      alt="I V E N U M I"
      className={className}
      decoding="async"
    />
    {showCredit && (
      <span className={creditClassName}>Guilda I V E N U M I</span>
    )}
  </div>
);

export default VenumLogo;
