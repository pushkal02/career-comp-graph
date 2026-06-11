import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { convertCurrency } from '../utils/currency';

export default function CompChart({ salaryEvents, compEvents, startDate, currency, userName, onImportJSON, is3D = false }) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [hoveredItem, setHoveredItem] = useState(null); // { x, y, title, value, date, type, category }

  // Graph filters state
  const [filters, setFilters] = useState({
    salaryLine: true,
    hike: true,
    promotion: true,
    jobswitch: true,
    bonus: true,
    grant: true,
    vest: true
  });

  // Detect container size for responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        // Keep a minimum width of 500px for desktop/tablet, height responsive but bounded
        setDimensions({
          width: Math.max(width, 500),
          height: width > 1200 ? 460 : 420
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Constants
  const padding = { top: 40, right: 60, bottom: 50, left: 80 };
  
  // Parse baseline start date (default to 2024-01)
  const baselineDate = startDate || "2024-01";
  const [startYear, startMonth] = baselineDate.split('-').map(Number);

  // Helper: Months since start date (supporting day precision)
  const getMonthsSinceStart = (dateStr) => {
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = parts[2] ? Number(parts[2]) : 1;
    
    const baseMonths = (year - startYear) * 12 + (month - startMonth);
    const dayFraction = (day - 1) / 30.4368;
    return baseMonths + dayFraction;
  };

  const normalizeDate = (d) => (d && d.length === 7) ? `${d}-01` : d;

  // Chronologically sort salary events
  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => {
    const normA = normalizeDate(a.date);
    const normB = normalizeDate(b.date);
    return normA.localeCompare(normB);
  });

  // Graph ends exactly on the last day of the current year (December 31st of currentYear)
  const today = new Date();
  const currentYear = today.getFullYear();
  const endYear = Math.max(currentYear, startYear);
  const totalMonths = (endYear - startYear) * 12 + (12 - startMonth);

  // Maximum and Minimum salary for Y scale
  const salaries = salaryEvents.map(e => convertCurrency(e.salary, e.currency, currency));
  const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 100000;
  const maxY = Math.ceil((maxSalary * 1.15) / 10000) * 10000; // Pad 15% and round to nearest $10k
  const minY = 0;

  // Maximum compensation event amount for circle sizing
  const compAmounts = compEvents.map(e => convertCurrency(e.amount, e.currency, currency));
  const maxCompAmount = compAmounts.length > 0 ? Math.max(...compAmounts) : 10000;

  // Export functions
  const downloadChartPNG = () => {
    const svgEl = containerRef.current.querySelector('svg');
    if (!svgEl) return;

    const isLightMode = document.body.getAttribute('data-theme') === 'light';

    // Clone SVG to avoid modifying the live DOM
    const clonedSvg = svgEl.cloneNode(true);
    
    // Set explicit width and height on the cloned SVG
    clonedSvg.setAttribute('width', svgEl.clientWidth || 800);
    clonedSvg.setAttribute('height', svgEl.clientHeight || 420);

    // Create a style element with inline CSS to preserve formatting in export
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      svg { background-color: ${isLightMode ? '#f8fafc' : '#070a13'}; font-family: 'Outfit', sans-serif; }
      .chart-grid-line { stroke: ${isLightMode ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.03)'}; stroke-width: 1; }
      .chart-axis-line { stroke: ${isLightMode ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)'}; stroke-width: 1; }
      .chart-axis-text { fill: ${isLightMode ? '#475569' : '#64748b'}; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
      .chart-line-salary { fill: none; stroke: ${isLightMode ? '#0284c7' : '#38bdf8'}; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
      .chart-line-shadow { fill: url(#salary-gradient); opacity: 0.06; }
      .chart-comp-node { opacity: 0.85; }
      .chart-event-node rect { stroke-width: 1.5; }
      .chart-salary-label { fill: ${isLightMode ? '#0284c7' : '#38bdf8'}; stroke: ${isLightMode ? '#f8fafc' : '#070a13'}; stroke-width: 3px; paint-order: stroke; font-weight: 800; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; }
      .chart-comp-label { fill: ${isLightMode ? '#0f172a' : '#f8fafc'}; stroke: ${isLightMode ? '#f8fafc' : '#070a13'}; stroke-width: 2.5px; paint-order: stroke; font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 9px; }
    `;
    clonedSvg.insertBefore(styleEl, clonedSvg.firstChild);

    // Serialize
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clonedSvg);

    // Add namespaces if missing
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www.w3.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = svgEl.clientWidth || 800;
      const height = svgEl.clientHeight || 420;
      canvas.width = width * 2;
      canvas.height = height * 2;
      
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      
      // Draw background
      ctx.fillStyle = isLightMode ? '#f8fafc' : '#070a13';
      ctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      
      const a = document.createElement('a');
      a.download = 'career-compensation-chart.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = url;
  };

  const exportJSON = () => {
    const data = {
      userName: userName || '',
      salaryEvents,
      compEvents,
      startDate: startDate || '2024-01',
      currency: currency || 'USD',
      exportDate: new Date().toISOString()
    };
    
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    
    const a = document.createElement('a');
    a.download = `career-compensation-data-${startDate || '2024-01'}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.salaryEvents || !Array.isArray(parsed.salaryEvents)) {
          throw new Error("Invalid backup: salaryEvents is missing or not an array.");
        }
        if (!parsed.compEvents || !Array.isArray(parsed.compEvents)) {
          throw new Error("Invalid backup: compEvents is missing or not an array.");
        }
        
        if (onImportJSON) {
          onImportJSON({
            userName: parsed.userName || '',
            salaryEvents: parsed.salaryEvents,
            compEvents: parsed.compEvents,
            startDate: parsed.startDate || '2024-01',
            currency: parsed.currency || 'USD'
          });
        }
      } catch (err) {
        alert(`Failed to import JSON: ${err.message}`);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Coordinate conversion utilities
  const getX = (dateStr) => {
    const months = getMonthsSinceStart(dateStr);
    const ratio = months / totalMonths;
    const chartWidth = dimensions.width - padding.left - padding.right;
    return padding.left + ratio * chartWidth;
  };

  const getY = (salary) => {
    const ratio = (salary - minY) / (maxY - minY);
    const chartHeight = dimensions.height - padding.top - padding.bottom;
    // SVG 0,0 is top-left, so we invert
    return dimensions.height - padding.bottom - ratio * chartHeight;
  };

  // Helper to find base salary at any given date string YYYY-MM
  const getSalaryAtDate = (dateStr) => {
    if (sortedSalaryEvents.length === 0) return 0;
    const normDateStr = normalizeDate(dateStr);
    // Find last salary event on or before this date
    let activeSalary = sortedSalaryEvents[0].salary;
    let activeCurrency = sortedSalaryEvents[0].currency;
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      const normEvtDate = normalizeDate(sortedSalaryEvents[i].date);
      if (normEvtDate <= normDateStr) {
        activeSalary = sortedSalaryEvents[i].salary;
        activeCurrency = sortedSalaryEvents[i].currency;
      }
    }
    return convertCurrency(activeSalary, activeCurrency, currency);
  };

  // Calculate circle radius based on amount (Area proportional to amount)
  // R = sqrt(R_min^2 + (R_max^2 - R_min^2) * fraction)
  const getCircleRadius = (amount) => {
    const minRadius = 8;
    const maxRadius = 38;
    if (maxCompAmount === 0) return minRadius;
    const fraction = amount / maxCompAmount;
    return Math.sqrt(minRadius * minRadius + (maxRadius * maxRadius - minRadius * minRadius) * fraction);
  };

  // Helper: Get currency symbol or fallback to code
  const getCurrencySymbol = (curr) => {
    switch (curr) {
      case 'USD': return '$';
      case 'INR': return '₹';
      case 'GBP': return '£';
      case 'EUR': return '€';
      case 'JPY': return '¥';
      default: return curr + ' ';
    }
  };

  // Helper: Get formatting locale
  const getLocaleForCurrency = (curr) => {
    switch (curr) {
      case 'INR': return 'en-IN';
      case 'GBP': return 'en-GB';
      case 'EUR': return 'en-IE';
      case 'JPY': return 'ja-JP';
      default: return 'en-US';
    }
  };

  // Short currency formatter (e.g. $15k or ₹18,49k / ₹1,52L)
  const formatShortCurrency = (val, eventCurrency) => {
    const activeCurrency = eventCurrency || currency || 'USD';
    const symbol = getCurrencySymbol(activeCurrency);
    const isINR = activeCurrency === 'INR';
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    
    if (isINR) {
      // For INR, use Indian grouping style:
      // If >= 1 Crore (10,000,000), format in Lakhs: e.g. 1.52Cr -> ₹1,52L
      // If < 1 Crore and >= 1 Thousand, format in thousands: e.g. 18.49L -> ₹18,49k
      const approxThousand = Math.round(absVal / 1000) * 1000;
      
      if (approxThousand >= 10000000) {
        const roundedLakh = Math.round(absVal / 100000) * 100000;
        const formatted = new Intl.NumberFormat('en-IN').format(roundedLakh);
        const sliced = formatted.slice(0, -7); // Remove the last 5 digits and commas (",00,000")
        return `${isNegative ? '-' : ''}${symbol}${sliced}L`;
      }
      
      if (approxThousand >= 1000) {
        const formatted = new Intl.NumberFormat('en-IN').format(approxThousand);
        const sliced = formatted.slice(0, -4); // Remove the last 3 digits and comma (",000")
        return `${isNegative ? '-' : ''}${symbol}${sliced}k`;
      }
      
      const formatted = new Intl.NumberFormat('en-IN').format(absVal);
      return `${isNegative ? '-' : ''}${symbol}${formatted}`;
    } else {
      // Non-INR formatting (Western style formatting)
      if (absVal >= 1000000) {
        return `${isNegative ? '-' : ''}${symbol}${parseFloat((absVal / 1000000).toFixed(2))}M`;
      }
      if (absVal >= 1000) {
        return `${isNegative ? '-' : ''}${symbol}${parseFloat((absVal / 1000).toFixed(0))}k`;
      }
      return `${isNegative ? '-' : ''}${symbol}${absVal}`;
    }
  };

  const formatFullCurrency = (val, eventCurrency) => {
    const activeCurrency = eventCurrency || currency || 'USD';
    const locale = getLocaleForCurrency(activeCurrency);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: activeCurrency,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthLabel = months[Number(month) - 1] || month;
    return day ? `${Number(day)} ${monthLabel} ${year}` : `${monthLabel} ${year}`;
  };

  // Generate salary step-line path
  let salaryPathD = '';
  let salaryAreaD = '';
  const salarySegments = [];
  
  if (sortedSalaryEvents.length > 0) {
    const startX = padding.left;
    const startY = getY(convertCurrency(sortedSalaryEvents[0].salary, sortedSalaryEvents[0].currency, currency));
    const bottomY = dimensions.height - padding.bottom;
    const endX = dimensions.width - padding.right;
    
    salaryPathD = `M ${startX} ${startY}`;
    salaryAreaD = `M ${startX} ${bottomY} L ${startX} ${startY}`;
    
    let lastY = startY;
    
    for (let i = 1; i < sortedSalaryEvents.length; i++) {
      const event = sortedSalaryEvents[i];
      const eventX = getX(event.date);
      const eventY = getY(convertCurrency(event.salary, event.currency, currency));
      
      // Step horizontal, then vertical
      salaryPathD += ` L ${eventX} ${lastY} L ${eventX} ${eventY}`;
      salaryAreaD += ` L ${eventX} ${lastY} L ${eventX} ${eventY}`;
      
      lastY = eventY;
    }
    
    // Draw to end of chart
    salaryPathD += ` L ${endX} ${lastY}`;
    salaryAreaD += ` L ${endX} ${lastY} L ${endX} ${bottomY} Z`;

    // Compute segments for text labels
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      const currentEvent = sortedSalaryEvents[i];
      const nextEvent = sortedSalaryEvents[i + 1];
      
      const segmentStartX = i === 0 ? startX : getX(currentEvent.date);
      const segmentEndX = i === sortedSalaryEvents.length - 1 ? endX : getX(nextEvent.date);
      const segmentY = getY(convertCurrency(currentEvent.salary, currentEvent.currency, currency));
      
      salarySegments.push({
        startX: segmentStartX,
        endX: segmentEndX,
        y: segmentY,
        salary: convertCurrency(currentEvent.salary, currentEvent.currency, currency),
        id: currentEvent.id
      });
    }
  }

  // Draw grid lines
  const gridLinesY = [];
  const yTicksCount = 5;
  const salaryDiff = maxY - minY;
  for (let i = 0; i <= yTicksCount; i++) {
    const val = minY + (salaryDiff / yTicksCount) * i;
    gridLinesY.push(val);
  }

  const gridLinesX = [];
  if (totalMonths <= 18) {
    // Draw quarterly ticks for shorter timelines
    for (let m = 0; m <= totalMonths; m += 3) {
      const y = startYear + Math.floor((startMonth - 1 + m) / 12);
      const mon = ((startMonth - 1 + m) % 12) + 1;
      const dateStr = `${y}-${String(mon).padStart(2, '0')}`;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      gridLinesX.push({
        dateStr,
        label: `${months[mon - 1]} '${String(y).slice(-2)}`,
        x: getX(dateStr)
      });
    }
  } else {
    // Draw yearly ticks (every January) for longer timelines
    for (let y = startYear; y <= endYear; y++) {
      const dateStr = `${y}-01`;
      const x = getX(dateStr);
      if (x >= padding.left && x <= dimensions.width - padding.right) {
        gridLinesX.push({
          dateStr,
          label: `'${String(y).slice(-2)}`,
          x
        });
      }
    }
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '2rem 1.5rem 1rem 1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Compensation Progression Timeline</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Proportional financial event circles mapped on base salary line</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.75rem' }}>
          {/* Legends */}
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-base)' }}></span>
              <span style={{ color: 'var(--text-secondary)' }}>Base Salary</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-bonus)' }}></span>
              <span style={{ color: 'var(--text-secondary)' }}>Bonus</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-grant)' }}></span>
              <span style={{ color: 'var(--text-secondary)' }}>Grant</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-vest)' }}></span>
              <span style={{ color: 'var(--text-secondary)' }}>Vesting</span>
            </div>
          </div>
          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={downloadChartPNG}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Download chart as PNG image"
            >
              <Download size={13} /> Download Graph (PNG)
            </button>
            <button
              onClick={exportJSON}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Export data as JSON file"
            >
              <FileSpreadsheet size={13} /> Export JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Import data from JSON backup"
            >
              <Upload size={13} /> Import JSON
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Event type filters row */}
      <div className="chart-filters-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, marginRight: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Filter Timeline:
        </span>
        {[
          { key: 'salaryLine', label: 'Salary Line', color: 'var(--color-base)' },
          { key: 'hike', label: 'Salary Hikes', color: 'var(--color-hike)' },
          { key: 'promotion', label: 'Promotions', color: 'var(--color-promotion)' },
          { key: 'jobswitch', label: 'Job Switches', color: 'var(--color-switch)' },
          { key: 'bonus', label: 'Bonuses', color: 'var(--color-bonus)' },
          { key: 'grant', label: 'Grants', color: 'var(--color-grant)' },
          { key: 'vest', label: 'Vesting', color: 'var(--color-vest)' }
        ].map((filter) => {
          const isActive = filters[filter.key];
          const rgbString = filter.key === 'salaryLine' ? '56, 189, 248' : filter.key === 'hike' ? '20, 184, 166' : filter.key === 'promotion' ? '236, 72, 153' : filter.key === 'jobswitch' ? '59, 130, 246' : filter.key === 'bonus' ? '16, 185, 129' : filter.key === 'grant' ? '245, 158, 11' : '168, 85, 247';
          return (
            <button
              key={filter.key}
              type="button"
              className={`filter-pill ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.2rem 0.55rem',
                fontSize: '0.72rem',
                borderRadius: '20px',
                border: isActive ? `1px solid ${filter.color}` : '1px solid var(--border-color)',
                background: isActive ? `rgba(${rgbString}, 0.12)` : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontWeight: 600
              }}
              onClick={() => setFilters(prev => ({ ...prev, [filter.key]: !prev[filter.key] }))}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: filter.color, display: 'inline-block' }}></span>
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="chart-3d-perspective">
      <div
        ref={containerRef}
        className={`chart-container chart-container-3d-transform${is3D ? ' is-3d' : ''}`}
      >
        {salaryEvents.length === 0 ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <span className="empty-state-icon" style={{ fontSize: '3rem' }}>📈</span>
            <h3>No compensation details entered</h3>
            <p>Use the sidebar form to add your base salary and milestones, or import a JSON backup.</p>
          </div>
        ) : (
          <svg className="chart-svg" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
            <defs>
              {/* Drop Shadow Filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              {/* Area Shading Gradient */}
              <linearGradient id="salary-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-base)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-base)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Y Axis Grid Lines & Labels */}
            {gridLinesY.map((val, idx) => {
              const y = getY(val);
              return (
                <g key={`y-grid-${idx}`}>
                  <line 
                    className="chart-grid-line" 
                    x1={padding.left} 
                    y1={y} 
                    x2={dimensions.width - padding.right} 
                    y2={y} 
                  />
                  <text 
                    className="chart-axis-text" 
                    x={padding.left - 12} 
                    y={y + 4} 
                    textAnchor="end"
                  >
                    {formatShortCurrency(val)}
                  </text>
                </g>
              );
            })}

            {/* X Axis Year Markers */}
            {gridLinesX.map((line, idx) => (
              <g key={`x-grid-${idx}`}>
                <line 
                  className="chart-grid-line" 
                  x1={line.x} 
                  y1={padding.top} 
                  x2={line.x} 
                  y2={dimensions.height - padding.bottom} 
                />
                <text 
                  className="chart-axis-text" 
                  x={line.x} 
                  y={dimensions.height - padding.bottom + 20} 
                  textAnchor="middle"
                  style={{ fontWeight: 600 }}
                >
                  {line.label}
                </text>
              </g>
            ))}

            {/* ── 3D DEPTH LAYER ── rendered behind everything when is3D ── */}
            {is3D && filters.salaryLine && salaryPathD && (() => {
              // Build an offset ribbon wall: shift the salary path down+right by depthOffset px
              const depthOffset = 10;
              // Replace all coordinate pairs M x y, L x y with M x+d y+d
              const shiftPath = (d) => d.replace(/([ML])\s+([\d.]+)\s+([\d.]+)/g, (_, cmd, x, y) =>
                `${cmd} ${parseFloat(x) + depthOffset} ${parseFloat(y) + depthOffset}`
              );
              const bottomY = dimensions.height - padding.bottom;
              // Top face is original, bottom face is offset
              const shiftedPath = shiftPath(salaryPathD);


              return (
                <g key="3d-depth-layer" style={{ pointerEvents: 'none' }}>
                  {/* Ribbon wall face */}
                  <path
                    d={shiftedPath}
                    fill="none"
                    stroke="var(--color-base)"
                    strokeWidth="1.5"
                    strokeOpacity="0.18"
                  />
                  {/* Vertical depth edges at each salary step transition */}
                  {salarySegments.map((seg, idx) => (
                    <line
                      key={`3d-edge-${idx}`}
                      x1={idx === 0 ? seg.startX : seg.startX}
                      y1={seg.y}
                      x2={(idx === 0 ? seg.startX : seg.startX) + depthOffset}
                      y2={seg.y + depthOffset}
                      stroke="var(--color-base)"
                      strokeWidth="1"
                      strokeOpacity="0.25"
                    />
                  ))}
                  {/* Floor glow bar at x-axis baseline */}
                  <rect
                    x={padding.left + depthOffset}
                    y={bottomY + depthOffset - 4}
                    width={dimensions.width - padding.left - padding.right}
                    height={5}
                    rx="2"
                    fill="var(--color-primary)"
                    opacity="0.12"
                  />
                </g>
              );
            })()}

            {/* 3D Mode Badge */}
            {is3D && (
              <text
                x={dimensions.width - padding.right - 4}
                y={padding.top - 10}
                className="chart-axis-text"
                textAnchor="end"
                fontSize="9.5"
                fontWeight="800"
                fill="var(--color-primary)"
                opacity="0.75"
                fontFamily="var(--font-mono)"
                style={{ letterSpacing: '0.08em' }}
              >
                ◈ 3D MODE
              </text>
            )}

            {/* Salary Area Shadow */}
            {filters.salaryLine && salaryAreaD && <path className="chart-line-shadow" d={salaryAreaD} />}

            {/* Salary Step Line */}
            {filters.salaryLine && salaryPathD && <path className="chart-line-salary" d={salaryPathD} />}

            {/* Salary Step Line Labels */}
            {filters.salaryLine && salarySegments.map((seg, idx) => {
              const width = seg.endX - seg.startX;
              if (width < 45) return null; // Skip if too narrow to prevent cluttering
              const startOffset = idx === 0 ? 8 : 14;
              const x = seg.startX + startOffset;
              const y = seg.y - 6;
              return (
                <text
                  key={`salary-lbl-${seg.id || idx}`}
                  className="chart-salary-label"
                  x={x}
                  y={y}
                  textAnchor="start"
                  fill="var(--color-base)"
                  stroke="var(--bg-primary)"
                  strokeWidth="3px"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  fontSize="9.5px"
                  fontWeight="800"
                  fontFamily="var(--font-mono)"
                  pointerEvents="none"
                >
                  {formatShortCurrency(seg.salary)}
                </text>
              );
            })}

            {/* Y Axis Line */}
            <line 
              className="chart-axis-line" 
              x1={padding.left} 
              y1={padding.top} 
              x2={padding.left} 
              y2={dimensions.height - padding.bottom} 
            />

            {/* X Axis Line */}
            <line 
              className="chart-axis-line" 
              x1={padding.left} 
              y1={dimensions.height - padding.bottom} 
              x2={dimensions.width - padding.right} 
              y2={dimensions.height - padding.bottom} 
            />

            {/* Salary Change Event Nodes (Diamond/Square Indicators) */}
            {sortedSalaryEvents.map((evt, idx) => {
              // Starting base doesn't need a hike icon unless user wants it.
              if (idx === 0) return null;
              if (!filters[evt.type]) return null;
              
              const x = getX(evt.date);
              const y = getY(convertCurrency(evt.salary, evt.currency, currency));
              
              let color = 'var(--color-hike)';
              if (evt.type === 'promotion') color = 'var(--color-promotion)';
              if (evt.type === 'jobswitch') color = 'var(--color-switch)';
 
              return (
                <g 
                   key={`salary-evt-${evt.id}`}
                   className="chart-event-node"
                   style={{ '--node-color': color }}
                   transform={`translate(${x}, ${y})`}
                   onMouseEnter={() => {
                     // Percentage change calculation
                     const prevSalary = convertCurrency(sortedSalaryEvents[idx - 1].salary, sortedSalaryEvents[idx - 1].currency, currency);
                     const currSalary = convertCurrency(evt.salary, evt.currency, currency);
                     const pctDiff = prevSalary !== 0 ? ((currSalary - prevSalary) / prevSalary) * 100 : 0;
                     
                     setHoveredItem({
                       x: x,
                       y: y - 10,
                       title: evt.title,
                       value: `${formatFullCurrency(currSalary)}/yr`,
                       subValue: pctDiff > 0 ? `+${pctDiff.toFixed(0)}% change` : `${pctDiff.toFixed(0)}% change`,
                       date: formatDateLabel(evt.date),
                       type: evt.type,
                       company: evt.company || 'Self-Employed',
                       category: 'salary'
                     });
                   }}
                   onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Glowing background */}
                  <rect 
                    x="-7" 
                    y="-7" 
                    width="14" 
                    height="14" 
                    rx="2"
                    transform="rotate(45)"
                    fill={color} 
                    opacity="0.3"
                    stroke={color}
                    strokeWidth="4"
                  />
                  {/* Central Node */}
                  <rect 
                    x="-5" 
                    y="-5" 
                    width="10" 
                    height="10" 
                    rx="1"
                    transform="rotate(45)"
                    fill={color} 
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}

            {/* 3D Comp Event Pillar Lines (depth drops to floor) */}
            {is3D && (() => {
              const filteredCompEvents = compEvents.filter(evt => filters[evt.type]);
              const datesSeen = new Set();
              return filteredCompEvents
                .filter(evt => {
                  const nd = (evt.date && evt.date.length === 7) ? `${evt.date}-01` : evt.date;
                  if (datesSeen.has(nd)) return false;
                  datesSeen.add(nd);
                  return true;
                })
                .map(evt => {
                  const nd = (evt.date && evt.date.length === 7) ? `${evt.date}-01` : evt.date;
                  const x = getX(nd);
                  const activeSalary = getSalaryAtDate(nd);
                  const y = getY(activeSalary);
                  const bottomY = dimensions.height - padding.bottom;
                  let strokeColor = 'var(--color-bonus)';
                  if (evt.type === 'grant') strokeColor = 'var(--color-grant)';
                  if (evt.type === 'vest') strokeColor = 'var(--color-vest)';
                  return (
                    <g key={`3d-pillar-${nd}`} style={{ pointerEvents: 'none' }}>
                      <line
                        x1={x} y1={y}
                        x2={x} y2={bottomY}
                        stroke={strokeColor}
                        strokeWidth="1.5"
                        strokeOpacity="0.25"
                        strokeDasharray="4,3"
                      />
                      {/* Small ellipse shadow on floor */}
                      <ellipse
                        cx={x} cy={bottomY}
                        rx="6" ry="2"
                        fill={strokeColor}
                        opacity="0.2"
                      />
                    </g>
                  );
                });
            })()}

            {/* Financial Overlay Circles (Bonus, Grant, Vest) */}
            {(() => {
              // Group financial events by date to draw overlapping ones as concentric doughnuts
              const filteredCompEvents = compEvents.filter(evt => filters[evt.type]);
              const compGroupsByDate = {};
              filteredCompEvents.forEach((evt) => {
                const normalizedDate = normalizeDate(evt.date);
                if (!compGroupsByDate[normalizedDate]) {
                  compGroupsByDate[normalizedDate] = [];
                }
                compGroupsByDate[normalizedDate].push(evt);
              });
 
              return Object.entries(compGroupsByDate).map(([date, group]) => {
                const x = getX(date);
                const activeSalary = getSalaryAtDate(date);
                const y = getY(activeSalary);
 
                // Sort events in this group by active display currency amount descending (largest first)
                const sortedGroup = [...group].sort((a, b) => {
                  const valA = convertCurrency(a.amount, a.currency, currency);
                  const valB = convertCurrency(b.amount, b.currency, currency);
                  return valB - valA;
                });
 
                // Calculate radii:
                // Smallest event (innermost) has Area proportional to its amount.
                // Each larger event (outer rings) has its Ring Area equal to its amount.
                // Ring Area = PI * R_outer^2 - PI * R_inner^2 = TargetArea
                // => R_outer = sqrt(R_inner^2 + R_base^2)
                const groupWithRadii = [];
                let prevRadius = 0;
                for (let i = sortedGroup.length - 1; i >= 0; i--) {
                  const evt = sortedGroup[i];
                  const convertedAmt = convertCurrency(evt.amount, evt.currency, currency);
                  const baseRadius = getCircleRadius(convertedAmt);
                  
                  let radius;
                  if (i === sortedGroup.length - 1) {
                    // Innermost circle
                    radius = baseRadius;
                  } else {
                    // Outer doughnut ring
                    const areaSumRadius = Math.sqrt(prevRadius * prevRadius + baseRadius * baseRadius);
                    // Enforce at least 6px ring thickness for hover ease
                    radius = Math.max(areaSumRadius, prevRadius + 6);
                  }
                  
                  groupWithRadii.unshift({ evt, radius });
                  prevRadius = radius;
                }
 
                return (
                  <g key={`comp-group-${date}`}>
                    {groupWithRadii.map(({ evt, radius }, idx) => {
                      // Color definitions
                      let fillColor = 'rgba(16, 185, 129, 0.22)';
                      let strokeColor = 'var(--color-bonus)';
                      if (evt.type === 'grant') {
                        fillColor = 'rgba(245, 158, 11, 0.22)';
                        strokeColor = 'var(--color-grant)';
                      } else if (evt.type === 'vest') {
                        fillColor = 'rgba(168, 85, 247, 0.22)';
                        strokeColor = 'var(--color-vest)';
                      }
 
                      const isInnermost = idx === groupWithRadii.length - 1;
 
                      if (isInnermost) {
                        // Innermost circle (standard filled circle)
                        return (
                          <g
                            key={`comp-evt-${evt.id}`}
                            className="chart-comp-node"
                            style={{ '--node-color': strokeColor }}
                            transform={`translate(${x}, ${y})`}
                            onMouseEnter={() => {
                              setHoveredItem({
                                x: x,
                                y: y - radius - 10,
                                title: evt.title,
                                value: formatFullCurrency(evt.amount, evt.currency),
                                date: formatDateLabel(evt.date),
                                type: evt.type,
                                company: evt.company || 'Self-Employed',
                                category: 'comp'
                              });
                            }}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {/* Outer border & body fill */}
                            <circle
                              r={radius}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth="2"
                              style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}
                            />
                            {/* Interactive inner core */}
                            <circle
                              r={Math.max(radius - 4, 3)}
                              fill="transparent"
                              stroke="rgba(255,255,255,0.15)"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                            {/* Text value outline & overlay at the top of the circle */}
                            <text
                              className="chart-comp-label"
                              textAnchor="middle"
                              y={-radius - 5}
                              fill="var(--text-primary)"
                              stroke="var(--bg-primary)"
                              strokeWidth="2.5px"
                              paintOrder="stroke"
                              strokeLinejoin="round"
                              fontSize="9px"
                              fontWeight="700"
                              fontFamily="var(--font-mono)"
                              pointerEvents="none"
                            >
                              {formatShortCurrency(evt.amount, evt.currency)}
                            </text>
                          </g>
                        );
                      } else {
                        // Outer doughnut ring representing the larger payout
                        const nextRadius = groupWithRadii[idx + 1].radius;
                        const strokeWidth = radius - nextRadius;
                        const ringRadius = (radius + nextRadius) / 2;
 
                        return (
                          <g
                            key={`comp-evt-${evt.id}`}
                            className="chart-comp-node"
                            style={{ '--node-color': strokeColor }}
                            transform={`translate(${x}, ${y})`}
                            onMouseEnter={() => {
                              setHoveredItem({
                                x: x,
                                y: y - radius - 10,
                                title: evt.title,
                                value: formatFullCurrency(evt.amount, evt.currency),
                                date: formatDateLabel(evt.date),
                                type: evt.type,
                                company: evt.company || 'Self-Employed',
                                category: 'comp'
                              });
                            }}
                            onMouseLeave={() => setHoveredItem(null)}
                          >
                            {/* Doughnut ring path using thick transparent stroke */}
                            <circle
                              r={ringRadius}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              strokeOpacity="0.22"
                            />
                            {/* Clean outer border of the doughnut */}
                            <circle
                              r={radius}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="1.5"
                            />
                            {/* Text value outline & overlay at the top of the ring */}
                            <text
                              className="chart-comp-label"
                              textAnchor="middle"
                              y={-radius - 5}
                              fill="var(--text-primary)"
                              stroke="var(--bg-primary)"
                              strokeWidth="2.5px"
                              paintOrder="stroke"
                              strokeLinejoin="round"
                              fontSize="9px"
                              fontWeight="700"
                              fontFamily="var(--font-mono)"
                              pointerEvents="none"
                            >
                              {formatShortCurrency(evt.amount, evt.currency)}
                            </text>
                          </g>
                        );
                      }
                    })}
                  </g>
                );
              });
            })()}
          </svg>
        )}

        {/* Hover Tooltip Render */}
        {hoveredItem && (
          <div 
            className="chart-tooltip"
            style={{ 
              left: `${hoveredItem.x}px`, 
              top: `${hoveredItem.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="tooltip-title">
              <span className={`tooltip-badge ${hoveredItem.type}`}>
                {hoveredItem.type}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-word', display: 'inline-block', maxWidth: '220px' }}>
                {hoveredItem.title}
              </span>
            </div>
            <div className="tooltip-value">{hoveredItem.value}</div>
            {hoveredItem.company && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.1rem' }}>
                Employer: <strong style={{ color: 'var(--color-primary)' }}>{hoveredItem.company}</strong>
              </div>
            )}
            {hoveredItem.subValue && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-hike)', fontWeight: 600 }}>
                {hoveredItem.subValue}
              </div>
            )}
            <div className="tooltip-date">{hoveredItem.date}</div>
          </div>
        )}
      </div>
      </div> {/* end .chart-3d-perspective */}

      {/* Company Contribution Amount List Section */}
      {salaryEvents.length > 0 && (
        <CompanyEarningsList 
          salaryEvents={salaryEvents}
          compEvents={compEvents}
          startDate={startDate}
          currency={currency}
          formatFullCurrency={formatFullCurrency}
        />
      )}

      {/* Periodic Earnings Summary Section */}
      {salaryEvents.length > 0 && (
        <PeriodicEarningsList
          salaryEvents={salaryEvents}
          compEvents={compEvents}
          startDate={startDate}
          currency={currency}
          formatFullCurrency={formatFullCurrency}
          formatShortCurrency={formatShortCurrency}
        />
      )}
    </div>
  );
}

// Company Earnings List helper component
function CompanyEarningsList({ salaryEvents, compEvents, startDate, currency, formatFullCurrency }) {
  const [sortBy, setSortBy] = useState('amount'); // 'amount' or 'time'
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' or 'asc'

  const normalizeDate = (d) => (d && d.length === 7) ? `${d}-01` : d;

  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => {
    const normA = normalizeDate(a.date);
    const normB = normalizeDate(b.date);
    return normA.localeCompare(normB);
  });
  const baselineDate = startDate || "2024-01";
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const cutoffDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

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
    const totalMonths = monthDiff + dayDiff / 30.4368;
    return totalMonths / 12;
  };

  const getCompanyData = () => {
    const data = {};

    // 1. Calculate Base salary contribution
    const normBaseline = normalizeDate(baselineDate);
    const normCutoff = normalizeDate(cutoffDate);
    if (sortedSalaryEvents.length > 0 && normBaseline < normCutoff) {
      for (let i = 0; i < sortedSalaryEvents.length; i++) {
        const currentEvent = sortedSalaryEvents[i];
        const nextEvent = sortedSalaryEvents[i + 1];
        
        let segmentStart = normalizeDate(currentEvent.date);
        if (segmentStart < normBaseline) segmentStart = normBaseline;
        if (segmentStart > normCutoff) segmentStart = normCutoff;
        
        let segmentEnd = nextEvent ? normalizeDate(nextEvent.date) : normCutoff;
        if (segmentEnd < normBaseline) segmentEnd = normBaseline;
        if (segmentEnd > normCutoff) segmentEnd = normCutoff;
        
        const durationYears = getYearDiff(segmentStart, segmentEnd);
        if (durationYears > 0) {
          const earned = convertCurrency(currentEvent.salary, currentEvent.currency, currency) * durationYears;
          const companyName = currentEvent.company || 'Self-Employed';
          
          if (!data[companyName]) {
            data[companyName] = { name: companyName, base: 0, bonus: 0, vest: 0, total: 0, earliestDate: currentEvent.date, latestDate: currentEvent.date };
          }
          data[companyName].base += earned;
          data[companyName].total += earned;
          
          const normEvtDate = normalizeDate(currentEvent.date);
          if (normEvtDate < normalizeDate(data[companyName].earliestDate)) data[companyName].earliestDate = currentEvent.date;
          if (normEvtDate > normalizeDate(data[companyName].latestDate)) data[companyName].latestDate = currentEvent.date;
        }
      }
    }

    // 2. Add comp events
    compEvents.forEach(evt => {
      if (normalizeDate(evt.date) >= normCutoff) return;

      const companyName = evt.company || 'Self-Employed';
      if (!data[companyName]) {
        data[companyName] = { name: companyName, base: 0, bonus: 0, vest: 0, total: 0, earliestDate: evt.date, latestDate: evt.date };
      }

      const val = convertCurrency(Number(evt.amount), evt.currency, currency);
      if (evt.type === 'bonus') {
        data[companyName].bonus += val;
        data[companyName].total += val;
      } else if (evt.type === 'vest') {
        data[companyName].vest += val;
        data[companyName].total += val;
      }
      
      const normEvtDate = normalizeDate(evt.date);
      if (normEvtDate < normalizeDate(data[companyName].earliestDate)) data[companyName].earliestDate = evt.date;
      if (normEvtDate > normalizeDate(data[companyName].latestDate)) data[companyName].latestDate = evt.date;
    });

    return Object.values(data);
  };

  const companies = getCompanyData();

  // Sort companies
  const sortedCompanies = [...companies].sort((a, b) => {
    if (sortBy === 'amount') {
      return sortOrder === 'desc' ? b.total - a.total : a.total - b.total;
    } else {
      // Sort by time (latest active date)
      const normA = normalizeDate(a.latestDate);
      const normB = normalizeDate(b.latestDate);
      return sortOrder === 'desc' 
        ? normB.localeCompare(normA) 
        : normA.localeCompare(normB);
    }
  });

  const totalRealizedCareer = companies.reduce((sum, c) => sum + c.total, 0);

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(month) - 1]} ${year}`;
  };

  return (
    <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>💼</span> Realized Earnings Contribution by Organization
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
            Attributed base salary, bonuses, and vests accumulated up to the end of last completed month
          </p>
        </div>

        {/* Sorting controls */}
        {companies.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort by:</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                height: '28px',
                cursor: 'pointer'
              }}
            >
              <option value="amount">Total Amount</option>
              <option value="time">Latest Activity</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="btn btn-secondary"
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                minWidth: 'auto',
                gap: '0.2rem'
              }}
              title={sortOrder === 'desc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {sortOrder === 'desc' ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>
        )}
      </div>

      {sortedCompanies.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px dashed var(--border-color)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No completed earnings recorded yet. Add your compensation events to see the contributions.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedCompanies.map((company) => {
            const percentage = totalRealizedCareer > 0 ? (company.total / totalRealizedCareer) * 100 : 0;
            
            // Stack calculations
            const basePct = company.total > 0 ? (company.base / company.total) * 100 : 0;
            const bonusPct = company.total > 0 ? (company.bonus / company.total) * 100 : 0;
            const vestPct = company.total > 0 ? (company.vest / company.total) * 100 : 0;

            return (
              <div 
                key={company.name} 
                className="company-earnings-row"
                style={{
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Info Header */}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', display: 'inline-block' }} title={company.name}>{company.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      ({formatDateLabel(company.earliestDate)} - {formatDateLabel(company.latestDate)})
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatFullCurrency(company.total)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, background: 'rgba(99,102,241,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Stacked Progress Bar */}
                <div 
                  className="stacked-bar-container"
                  style={{
                    height: '10px',
                    borderRadius: '5px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    display: 'flex',
                    width: '100%',
                    position: 'relative'
                  }}
                >
                  <div 
                    className="stacked-bar-fill"
                    style={{
                      display: 'flex',
                      height: '100%',
                      width: `${percentage}%`,
                      borderRadius: '5px',
                      overflow: 'hidden',
                      transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  >
                    {company.base > 0 && (
                      <div 
                        className="stacked-bar-segment"
                        style={{ 
                          width: `${basePct}%`, 
                          background: 'var(--color-base)',
                          height: '100%',
                          transition: 'width 0.3s ease'
                        }}
                        title={`Base Salary: ${formatFullCurrency(company.base)} (${basePct.toFixed(0)}%)`}
                      />
                    )}
                    {company.bonus > 0 && (
                      <div 
                        className="stacked-bar-segment"
                        style={{ 
                          width: `${bonusPct}%`, 
                          background: 'var(--color-bonus)',
                          height: '100%',
                          transition: 'width 0.3s ease'
                        }}
                        title={`Bonus: ${formatFullCurrency(company.bonus)} (${bonusPct.toFixed(0)}%)`}
                      />
                    )}
                    {company.vest > 0 && (
                      <div 
                        className="stacked-bar-segment"
                        style={{ 
                          width: `${vestPct}%`, 
                          background: 'var(--color-vest)',
                          height: '100%',
                          transition: 'width 0.3s ease'
                        }}
                        title={`Stock Vested: ${formatFullCurrency(company.vest)} (${vestPct.toFixed(0)}%)`}
                      />
                    )}
                  </div>
                </div>

                {/* Micro breakdowns detail text shown below bar */}
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem', flexWrap: 'wrap' }}>
                  {company.base > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-base)' }}></span>
                      <span>Base: <strong>{formatFullCurrency(company.base)}</strong> ({basePct.toFixed(0)}%)</span>
                    </div>
                  )}
                  {company.bonus > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-bonus)' }}></span>
                      <span>Bonus: <strong>{formatFullCurrency(company.bonus)}</strong> ({bonusPct.toFixed(0)}%)</span>
                    </div>
                  )}
                  {company.vest > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-vest)' }}></span>
                      <span>Vested: <strong>{formatFullCurrency(company.vest)}</strong> ({vestPct.toFixed(0)}%)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Periodic Earnings List helper component
function PeriodicEarningsList({ salaryEvents, compEvents, startDate, currency, formatFullCurrency, formatShortCurrency }) {
  const [periodType, setPeriodType] = useState('year'); // 'year', 'half', 'quarter'
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'list'
  const [showTotalComp, setShowTotalComp] = useState(true);
  const [showGrowth, setShowGrowth] = useState(true);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const baselineDate = startDate || "2024-01";
  const startYearNum = Number(baselineDate.split('-')[0]);

  const today = new Date();
  const currentYear = today.getFullYear();

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
    const totalMonths = monthDiff + dayDiff / 30.4368;
    return totalMonths / 12;
  };

  const getOverlapYears = (startA, endA, startB, endB) => {
    const s = startA > startB ? startA : startB;
    const e = endA < endB ? endA : endB;
    if (s >= e) return 0;
    return getYearDiff(s, e);
  };

  const normalizeDate = (d) => (d && d.length === 7) ? `${d}-01` : d;

  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => {
    const normA = normalizeDate(a.date);
    const normB = normalizeDate(b.date);
    return normA.localeCompare(normB);
  });

  const maxYear = currentYear;

  const years = [];
  for (let y = startYearNum; y <= maxYear; y++) {
    years.push(y);
  }

  const periods = [];
  years.forEach(y => {
    if (periodType === 'year') {
      periods.push({
        id: `${y}`,
        label: `${y}`,
        start: `${y}-01-01`,
        end: `${y + 1}-01-01`
      });
    } else if (periodType === 'half') {
      periods.push({
        id: `${y}-H1`,
        label: `H1 ${y}`,
        start: `${y}-01-01`,
        end: `${y}-07-01`
      });
      periods.push({
        id: `${y}-H2`,
        label: `H2 ${y}`,
        start: `${y}-07-01`,
        end: `${y + 1}-01-01`
      });
    } else if (periodType === 'quarter') {
      periods.push({
        id: `${y}-Q1`,
        label: `Q1 ${y}`,
        start: `${y}-01-01`,
        end: `${y}-04-01`
      });
      periods.push({
        id: `${y}-Q2`,
        label: `Q2 ${y}`,
        start: `${y}-04-01`,
        end: `${y}-07-01`
      });
      periods.push({
        id: `${y}-Q3`,
        label: `Q3 ${y}`,
        start: `${y}-07-01`,
        end: `${y}-10-01`
      });
      periods.push({
        id: `${y}-Q4`,
        label: `Q4 ${y}`,
        start: `${y}-10-01`,
        end: `${y + 1}-01-01`
      });
    }
  });

  const periodsData = periods.map(p => {
    let baseEarned = 0;
    if (sortedSalaryEvents.length > 0) {
      for (let i = 0; i < sortedSalaryEvents.length; i++) {
        const currentEvent = sortedSalaryEvents[i];
        const nextEvent = sortedSalaryEvents[i + 1];

        const normStart = normalizeDate(currentEvent.date);
        const normNext = nextEvent ? normalizeDate(nextEvent.date) : null;
        const normBaseline = normalizeDate(baselineDate);

        let segmentStart = normStart;
        if (segmentStart < normBaseline) segmentStart = normBaseline;
        
        let segmentEnd = normNext ? normNext : p.end;
        if (segmentEnd < normBaseline) segmentEnd = normBaseline;

        const overlap = getOverlapYears(segmentStart, segmentEnd, p.start, p.end);
        if (overlap > 0) {
          baseEarned += convertCurrency(currentEvent.salary, currentEvent.currency, currency) * overlap;
        }
      }
    }

    const bonusEarned = compEvents
      .filter(e => {
        const normDate = normalizeDate(e.date);
        return e.type === 'bonus' && normDate >= p.start && normDate < p.end;
      })
      .reduce((sum, e) => sum + convertCurrency(Number(e.amount), e.currency, currency), 0);

    const vestEarned = compEvents
      .filter(e => {
        const normDate = normalizeDate(e.date);
        return e.type === 'vest' && normDate >= p.start && normDate < p.end;
      })
      .reduce((sum, e) => sum + convertCurrency(Number(e.amount), e.currency, currency), 0);

    const totalEarned = baseEarned + bonusEarned + vestEarned;

    return {
      id: p.id,
      label: p.label,
      start: p.start,
      end: p.end,
      base: baseEarned,
      bonus: bonusEarned,
      vest: vestEarned,
      total: totalEarned
    };
  });

  for (let i = 0; i < periodsData.length; i++) {
    const current = periodsData[i];
    if (i > 0) {
      const prev = periodsData[i - 1];
      if (prev.total > 0) {
        current.growth = ((current.total - prev.total) / prev.total) * 100;
      } else {
        current.growth = null;
      }
    } else {
      current.growth = null;
    }
  }

  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  const activePeriods = periodsData.filter(p => {
    return p.start <= todayStr;
  });

  const maxPeriodTotal = Math.max(...activePeriods.map(p => p.total), 1);

  // Left Y axis (Total Comp) scale logic
  const rawMaxTotal = Math.max(...activePeriods.map(p => p.total), 1000);
  const stepRaw = rawMaxTotal / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(stepRaw)));
  const normalizedStep = stepRaw / (magnitude || 1);
  let cleanStep;
  if (normalizedStep <= 1) cleanStep = 1;
  else if (normalizedStep <= 2) cleanStep = 2;
  else if (normalizedStep <= 5) cleanStep = 5;
  else cleanStep = 10;
  cleanStep = cleanStep * (magnitude || 1);
  const maxYComp = cleanStep * 4;

  // Right Y axis (Growth %) scale logic
  const growthValues = activePeriods
    .map(p => p.growth)
    .filter(g => g !== null && g !== undefined);
  const maxAbsGrowth = growthValues.length > 0 ? Math.max(...growthValues.map(Math.abs), 20) : 20;
  const stepGrowthRaw = maxAbsGrowth / 2;
  const magnitudeGrowth = Math.pow(10, Math.floor(Math.log10(stepGrowthRaw)));
  const normalizedStepGrowth = stepGrowthRaw / (magnitudeGrowth || 1);
  let cleanStepGrowth;
  if (normalizedStepGrowth <= 1) cleanStepGrowth = 1;
  else if (normalizedStepGrowth <= 2) cleanStepGrowth = 2;
  else if (normalizedStepGrowth <= 2.5) cleanStepGrowth = 2.5;
  else if (normalizedStepGrowth <= 5) cleanStepGrowth = 5;
  else cleanStepGrowth = 10;
  cleanStepGrowth = cleanStepGrowth * (magnitudeGrowth || 1);

  const minGrowthScale = -2 * cleanStepGrowth;
  const maxGrowthScale = 2 * cleanStepGrowth;

  const chartPadding = { top: 25, right: 60, bottom: 35, left: 60 };
  const chartHeight = 240 - chartPadding.top - chartPadding.bottom;
  const chartWidth = 680 - chartPadding.left - chartPadding.right;

  const getYComp = (val) => {
    const ratio = val / maxYComp;
    return chartPadding.top + chartHeight - ratio * chartHeight;
  };

  const getGrowthY = (val) => {
    if (val === null || val === undefined) return chartPadding.top + chartHeight;
    const ratio = (val - minGrowthScale) / (maxGrowthScale - minGrowthScale);
    return chartPadding.top + chartHeight - ratio * chartHeight;
  };

  const zeroY = getGrowthY(0);

  const numPeriods = activePeriods.length;
  const barGroupWidth = numPeriods > 0 ? chartWidth / numPeriods : chartWidth;
  const bothActive = showTotalComp && showGrowth;
  const baseBarWidth = Math.min(28, barGroupWidth * 0.4);

  let compBarWidth = baseBarWidth;
  let growthBarWidth = baseBarWidth;
  let compBarXOffset = 0;
  let growthBarXOffset = 0;

  if (bothActive) {
    compBarWidth = Math.min(20, barGroupWidth * 0.3);
    growthBarWidth = Math.min(20, barGroupWidth * 0.3);
    const gap = Math.min(8, barGroupWidth * 0.1);
    compBarXOffset = -(compBarWidth / 2 + gap / 2);
    growthBarXOffset = growthBarWidth / 2 + gap / 2;
  } else {
    compBarWidth = baseBarWidth * 1.5;
    growthBarWidth = baseBarWidth * 1.5;
    compBarXOffset = 0;
    growthBarXOffset = 0;
  }

  const getTooltipY = (p) => {
    const compY = showTotalComp ? getYComp(p.total) : zeroY;
    const growthY = showGrowth ? getGrowthY(p.growth || 0) : zeroY;
    return Math.min(compY, growthY, zeroY);
  };

  return (
    <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Periodic Earnings Analysis</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Realized earnings breakdown and growth performance (current period shows projected earnings)</p>
        </div>
        
        {/* Toggle selectors (View Mode & Period Type) */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: '6px' }}>
            {[
              { value: 'chart', label: '📊 Growth Chart' },
              { value: 'list', label: '📋 Detailed List' }
            ].map(opt => (
              <button
                key={opt.value}
                className="btn"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.6rem',
                  background: viewMode === opt.value ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  borderColor: viewMode === opt.value ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === opt.value ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
                onClick={() => setViewMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Period Selector Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: '6px' }}>
            {[
              { value: 'year', label: 'Yearly' },
              { value: 'half', label: 'Half-Yearly' },
              { value: 'quarter', label: 'Quarterly' }
            ].map(opt => (
              <button
                key={opt.value}
                className="btn"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.6rem',
                  background: periodType === opt.value ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  borderColor: periodType === opt.value ? 'var(--color-primary)' : 'transparent',
                  color: periodType === opt.value ? 'var(--text-primary)' : 'var(--text-muted)'
                }}
                onClick={() => setPeriodType(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics filter pills */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, marginRight: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Show Metrics:
        </span>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.55rem',
            fontSize: '0.72rem',
            borderRadius: '20px',
            border: showTotalComp ? `1px solid var(--color-primary)` : '1px solid var(--border-color)',
            background: showTotalComp ? `rgba(99, 102, 241, 0.12)` : 'transparent',
            color: showTotalComp ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontWeight: 600
          }}
          onClick={() => {
            if (showTotalComp && !showGrowth) return;
            setShowTotalComp(!showTotalComp);
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }}></span>
          Total Comp
        </button>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.55rem',
            fontSize: '0.72rem',
            borderRadius: '20px',
            border: showGrowth ? `1px solid var(--color-bonus)` : '1px solid var(--border-color)',
            background: showGrowth ? `rgba(16, 185, 129, 0.12)` : 'transparent',
            color: showGrowth ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontWeight: 600
          }}
          onClick={() => {
            if (showGrowth && !showTotalComp) return;
            setShowGrowth(!showGrowth);
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-bonus)', display: 'inline-block' }}></span>
          Growth %
        </button>
      </div>

      {viewMode === 'chart' ? (
        (!showTotalComp && !showGrowth) ? (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Please select at least one metric to display.
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', marginTop: '0.5rem' }}>
            <svg viewBox="0 0 680 240" width="100%" style={{ overflow: 'visible', display: 'block' }}>
              {/* Axis labels at the top */}
              {showTotalComp && (
                <text
                  x={chartPadding.left}
                  y={chartPadding.top - 10}
                  textAnchor="start"
                  fill="var(--color-primary)"
                  fontSize="8px"
                  fontWeight="800"
                  style={{ letterSpacing: '0.05em' }}
                >
                  TOTAL COMP
                </text>
              )}
              {showGrowth && (
                <text
                  x={680 - chartPadding.right}
                  y={chartPadding.top - 10}
                  textAnchor="end"
                  fill="var(--color-bonus)"
                  fontSize="8px"
                  fontWeight="800"
                  style={{ letterSpacing: '0.05em' }}
                >
                  GROWTH %
                </text>
              )}

              {/* Shared Horizontal grid lines (5 lines) */}
              {Array.from({ length: 5 }).map((_, idx) => {
                const y = chartPadding.top + chartHeight - (idx * chartHeight) / 4;
                const compVal = (idx * maxYComp) / 4;
                const growthVal = minGrowthScale + idx * cleanStepGrowth;
                
                return (
                  <g key={idx}>
                    <line
                      x1={chartPadding.left}
                      y1={y}
                      x2={680 - chartPadding.right}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="4 4"
                    />
                    
                    {/* Left Axis ticks (Total Comp) */}
                    {showTotalComp && (
                      <text
                        x={chartPadding.left - 10}
                        y={y + 4}
                        textAnchor="end"
                        fill="rgba(99, 102, 241, 0.85)"
                        fontSize="10px"
                        fontFamily="var(--font-mono)"
                        fontWeight="600"
                      >
                        {formatShortCurrency ? formatShortCurrency(compVal) : `${compVal}`}
                      </text>
                    )}

                    {/* Right Axis ticks (Growth %) */}
                    {showGrowth && (
                      <text
                        x={680 - chartPadding.right + 10}
                        y={y + 4}
                        textAnchor="start"
                        fill="rgba(16, 185, 129, 0.85)"
                        fontSize="10px"
                        fontFamily="var(--font-mono)"
                        fontWeight="600"
                      >
                        {growthVal === 0 ? '0%' : `${growthVal > 0 ? '+' : ''}${growthVal.toFixed(0)}%`}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Zero line for growth chart */}
              {showGrowth && (
                <line
                  x1={chartPadding.left}
                  y1={zeroY}
                  x2={680 - chartPadding.right}
                  y2={zeroY}
                  stroke="rgba(16, 185, 129, 0.2)"
                  strokeWidth="1.5"
                />
              )}

              {/* Left Y-axis vertical line */}
              {showTotalComp && (
                <line
                  x1={chartPadding.left}
                  y1={chartPadding.top}
                  x2={chartPadding.left}
                  y2={chartPadding.top + chartHeight}
                  stroke="rgba(99, 102, 241, 0.25)"
                  strokeWidth="1.2"
                />
              )}

              {/* Right Y-axis vertical line */}
              {showGrowth && (
                <line
                  x1={680 - chartPadding.right}
                  y1={chartPadding.top}
                  x2={680 - chartPadding.right}
                  y2={chartPadding.top + chartHeight}
                  stroke="rgba(16, 185, 129, 0.25)"
                  strokeWidth="1.2"
                />
              )}

              {/* Render Bars and Labels */}
              {activePeriods.map((p, i) => {
                const colCenterX = chartPadding.left + barGroupWidth * i + barGroupWidth / 2;
                const compBarX = colCenterX + compBarXOffset - compBarWidth / 2;
                const growthBarX = colCenterX + growthBarXOffset - growthBarWidth / 2;

                // Stack Y positions for Total Comp
                const yBase = getYComp(p.base);
                const yBonus = getYComp(p.base + p.bonus);
                const yTotal = getYComp(p.total);
                const yZero = getYComp(0);

                return (
                  <g key={p.id}>
                    {/* 1. Total Comp Stacked Bar */}
                    {showTotalComp && p.total > 0 && (
                      <g className="total-comp-bar-group">
                        {/* Base salary segment */}
                        {p.base > 0 && (
                          <rect
                            x={compBarX}
                            y={yBase}
                            width={compBarWidth}
                            height={yZero - yBase}
                            fill="rgba(56, 189, 248, 0.25)"
                            stroke="var(--color-base)"
                            strokeWidth="1.5"
                            rx={2}
                          />
                        )}
                        {/* Bonus segment */}
                        {p.bonus > 0 && (
                          <rect
                            x={compBarX}
                            y={yBonus}
                            width={compBarWidth}
                            height={yBase - yBonus}
                            fill="rgba(16, 185, 129, 0.25)"
                            stroke="var(--color-bonus)"
                            strokeWidth="1.5"
                            rx={2}
                          />
                        )}
                        {/* Vested Stock segment */}
                        {p.vest > 0 && (
                          <rect
                            x={compBarX}
                            y={yTotal}
                            width={compBarWidth}
                            height={yBonus - yTotal}
                            fill="rgba(168, 85, 247, 0.25)"
                            stroke="var(--color-vest)"
                            strokeWidth="1.5"
                            rx={2}
                          />
                        )}
                      </g>
                    )}

                    {/* 2. Growth Solid Bar */}
                    {showGrowth && (
                      p.growth === null ? (
                        // Baseline START representation
                        <g>
                          <rect
                            x={growthBarX}
                            y={zeroY - 12}
                            width={growthBarWidth}
                            height={24}
                            fill="rgba(99, 102, 241, 0.05)"
                            stroke="rgba(99, 102, 241, 0.25)"
                            strokeDasharray="2 2"
                            rx={3}
                          />
                          <text
                            x={colCenterX + growthBarXOffset}
                            y={zeroY + 3}
                            textAnchor="middle"
                            fill="var(--text-muted)"
                            fontSize="8px"
                            fontWeight="700"
                            style={{ letterSpacing: '0.05em' }}
                          >
                            START
                          </text>
                        </g>
                      ) : (
                        // Solid Growth Bar
                        (() => {
                          const isPos = p.growth > 0;
                          const isNeg = p.growth < 0;
                          let fill = 'rgba(99, 102, 241, 0.15)';
                          let stroke = 'var(--color-primary)';
                          
                          if (isPos) {
                            fill = 'rgba(16, 185, 129, 0.15)';
                            stroke = '#10b981';
                          } else if (isNeg) {
                            fill = 'rgba(239, 68, 68, 0.15)';
                            stroke = '#ef4444';
                          }

                          const valY = getGrowthY(p.growth);
                          const barHeight = Math.max(2, Math.abs(zeroY - valY));
                          const rectY = isPos ? valY : (isNeg ? zeroY : zeroY - 1);

                          return (
                            <rect
                              x={growthBarX}
                              y={rectY}
                              width={growthBarWidth}
                              height={barHeight}
                              fill={fill}
                              stroke={stroke}
                              strokeWidth="1.5"
                              rx={3}
                              style={{ transition: 'all 0.3s ease' }}
                            />
                          );
                        })()
                      )
                    )}

                    {/* X-axis period labels */}
                    <text
                      x={colCenterX}
                      y={chartPadding.top + chartHeight + 18}
                      textAnchor="middle"
                      fill="var(--text-secondary)"
                      fontSize="10px"
                      fontWeight="600"
                    >
                      {p.label}
                    </text>

                    {/* Full Column Hover Interactive Overlay */}
                    <rect
                      x={chartPadding.left + barGroupWidth * i}
                      y={chartPadding.top}
                      width={barGroupWidth}
                      height={chartHeight}
                      fill="transparent"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => {
                        setHoveredBar(p);
                        setTooltipPos({ x: colCenterX, y: getTooltipY(p) });
                      }}
                      onMouseMove={() => {
                        setHoveredBar(p);
                        setTooltipPos({ x: colCenterX, y: getTooltipY(p) });
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Floating Tooltip */}
            {hoveredBar && (() => {
              const isPos = hoveredBar.growth > 0;
              const sign = isPos ? '+' : '';
              const prevIdx = activePeriods.findIndex(p => p.id === hoveredBar.id) - 1;
              const prevP = prevIdx >= 0 ? activePeriods[prevIdx] : null;

              return (
                <div
                  className="chart-tooltip animate-fade-in"
                  style={{
                    left: `${(tooltipPos.x / 680) * 100}%`,
                    top: `${(tooltipPos.y / 240) * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    marginTop: '-10px',
                    pointerEvents: 'none',
                    zIndex: 100,
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <div className="tooltip-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{hoveredBar.label}</span>
                    {showGrowth && (
                      hoveredBar.growth !== null ? (
                        hoveredBar.growth === 0 ? (
                          <span
                            className="tooltip-badge hike"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              color: 'var(--color-primary)',
                              background: 'rgba(99, 102, 241, 0.1)',
                              borderColor: 'rgba(99, 102, 241, 0.2)',
                              borderRadius: '4px',
                              border: '1px solid'
                            }}
                          >
                            0.0%
                          </span>
                        ) : (
                          <span
                            className={`tooltip-badge ${isPos ? 'bonus' : 'hike'}`}
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.45rem',
                              color: isPos ? '#10b981' : '#ef4444',
                              background: isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              borderColor: isPos ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              borderRadius: '4px',
                              border: '1px solid'
                            }}
                          >
                            {sign}{hoveredBar.growth.toFixed(1)}%
                          </span>
                        )
                      ) : (
                        <span
                          className="tooltip-badge hike"
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.45rem',
                            color: 'var(--color-primary)',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderColor: 'rgba(99, 102, 241, 0.2)',
                            borderRadius: '4px',
                            border: '1px solid'
                          }}
                        >
                          Start
                        </span>
                      )
                    )}
                  </div>

                  {showTotalComp && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Total Comp: <strong style={{ color: 'var(--color-primary)' }}>{formatFullCurrency(hoveredBar.total)}</strong>
                      </div>
                      {prevP && showGrowth && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Prev Period: <strong>{formatFullCurrency(prevP.total)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Breakdown context */}
                  {showTotalComp && (hoveredBar.base > 0 || hoveredBar.bonus > 0 || hoveredBar.vest > 0) && (
                    <div style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      marginTop: '0.5rem',
                      paddingTop: '0.4rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                      fontSize: '0.68rem',
                      color: 'var(--text-muted)'
                    }}>
                      {hoveredBar.base > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-base)' }}></span>
                            <span>Base</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatFullCurrency(hoveredBar.base)}</span>
                        </div>
                      )}
                      {hoveredBar.bonus > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-bonus)' }}></span>
                            <span>Bonus</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatFullCurrency(hoveredBar.bonus)}</span>
                        </div>
                      )}
                      {hoveredBar.vest > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-vest)' }}></span>
                            <span>Vested</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatFullCurrency(hoveredBar.vest)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activePeriods.map(p => {
            const basePct = (p.base / maxPeriodTotal) * 100;
            const bonusPct = (p.bonus / maxPeriodTotal) * 100;
            const vestPct = (p.vest / maxPeriodTotal) * 100;

            let growthEl = null;
            if (showGrowth) {
              if (p.growth !== null) {
                if (p.growth === 0) {
                  growthEl = (
                    <span
                      className="tooltip-badge hike"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.45rem',
                        color: 'var(--color-primary)',
                        background: 'rgba(99, 102, 241, 0.1)',
                        borderColor: 'rgba(99, 102, 241, 0.2)'
                      }}
                    >
                      0.0%
                    </span>
                  );
                } else {
                  const growthVal = p.growth;
                  const isGrowthPos = growthVal > 0;
                  const sign = isGrowthPos ? '+' : '';
                  growthEl = (
                    <span
                      className={`tooltip-badge ${isGrowthPos ? 'bonus' : 'hike'}`}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.45rem',
                        color: isGrowthPos ? '#10b981' : '#ef4444',
                        background: isGrowthPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        borderColor: isGrowthPos ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
                      }}
                    >
                      {sign}{growthVal.toFixed(1)}%
                    </span>
                  );
                }
              } else {
                growthEl = (
                  <span className="tooltip-badge hike" style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)' }}>
                    —
                  </span>
                );
              }
            }

            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</span>
                    {growthEl}
                  </div>
                  {showTotalComp && (
                    <div style={{ fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: '0.35rem' }}>Total:</span>
                      <span style={{ color: 'var(--color-primary)' }}>{formatFullCurrency(p.total)}</span>
                    </div>
                  )}
                </div>

                {/* Progress Stacks */}
                {showTotalComp && (
                  <>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', display: 'flex', overflow: 'hidden', width: '100%' }}>
                      {p.base > 0 && (
                        <div
                          style={{ width: `${basePct}%`, background: 'var(--color-base)' }}
                          title={`Base: ${formatFullCurrency(p.base)} (${p.total > 0 ? ((p.base / p.total) * 100).toFixed(0) : 0}%)`}
                        />
                      )}
                      {p.bonus > 0 && (
                        <div
                          style={{ width: `${bonusPct}%`, background: 'var(--color-bonus)' }}
                          title={`Bonus: ${formatFullCurrency(p.bonus)} (${p.total > 0 ? ((p.bonus / p.total) * 100).toFixed(0) : 0}%)`}
                        />
                      )}
                      {p.vest > 0 && (
                        <div
                          style={{ width: `${vestPct}%`, background: 'var(--color-vest)' }}
                          title={`Vested: ${formatFullCurrency(p.vest)} (${p.total > 0 ? ((p.vest / p.total) * 100).toFixed(0) : 0}%)`}
                        />
                      )}
                    </div>

                    {/* Detailed breakout text under the bar */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem', flexWrap: 'wrap' }}>
                      {p.base > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-base)' }}></span>
                          <span>Base: <strong style={{ color: 'var(--text-secondary)' }}>{formatFullCurrency(p.base)}</strong> ({p.total > 0 ? ((p.base / p.total) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      )}
                      {p.bonus > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-bonus)' }}></span>
                          <span>Bonus: <strong style={{ color: 'var(--text-secondary)' }}>{formatFullCurrency(p.bonus)}</strong> ({p.total > 0 ? ((p.bonus / p.total) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      )}
                      {p.vest > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-vest)' }}></span>
                          <span>Vested: <strong style={{ color: 'var(--text-secondary)' }}>{formatFullCurrency(p.vest)}</strong> ({p.total > 0 ? ((p.vest / p.total) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
