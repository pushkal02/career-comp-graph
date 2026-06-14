import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Eye, EyeOff, Sparkles, Layout } from 'lucide-react';
import { convertCurrency, convertToPPP } from '../utils/currency';

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height - radius);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawGlowCircle(ctx, cx, cy, r, color) {
  ctx.save();
  let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function ShareCardModal({ 
  isOpen, 
  onClose, 
  salaryEvents, 
  compEvents, 
  startDate, 
  currency, 
  userName,
  pppMode,
  exchangeRates,
  pppFactors 
}) {
  const canvasRef = useRef(null);
  const [theme, setTheme] = useState('midnight'); // 'midnight', 'emerald', 'sunset', 'classic'
  const [showName, setShowName] = useState(true);
  const [redact, setRedact] = useState(true);

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Stats computation identical to DashboardStats
    const getStats = () => {
      const baselineDate = startDate || "2024-01";
      const activeCurrency = currency || 'USD';

      const formatCurrencyVal = (val) => {
        if (pppMode) {
          const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
          }).format(val);
          return formatted.replace('$', 'PPP $');
        }

        const getLocaleForCurrency = (curr) => {
          switch (curr) {
            case 'INR': return 'en-IN';
            case 'GBP': return 'en-GB';
            case 'EUR': return 'en-IE';
            case 'JPY': return 'ja-JP';
            default: return 'en-US';
          }
        };
        const locale = getLocaleForCurrency(activeCurrency);
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: activeCurrency,
          maximumFractionDigits: 0
        }).format(val);
      };

      const getYearDiff = (date1, date2) => {
        const d1 = new Date(date1.length === 7 ? `${date1}-01` : date1);
        const d2 = new Date(date2.length === 7 ? `${date2}-01` : date2);
        const y1 = d1.getUTCFullYear();
        const m1 = d1.getUTCMonth();
        const day1 = d1.getUTCDate();
        const y2 = d2.getUTCFullYear();
        const m2 = d2.getUTCMonth();
        const day2 = d2.getUTCDate();
        const monthDiff = (y2 - y1) * 12 + (m2 - m1);
        const dayDiff = day2 - day1;
        return (monthDiff + dayDiff / 30.4368) / 12;
      };

      const normalizeDate = (d) => (d && d.length === 7) ? `${d}-01` : d;

      const convertValue = (amount, eventCurrency, countryCode) => {
        if (pppMode) {
          return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
        } else {
          return convertCurrency(amount, eventCurrency, activeCurrency, exchangeRates);
        }
      };

      const sortedSalaries = [...salaryEvents].sort((a, b) => 
        normalizeDate(a.date).localeCompare(normalizeDate(b.date))
      );

      const currentBase = sortedSalaries.length > 0
        ? convertValue(sortedSalaries[sortedSalaries.length - 1].salary, sortedSalaries[sortedSalaries.length - 1].currency, sortedSalaries[sortedSalaries.length - 1].country)
        : 0;

      // Growth percentage calculation
      let growthPct = 0;
      if (sortedSalaries.length > 1) {
        const firstSalary = convertValue(sortedSalaries[0].salary, sortedSalaries[0].currency, sortedSalaries[0].country);
        const lastSalary = convertValue(sortedSalaries[sortedSalaries.length - 1].salary, sortedSalaries[sortedSalaries.length - 1].currency, sortedSalaries[sortedSalaries.length - 1].country);
        if (firstSalary > 0) {
          growthPct = ((lastSalary - firstSalary) / firstSalary) * 100;
        }
      }

      const today = new Date();
      const cutoffDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const normCutoff = `${cutoffDate}-01`;
      const normBaseline = normalizeDate(baselineDate);

      let cumulativeBaseEarned = 0;
      if (sortedSalaries.length > 0 && normBaseline < normCutoff) {
        for (let i = 0; i < sortedSalaries.length; i++) {
          const currentEvent = sortedSalaries[i];
          const nextEvent = sortedSalaries[i + 1];
          
          let segmentStart = normalizeDate(currentEvent.date);
          if (segmentStart < normBaseline) segmentStart = normBaseline;
          if (segmentStart > normCutoff) segmentStart = normCutoff;
          
          let segmentEnd = nextEvent ? normalizeDate(nextEvent.date) : normCutoff;
          if (segmentEnd < normBaseline) segmentEnd = normBaseline;
          if (segmentEnd > normCutoff) segmentEnd = normCutoff;
          
          const durationYears = getYearDiff(segmentStart, segmentEnd);
          if (durationYears > 0) {
            const segmentSalaryInDisplay = convertValue(currentEvent.salary, currentEvent.currency, currentEvent.country);
            cumulativeBaseEarned += segmentSalaryInDisplay * durationYears;
          }
        }
      }

      const totalBonus = compEvents
        .filter(e => e.type === 'bonus' && normalizeDate(e.date) < normCutoff)
        .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

      const totalVest = compEvents
        .filter(e => e.type === 'vest' && normalizeDate(e.date) < normCutoff)
        .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

      const totalRealized = cumulativeBaseEarned + totalBonus + totalVest;

      return {
        currentBase: formatCurrencyVal(currentBase),
        totalBonus: formatCurrencyVal(totalBonus),
        totalVest: formatCurrencyVal(totalVest),
        totalRealized: formatCurrencyVal(totalRealized),
        growthPct,
        milestonesCount: salaryEvents.length + compEvents.length,
        activeCurrency
      };
    };

    const stats = getStats();
    const isLightMode = theme === 'classic' && document.body.getAttribute('data-theme') === 'light';

    // 1. Draw Background Gradient
    let bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    if (theme === 'midnight') {
      bgGrad.addColorStop(0, '#070a13');
      bgGrad.addColorStop(1, '#1e1b4b');
    } else if (theme === 'emerald') {
      bgGrad.addColorStop(0, '#040d12');
      bgGrad.addColorStop(1, '#064e3b');
    } else if (theme === 'sunset') {
      bgGrad.addColorStop(0, '#0f0505');
      bgGrad.addColorStop(1, '#4c0519');
    } else {
      // Classic
      if (isLightMode) {
        bgGrad.addColorStop(0, '#f8fafc');
        bgGrad.addColorStop(1, '#e2e8f0');
      } else {
        bgGrad.addColorStop(0, '#070a13');
        bgGrad.addColorStop(1, '#0f162a');
      }
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Draw Soft Highlights (Glow)
    if (theme === 'midnight') {
      drawGlowCircle(ctx, 200, 150, 260, 'rgba(99, 102, 241, 0.15)');
      drawGlowCircle(ctx, 1000, 480, 260, 'rgba(168, 85, 247, 0.15)');
    } else if (theme === 'emerald') {
      drawGlowCircle(ctx, 250, 150, 260, 'rgba(16, 185, 129, 0.12)');
      drawGlowCircle(ctx, 950, 480, 260, 'rgba(20, 184, 166, 0.12)');
    } else if (theme === 'sunset') {
      drawGlowCircle(ctx, 200, 180, 260, 'rgba(245, 158, 11, 0.12)');
      drawGlowCircle(ctx, 1000, 450, 260, 'rgba(244, 63, 94, 0.12)');
    } else if (!isLightMode) {
      drawGlowCircle(ctx, 300, 200, 280, 'rgba(99, 102, 241, 0.15)');
    }

    // 3. Draw Glass Card
    const cardX = 50;
    const cardY = 50;
    const cardW = 1100;
    const cardH = 530;
    const cardRadius = 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 15;

    ctx.fillStyle = isLightMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(15, 22, 42, 0.45)';
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.fill();
    ctx.restore();

    // Subtle Border Stroke
    ctx.strokeStyle = isLightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
    ctx.stroke();

    // 4. Header Titles
    const primaryColor = isLightMode ? '#4f46e5' : '#6366f1';
    const textPrimary = isLightMode ? '#0f172a' : '#f8fafc';
    const textSecondary = isLightMode ? '#475569' : '#94a3b8';
    const accentColor = theme === 'emerald' ? '#10b981' : theme === 'sunset' ? '#f59e0b' : '#38bdf8';

    // Logo / Brand water mark
    ctx.fillStyle = primaryColor;
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('⚡ CompGraph', 980, 95);

    // Title
    ctx.fillStyle = textPrimary;
    ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
    const nameLabel = showName && userName ? `${userName}'s` : 'My';
    ctx.fillText(`${nameLabel} Career Milestones`, 90, 100);

    // Subtitle
    ctx.fillStyle = textSecondary;
    ctx.font = '500 16px system-ui, -apple-system, sans-serif';
    const dateRangeStr = `Timeline starting from ${startDate || '2024-01'} • ${stats.milestonesCount} career milestone events logged`;
    ctx.fillText(dateRangeStr, 90, 130);

    // 5. Draw Simplified Graph
    const chartX = 90;
    const chartY = 175;
    const chartW = 1020;
    const chartH = 210;

    // Draw Grid Lines (horizontal only)
    ctx.strokeStyle = isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const lineY = chartY + (chartH / 3) * i;
      ctx.beginPath();
      ctx.moveTo(chartX, lineY);
      ctx.lineTo(chartX + chartW, lineY);
      ctx.stroke();
    }

    // Parse timelines and values
    const sortedSalaries = [...salaryEvents].sort((a, b) => 
      (a.date.length === 7 ? `${a.date}-01` : a.date).localeCompare(b.date.length === 7 ? `${b.date}-01` : b.date)
    );

    if (sortedSalaries.length > 0) {
      // Find range
      const baselineDate = startDate || "2024-01";
      const [startYear, startMonth] = baselineDate.split('-').map(Number);
      const today = new Date();
      const currentYear = today.getFullYear();
      const endYear = Math.max(currentYear, startYear);
      const totalMonths = (endYear - startYear) * 12 + (12 - startMonth);

      const getMonthsSinceStart = (dateStr) => {
        const parts = dateStr.split('-');
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = parts[2] ? Number(parts[2]) : 1;
        const baseMonths = (year - startYear) * 12 + (month - startMonth);
        return baseMonths + (day - 1) / 30.4368;
      };

      const convertValue = (amount, eventCurrency, countryCode) => {
        if (pppMode) {
          return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
        } else {
          return convertCurrency(amount, eventCurrency, stats.activeCurrency, exchangeRates);
        }
      };

      const salariesMapped = salaryEvents.map(e => convertValue(e.salary, e.currency, e.country));
      const maxSalary = salariesMapped.length > 0 ? Math.max(...salariesMapped) : 100000;
      const maxY = maxSalary * 1.15;
      const minY = 0;

      const getCanvasX = (dateStr) => {
        const months = getMonthsSinceStart(dateStr);
        const ratio = Math.max(0, Math.min(1, months / totalMonths));
        return chartX + ratio * chartW;
      };

      const getCanvasY = (salaryVal) => {
        const ratio = (salaryVal - minY) / (maxY - minY);
        return chartY + chartH - ratio * chartH;
      };

      // Draw Salary Area Shade
      ctx.beginPath();
      const firstX = getCanvasX(sortedSalaries[0].date);
      ctx.moveTo(firstX, getCanvasY(0));
      
      let lastX = firstX;
      let lastY = getCanvasY(convertValue(sortedSalaries[0].salary, sortedSalaries[0].currency, sortedSalaries[0].country));
      ctx.lineTo(firstX, lastY);

      for (let i = 0; i < sortedSalaries.length; i++) {
        const curr = sortedSalaries[i];
        const next = sortedSalaries[i + 1];
        const currSal = convertValue(curr.salary, curr.currency, curr.country);
        const currentX = getCanvasX(curr.date);
        const currentY = getCanvasY(currSal);

        ctx.lineTo(currentX, lastY);
        ctx.lineTo(currentX, currentY);

        lastX = currentX;
        lastY = currentY;

        if (!next) {
          const endChartX = chartX + chartW;
          ctx.lineTo(endChartX, currentY);
          lastX = endChartX;
        }
      }
      ctx.lineTo(lastX, getCanvasY(0));
      ctx.closePath();

      const areaGrad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
      areaGrad.addColorStop(0, `${accentColor}33`);
      areaGrad.addColorStop(1, `${accentColor}00`);
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Draw Step Line
      ctx.beginPath();
      ctx.moveTo(firstX, getCanvasY(convertValue(sortedSalaries[0].salary, sortedSalaries[0].currency, sortedSalaries[0].country)));
      
      lastY = getCanvasY(convertValue(sortedSalaries[0].salary, sortedSalaries[0].currency, sortedSalaries[0].country));
      for (let i = 0; i < sortedSalaries.length; i++) {
        const curr = sortedSalaries[i];
        const currSal = convertValue(curr.salary, curr.currency, curr.country);
        const currentX = getCanvasX(curr.date);
        const currentY = getCanvasY(currSal);

        ctx.lineTo(currentX, lastY);
        ctx.lineTo(currentX, currentY);

        lastY = currentY;

        if (i === sortedSalaries.length - 1) {
          ctx.lineTo(chartX + chartW, currentY);
        }
      }
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Draw Payout Circles
      const maxCompAmount = compEvents.length > 0 
        ? Math.max(...compEvents.map(e => convertValue(e.amount, e.currency, e.country))) 
        : 10000;

      const getCircleRadius = (amt) => {
        const minRadius = 5;
        const maxRadius = 24;
        if (maxCompAmount === 0) return minRadius;
        return Math.sqrt(minRadius * minRadius + (maxRadius * maxRadius - minRadius * minRadius) * (amt / maxCompAmount));
      };

      compEvents.forEach(evt => {
        const cx = getCanvasX(evt.date);
        let activeSalary = sortedSalaries[0].salary;
        let activeCurrency = sortedSalaries[0].currency;
        let activeCountry = sortedSalaries[0].country;
        for (let i = 0; i < sortedSalaries.length; i++) {
          if ((sortedSalaries[i].date.length === 7 ? `${sortedSalaries[i].date}-01` : sortedSalaries[i].date) <= (evt.date.length === 7 ? `${evt.date}-01` : evt.date)) {
            activeSalary = sortedSalaries[i].salary;
            activeCurrency = sortedSalaries[i].currency;
            activeCountry = sortedSalaries[i].country;
          }
        }
        const cy = getCanvasY(convertValue(activeSalary, activeCurrency, activeCountry));
        const radius = getCircleRadius(convertValue(evt.amount, evt.currency, evt.country));

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        let eventColor = '#10b981'; // bonus
        if (evt.type === 'grant') eventColor = '#f59e0b';
        if (evt.type === 'vest') eventColor = '#a855f7';
        ctx.fillStyle = `${eventColor}4D`;
        ctx.strokeStyle = eventColor;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      });
    }

    // 6. Stats Grid at bottom
    const statBoxLabels = ['Realized Career Earnings', 'Current Salary Remuneration', 'Realized Cash Bonuses', 'Realized Vested Stock'];
    const statBoxKeys = ['totalRealized', 'currentBase', 'totalBonus', 'totalVest'];
    const statColors = [primaryColor, accentColor, '#10b981', '#a855f7'];

    const boxW = 225;
    const boxH = 95;
    const startBoxX = 90;
    const boxGap = 40;
    const boxY = 445;

    for (let i = 0; i < 4; i++) {
      const bX = startBoxX + i * (boxW + boxGap);
      
      ctx.fillStyle = isLightMode ? 'rgba(15, 23, 42, 0.03)' : 'rgba(255, 255, 255, 0.02)';
      ctx.strokeStyle = isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, bX, boxY, boxW, boxH, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = statColors[i];
      ctx.fillRect(bX, boxY + 10, 4, boxH - 20);

      ctx.fillStyle = textSecondary;
      ctx.font = '600 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(statBoxLabels[i], bX + 20, boxY + 30);

      const statVal = stats[statBoxKeys[i]];
      ctx.fillStyle = textPrimary;
      ctx.font = 'bold 24px monospace';

      if (redact) {
        ctx.fillText('••••••', bX + 20, boxY + 68);
        ctx.fillStyle = isLightMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(bX + 18, boxY + 46, 115, 26);
      } else {
        ctx.fillText(statVal, bX + 20, boxY + 68);
      }

      ctx.fillStyle = textSecondary;
      ctx.font = '500 11px system-ui, -apple-system, sans-serif';
      let subtext;
      if (i === 0) {
        subtext = 'Base + Bonus + Vested';
      } else if (i === 1) {
        subtext = stats.growthPct > 0 ? `+${stats.growthPct.toFixed(1)}% growth rate` : 'Annualized rate';
      } else if (i === 2) {
        subtext = 'Performance milestones';
      } else {
        subtext = 'Realized equity value';
      }
      ctx.fillText(subtext, bX + 20, boxY + 86);
    }
  }, [theme, showName, redact, salaryEvents, compEvents, startDate, currency, userName, pppMode, exchangeRates, pppFactors]);

  useEffect(() => {
    if (!isOpen) return;
    drawCard();
  }, [isOpen, drawCard]);

  const downloadCardPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `career-summary-card-${startDate || '2024-01'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)' }}>
      <div 
        className="modal-content glass-panel animate-fade-in" 
        style={{ 
          width: '95%', 
          maxWidth: '960px', 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          padding: '2rem', 
          display: 'grid', 
          gridTemplateColumns: '1fr', 
          gap: '2rem' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles style={{ color: 'var(--color-primary)' }} />
            Generate Shareable Summary Card
          </h2>
          <button 
            onClick={onClose} 
            className="preset-btn"
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="share-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
          {/* Canvas Preview Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <div style={{ width: '100%', maxWidth: '580px', overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--glass-shadow)', background: '#000' }}>
              <canvas 
                ref={canvasRef} 
                width={1200} 
                height={630} 
                style={{ 
                  width: '100%', 
                  display: 'block', 
                  aspectRatio: '1200 / 630' 
                }} 
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Preview displays active layout with high-resolution coordinates (1200x630px). Perfect size for LinkedIn & Twitter timeline previews.
            </p>
          </div>

          {/* Controls Side Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <Layout size={14} /> Customize Card
            </h3>

            {/* Theme Select */}
            <div className="form-group">
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gradient Background Theme</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.35rem' }}>
                {[
                  { id: 'midnight', label: 'Midnight Aurora' },
                  { id: 'emerald', label: 'Emerald' },
                  { id: 'sunset', label: 'Sunset Glow' },
                  { id: 'classic', label: 'Classic Slate' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className="btn"
                    style={{
                      padding: '0.4rem 0.5rem',
                      fontSize: '0.78rem',
                      background: theme === t.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                      border: theme === t.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                      color: theme === t.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Name Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Show Profile Name</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Include name on header</div>
              </div>
              <button
                onClick={() => setShowName(!showName)}
                className="preset-btn"
                style={{
                  width: '35px',
                  height: '35px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: showName ? 'rgba(99,102,241,0.1)' : 'transparent',
                  borderColor: showName ? 'var(--color-primary)' : 'var(--border-color)'
                }}
              >
                {showName ? <Eye size={15} /> : <EyeOff size={15} style={{ color: 'var(--text-muted)' }} />}
              </button>
            </div>

            {/* Redaction / Masking Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Redact Sensitive Data</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mask numbers with tape block</div>
              </div>
              <button
                onClick={() => setRedact(!redact)}
                className="preset-btn"
                style={{
                  width: '35px',
                  height: '35px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: redact ? 'rgba(239,68,68,0.1)' : 'transparent',
                  borderColor: redact ? '#ef4444' : 'var(--border-color)',
                  color: redact ? '#ef4444' : 'var(--text-muted)'
                }}
              >
                {redact ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button 
                onClick={downloadCardPNG} 
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <Download size={16} /> Download Summary Card (PNG)
              </button>
              <button 
                onClick={onClose} 
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.65rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS layout adjustment for mobile responsiveness in modal grid */}
      <style>{`
        @media (max-width: 768px) {
          .share-modal-body {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
