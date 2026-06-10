import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';

export default function CompChart({ salaryEvents, compEvents, startDate, currency, userName, onImportJSON }) {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [hoveredItem, setHoveredItem] = useState(null); // { x, y, title, value, date, type, category }

  // Detect container size for responsiveness
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        // Keep a minimum width of 500px for desktop/tablet, height responsive but bounded
        setDimensions({
          width: Math.max(width, 500),
          height: 420
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

  // Helper: Parse date YYYY-MM
  const parseDate = (dateStr) => {
    const [y, m] = dateStr.split('-').map(Number);
    return { year: y, month: m };
  };

  // Helper: Months since Jan 2024
  const getMonthsSinceStart = (dateStr) => {
    const { year, month } = parseDate(dateStr);
    return (year - startYear) * 12 + (month - startMonth);
  };

  // Chronologically sort salary events
  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => a.date.localeCompare(b.date));

  // Determine dynamic end date
  let maxEventMonth = 35; // Default to Dec 2026 (36 months: 0 to 35)
  const allEvents = [...salaryEvents, ...compEvents];
  allEvents.forEach(e => {
    const months = getMonthsSinceStart(e.date);
    if (months > maxEventMonth) {
      maxEventMonth = months;
    }
  });
  
  // Align end to a nice quarterly/yearly boundary (at least end of year)
  const totalMonths = Math.max(maxEventMonth + 2, 35); // pad by 2 months, at least 3 years
  const endYear = startYear + Math.floor(totalMonths / 12);

  // Maximum and Minimum salary for Y scale
  const salaries = salaryEvents.map(e => e.salary);
  const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 100000;
  const maxY = Math.ceil((maxSalary * 1.15) / 10000) * 10000; // Pad 15% and round to nearest $10k
  const minY = 0;

  // Maximum compensation event amount for circle sizing
  const compAmounts = compEvents.map(e => e.amount);
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
    
    // Find last salary event on or before this date
    let activeSalary = sortedSalaryEvents[0].salary;
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      if (sortedSalaryEvents[i].date <= dateStr) {
        activeSalary = sortedSalaryEvents[i].salary;
      } else {
        break;
      }
    }
    return activeSalary;
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

  // Short currency formatter (e.g. $15k)
  const formatShortCurrency = (val) => {
    const symbol = getCurrencySymbol(currency || 'USD');
    if (val >= 1000) {
      return `${symbol}${(val / 1000).toFixed(0)}k`;
    }
    return `${symbol}${val}`;
  };

  const formatFullCurrency = (val) => {
    const activeCurrency = currency || 'USD';
    const locale = getLocaleForCurrency(activeCurrency);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: activeCurrency,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(month) - 1]} ${year}`;
  };

  // Generate salary step-line path
  let salaryPathD = '';
  let salaryAreaD = '';
  const salarySegments = [];
  
  if (sortedSalaryEvents.length > 0) {
    const startX = padding.left;
    const startY = getY(sortedSalaryEvents[0].salary);
    const bottomY = dimensions.height - padding.bottom;
    const endX = dimensions.width - padding.right;
    
    salaryPathD = `M ${startX} ${startY}`;
    salaryAreaD = `M ${startX} ${bottomY} L ${startX} ${startY}`;
    
    let lastY = startY;
    
    for (let i = 1; i < sortedSalaryEvents.length; i++) {
      const event = sortedSalaryEvents[i];
      const eventX = getX(event.date);
      const eventY = getY(event.salary);
      
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
      const segmentY = getY(currentEvent.salary);
      
      salarySegments.push({
        startX: segmentStartX,
        endX: segmentEndX,
        y: segmentY,
        salary: currentEvent.salary,
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

      <div ref={containerRef} className="chart-container">
        {salaryEvents.length === 0 ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <span className="empty-state-icon" style={{ fontSize: '3rem' }}>📈</span>
            <h3>No compensation details entered</h3>
            <p>Select a preset below or use the sidebar form to add salary and bonus events.</p>
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

            {/* Salary Area Shadow */}
            {salaryAreaD && <path className="chart-line-shadow" d={salaryAreaD} />}

            {/* Salary Step Line */}
            {salaryPathD && <path className="chart-line-salary" d={salaryPathD} />}

            {/* Salary Step Line Labels */}
            {salarySegments.map((seg, idx) => {
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
              
              const x = getX(evt.date);
              const y = getY(evt.salary);
              
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
                    const prevSalary = sortedSalaryEvents[idx - 1].salary;
                    const pctDiff = ((evt.salary - prevSalary) / prevSalary) * 100;
                    
                    setHoveredItem({
                      x: x,
                      y: y - 10,
                      title: evt.title,
                      value: `${formatFullCurrency(evt.salary)}/yr`,
                      subValue: `+${pctDiff.toFixed(0)}% change`,
                      date: formatDateLabel(evt.date),
                      type: evt.type,
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

            {/* Financial Overlay Circles (Bonus, Grant, Vest) */}
            {(() => {
              // Group financial events by date to draw overlapping ones as concentric doughnuts
              const compGroupsByDate = {};
              compEvents.forEach((evt) => {
                if (!compGroupsByDate[evt.date]) {
                  compGroupsByDate[evt.date] = [];
                }
                compGroupsByDate[evt.date].push(evt);
              });

              return Object.entries(compGroupsByDate).map(([date, group]) => {
                const x = getX(date);
                const activeSalary = getSalaryAtDate(date);
                const y = getY(activeSalary);

                // Sort events in this group by amount descending (largest first)
                const sortedGroup = [...group].sort((a, b) => b.amount - a.amount);

                // Calculate radii:
                // Smallest event (innermost) has Area proportional to its amount.
                // Each larger event (outer rings) has its Ring Area equal to its amount.
                // Ring Area = PI * R_outer^2 - PI * R_inner^2 = TargetArea
                // => R_outer = sqrt(R_inner^2 + R_base^2)
                const groupWithRadii = [];
                let prevRadius = 0;
                for (let i = sortedGroup.length - 1; i >= 0; i--) {
                  const evt = sortedGroup[i];
                  const baseRadius = getCircleRadius(evt.amount);
                  
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
                                value: formatFullCurrency(evt.amount),
                                date: formatDateLabel(evt.date),
                                type: evt.type,
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
                              {formatShortCurrency(evt.amount)}
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
                                value: formatFullCurrency(evt.amount),
                                date: formatDateLabel(evt.date),
                                type: evt.type,
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
                              {formatShortCurrency(evt.amount)}
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
              <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                {hoveredItem.title}
              </span>
            </div>
            <div className="tooltip-value">{hoveredItem.value}</div>
            {hoveredItem.subValue && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-hike)', fontWeight: 600 }}>
                {hoveredItem.subValue}
              </div>
            )}
            <div className="tooltip-date">{hoveredItem.date}</div>
          </div>
        )}
      </div>
    </div>
  );
}
