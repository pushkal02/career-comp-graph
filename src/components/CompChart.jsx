import { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, Sparkles, Image, X } from 'lucide-react';
import { convertCurrency, convertToPPP, COUNTRIES, getExpandedCompEvents, getRsuLocation } from '../utils/currency';

export default function CompChart({ 
  salaryEvents, 
  compEvents, 
  startDate, 
  currency, 
  userName, 
  onOpenShareCard,
  pppMode,
  exchangeRates,
  pppFactors
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 450 });
  const [hoveredItem, setHoveredItem] = useState(null); // { x, y, title, value, date, type, category }

  const [chartMode, setChartMode] = useState('rate'); // 'rate' or 'cumulative'
  const [futureViewDate, setFutureViewDate] = useState('');

  // Graph filters state
  const [filters, setFilters] = useState({
    salaryLine: true,
    netSalaryLine: true,
    taxLine: true,
    hike: true,
    promotion: true,
    jobswitch: true,
    bonus: true,
    grant: true,
    vest: true,
    tax: true,
    unvestedRsu: false, // OFF by default
    cumulativeLine: true,
    avgMonthlySalary: true,
    avgAnnualSalary: true
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
  const padding = { 
    top: 40, 
    right: 60, 
    bottom: 50, 
    left: 80 
  };
  
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

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const cutoffDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // Expand RSU events into visual grants and tranches (realized/projected/forfeited)
  const expandedCompEvents = getExpandedCompEvents(compEvents, sortedSalaryEvents, cutoffDate);

  let endYear = Math.max(currentYear, startYear);
  let endMonth = 12;



  // Manual future view overrides auto-extension
  if (futureViewDate && futureViewDate.length >= 7) {
    const parts = futureViewDate.split('-');
    const fy = parseInt(parts[0]);
    const fm = parseInt(parts[1]) || 12;
    if (!isNaN(fy) && !isNaN(fm)) {
      endYear = fy;
      endMonth = fm;
    }
  }

  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);

  const convertValue = (amount, eventCurrency, countryCode) => {
    if (pppMode) {
      return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
    } else {
      return convertCurrency(amount, eventCurrency, currency, exchangeRates);
    }
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
    const totalMonthsVal = monthDiff + dayDiff / 30.4368;
    return totalMonthsVal / 12;
  };

  const getSalaryAtDate = (dateStr) => {
    if (sortedSalaryEvents.length === 0) return 0;
    const normDateStr = normalizeDate(dateStr);
    let activeSalary = sortedSalaryEvents[0].salary;
    let activeCurrency = sortedSalaryEvents[0].currency;
    let activeCountry = sortedSalaryEvents[0].country;
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      const normEvtDate = normalizeDate(sortedSalaryEvents[i].date);
      if (normEvtDate <= normDateStr) {
        activeSalary = sortedSalaryEvents[i].salary;
        activeCurrency = sortedSalaryEvents[i].currency;
        activeCountry = sortedSalaryEvents[i].country;
      }
    }
    return convertValue(activeSalary, activeCurrency, activeCountry);
  };

  // Precompute cumulative points
  const cumulativePoints = [];
  for (let m = 0; m <= totalMonths; m++) {
    const y = startYear + Math.floor((startMonth - 1 + m) / 12);
    const mon = ((startMonth - 1 + m) % 12) + 1;
    const dateStr = `${y}-${String(mon).padStart(2, '0')}`;
    const salaryRate = getSalaryAtDate(dateStr);
    
    let baseEarned = 0;
    if (m > 0) {
      const prevPoint = cumulativePoints[m - 1];
      baseEarned = prevPoint.baseEarned + prevPoint.salaryRate / 12;
    }
    
    const targetLimit = `${dateStr}-31`;
    const compEarned = expandedCompEvents
      .filter(evt => {
        if (evt.status === 'projected') {
          return (evt.type === 'bonus' || evt.type === 'vest') && evt.date <= targetLimit;
        }
        return (evt.type === 'bonus' || evt.type === 'vest') && evt.date <= targetLimit;
      })
      .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

    const taxCumulative = expandedCompEvents
      .filter(evt => evt.type === 'tax' && evt.date <= targetLimit)
      .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);
      
    const totalEarned = baseEarned + compEarned;
    // Career-average annual earnings rate up to and including this month
    const avgMonthlyScaled = (totalEarned * 12) / (m + 1);
    
    cumulativePoints.push({
      m,
      dateStr,
      salaryRate,
      baseEarned,
      compEarned,
      taxCumulative,
      totalEarned,
      avgMonthlyScaled
    });
  }

  // Precompute rolling 12-month average of total annual earnings (salary + comp events in the window)
  for (let m = 0; m <= totalMonths; m++) {
    if (m < 11) {
      cumulativePoints[m].avgAnnualRolling = null;
      continue;
    }
    const startIndex = m - 11;
    
    let baseSalaryInWindow = 0;
    for (let i = startIndex; i <= m; i++) {
      baseSalaryInWindow += cumulativePoints[i].salaryRate / 12;
    }
    
    const compInWindow = cumulativePoints[m].compEarned - (startIndex > 0 ? cumulativePoints[startIndex - 1].compEarned : 0);
    const totalInWindow = baseSalaryInWindow + compInWindow;
    
    // totalInWindow is the sum of 12 months of earnings = 1-year worth.
    // Do NOT multiply by 12 again — that would double-annualize it.
    cumulativePoints[m].avgAnnualRolling = totalInWindow;
  }

  // Precompute calendar year tax paid
  const yearToTaxPaid = {};
  expandedCompEvents.forEach(evt => {
    if (evt.type === 'tax') {
      const yr = evt.date.split('-')[0];
      const convertedAmt = convertValue(Number(evt.amount), evt.currency, evt.country);
      yearToTaxPaid[yr] = (yearToTaxPaid[yr] || 0) + convertedAmt;
    }
  });
  const maxTaxYearly = Object.values(yearToTaxPaid).length > 0 ? Math.max(...Object.values(yearToTaxPaid)) : 0;

  // Maximum and Minimum salary for Y scale
  const salaries = salaryEvents.map(e => convertValue(e.salary, e.currency, e.country));
  const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 100000;
  const maxY = Math.ceil((Math.max(maxSalary, maxTaxYearly) * 1.15) / 10000) * 10000; // Pad 15% and round to nearest $10k
  const minY = 0;

  const maxCumulative = cumulativePoints.length > 0 
    ? Math.max(...cumulativePoints.map(p => Math.max(p.totalEarned, p.taxCumulative || 0))) 
    : 100000;
  const maxYCumulative = Math.ceil((maxCumulative * 1.15) / 10000) * 10000;
  
  // Maximum average rate (salary + comp)
  const maxAverageRate = cumulativePoints.length > 0
    ? Math.max(...cumulativePoints.map(p => Math.max(p.avgMonthlyScaled || 0, p.avgAnnualRolling || 0)))
    : 100000;
  const maxRateValue = Math.max(maxSalary, maxAverageRate, maxTaxYearly);
  const maxYRate = Math.ceil((maxRateValue * 1.15) / 10000) * 10000;

  // In cumulative mode: Y-axis scales to the cumulative total (largest value).
  // The rate lines (rolling avg, career avg) are smaller values on the same axis.
  const currentMaxY = chartMode === 'cumulative' ? maxYCumulative : maxY;

  // Maximum compensation event amount for circle sizing
  const compAmounts = expandedCompEvents.map(e => convertValue(e.amount, e.currency, e.country));
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
      :root {
        --color-base: ${isLightMode ? '#0284c7' : '#38bdf8'};
        --color-hike: #14b8a6;
        --color-promotion: #ec4899;
        --color-switch: #3b82f6;
        --color-bonus: ${isLightMode ? '#059669' : '#10b981'};
        --color-grant: ${isLightMode ? '#d97706' : '#f59e0b'};
        --color-vest: ${isLightMode ? '#7c3aed' : '#a855f7'};
        --color-tax: ${isLightMode ? '#e11d48' : '#f43f5e'};
        --bg-primary: ${isLightMode ? '#f8fafc' : '#070a13'};
        --text-primary: ${isLightMode ? '#0f172a' : '#f8fafc'};
        --color-avg-monthly: ${isLightMode ? '#0284c7' : '#38bdf8'};
        --color-avg-annual: ${isLightMode ? '#4f46e5' : '#818cf8'};
      }
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
      .chart-line-tax { fill: none; stroke: var(--color-tax); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
      .chart-line-tax-shadow { fill: url(#tax-gradient); opacity: 0.06; }
      .chart-line-tax-cumulative { fill: none; stroke: var(--color-tax); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
      .chart-line-tax-cumulative-shadow { fill: url(#tax-gradient); opacity: 0.08; }
      .chart-line-cumulative-realized { fill: none; stroke: var(--color-vest); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
      .chart-line-cumulative-realized-shadow { fill: url(#cumulative-realized-gradient); opacity: 0.08; }
      .chart-line-cumulative-projected { fill: none; stroke: var(--color-vest); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 4,4; }
      .chart-line-cumulative-projected-shadow { fill: url(#cumulative-projected-gradient); opacity: 0.05; }
      .chart-line-avg-monthly { fill: none; stroke: var(--color-avg-monthly); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 4,4; }
      .chart-line-avg-annual { fill: none; stroke: var(--color-avg-annual); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
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

  const exportCSV = () => {
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Combine all events chronologically
    const allEvents = [
      ...salaryEvents.map(e => ({
        date: e.date,
        category: 'Salary Remuneration',
        type: e.type,
        origVal: e.salary,
        origCurr: e.currency || 'USD',
        convVal: convertValue(e.salary, e.currency || 'USD', e.country),
        company: e.company || 'Self-Employed',
        country: e.country || '',
        location: e.location || '',
        title: e.title || '',
        monthlyGross: e.salary / 12,
        monthlyNet: e.monthlyNetSalary || ''
      })),
      ...compEvents.map(e => ({
        date: e.date,
        category: 'Compensation',
        type: e.type,
        origVal: e.amount,
        origCurr: e.currency || 'USD',
        convVal: convertValue(e.amount, e.currency || 'USD', e.country),
        company: e.company || 'Self-Employed',
        country: e.country || '',
        location: e.location || '',
        title: e.title || '',
        monthlyGross: '',
        monthlyNet: ''
      }))
    ].sort((a, b) => {
      const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
      const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
      return normA.localeCompare(normB);
    });

    const headers = ['Date', 'Category', 'Type', 'Original Amount', 'Original Currency', 'Converted Amount', 'Converted Currency', 'Monthly Gross', 'Monthly Net', 'Employer', 'Country', 'Location', 'Title'];
    const rows = allEvents.map(e => [
      escapeCSV(e.date),
      escapeCSV(e.category),
      escapeCSV(e.type),
      e.origVal,
      escapeCSV(e.origCurr),
      e.convVal,
      escapeCSV(pppMode ? 'USD (PPP)' : currency),
      e.monthlyGross,
      e.monthlyNet,
      escapeCSV(e.company),
      escapeCSV(e.country),
      escapeCSV(e.location),
      escapeCSV(e.title)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);

    const a = document.createElement('a');
    a.download = `career-compensation-data-${startDate || '2024-01'}.csv`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };



  // Coordinate conversion utilities
  const getX = (dateStr) => {
    const months = getMonthsSinceStart(dateStr);
    const ratio = months / totalMonths;
    const chartWidth = dimensions.width - padding.left - padding.right;
    return padding.left + ratio * chartWidth;
  };

  const getY = (salary) => {
    const ratio = (salary - minY) / (currentMaxY - minY);
    const chartHeight = dimensions.height - padding.top - padding.bottom;
    // SVG 0,0 is top-left, so we invert
    return dimensions.height - padding.bottom - ratio * chartHeight;
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
    const activeCurrency = pppMode ? 'USD' : (eventCurrency || currency || 'USD');
    const symbol = pppMode ? 'PPP $' : getCurrencySymbol(activeCurrency);
    const isINR = !pppMode && activeCurrency === 'INR';
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
    if (pppMode) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(val);
      return formatted.replace('$', 'PPP $');
    }
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
  let netSalaryPathD = '';
  let netSalaryAreaD = '';
  let taxPathD = '';
  let taxAreaD = '';
  const salarySegments = [];
  
  if (sortedSalaryEvents.length > 0) {
    const startX = padding.left;
    const startY = getY(convertValue(sortedSalaryEvents[0].salary, sortedSalaryEvents[0].currency, sortedSalaryEvents[0].country));
    
    // Net salary calculation
    const firstEvent = sortedSalaryEvents[0];
    const firstNetSalary = firstEvent.monthlyNetSalary !== undefined && firstEvent.monthlyNetSalary !== null
      ? firstEvent.monthlyNetSalary * 12
      : firstEvent.salary;
    const startNetY = getY(convertValue(firstNetSalary, firstEvent.currency, firstEvent.country));

    const bottomY = dimensions.height - padding.bottom;
    const endX = dimensions.width - padding.right;
    
    salaryPathD = `M ${startX} ${startY}`;
    salaryAreaD = `M ${startX} ${bottomY} L ${startX} ${startY}`;

    netSalaryPathD = `M ${startX} ${startNetY}`;
    netSalaryAreaD = `M ${startX} ${bottomY} L ${startX} ${startNetY}`;
    
    let lastY = startY;
    let lastNetY = startNetY;
    
    for (let i = 1; i < sortedSalaryEvents.length; i++) {
      const event = sortedSalaryEvents[i];
      const eventX = getX(event.date);
      const eventY = getY(convertValue(event.salary, event.currency, event.country));

      const eventNetSalary = event.monthlyNetSalary !== undefined && event.monthlyNetSalary !== null
        ? event.monthlyNetSalary * 12
        : event.salary;
      const eventNetY = getY(convertValue(eventNetSalary, event.currency, event.country));
      
      // Step horizontal, then vertical
      salaryPathD += ` L ${eventX} ${lastY} L ${eventX} ${eventY}`;
      salaryAreaD += ` L ${eventX} ${lastY} L ${eventX} ${eventY}`;

      netSalaryPathD += ` L ${eventX} ${lastNetY} L ${eventX} ${eventNetY}`;
      netSalaryAreaD += ` L ${eventX} ${lastNetY} L ${eventX} ${eventNetY}`;
      
      lastY = eventY;
      lastNetY = eventNetY;
    }
    
    // Draw to end of chart
    salaryPathD += ` L ${endX} ${lastY}`;
    salaryAreaD += ` L ${endX} ${lastY} L ${endX} ${bottomY} Z`;

    netSalaryPathD += ` L ${endX} ${lastNetY}`;
    netSalaryAreaD += ` L ${endX} ${lastNetY} L ${endX} ${bottomY} Z`;

    // Draw annual tax paid step-line rate
    if (expandedCompEvents.some(e => e.type === 'tax')) {
      const taxPoints = [];
      for (let m = 0; m <= totalMonths; m++) {
        const yr = startYear + Math.floor((startMonth - 1 + m) / 12);
        const mon = ((startMonth - 1 + m) % 12) + 1;
        const dateStr = `${yr}-${String(mon).padStart(2, '0')}`;
        const x = getX(dateStr);
        const taxVal = yearToTaxPaid[yr] || 0;
        const y = getY(taxVal);
        taxPoints.push({ x, y, taxVal, yr });
      }
      
      if (taxPoints.length > 0) {
        taxPathD = `M ${taxPoints[0].x} ${taxPoints[0].y}`;
        taxAreaD = `M ${taxPoints[0].x} ${bottomY} L ${taxPoints[0].x} ${taxPoints[0].y}`;
        
        let lastTaxY = taxPoints[0].y;
        for (let i = 1; i < taxPoints.length; i++) {
          const pt = taxPoints[i];
          if (pt.yr !== taxPoints[i - 1].yr) {
            taxPathD += ` L ${pt.x} ${lastTaxY} L ${pt.x} ${pt.y}`;
            taxAreaD += ` L ${pt.x} ${lastTaxY} L ${pt.x} ${pt.y}`;
            lastTaxY = pt.y;
          }
        }
        taxPathD += ` L ${endX} ${lastTaxY}`;
        taxAreaD += ` L ${endX} ${lastTaxY} L ${endX} ${bottomY} Z`;
      }
    }

    // Compute segments for text labels
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      const currentEvent = sortedSalaryEvents[i];
      const nextEvent = sortedSalaryEvents[i + 1];
      
      const segmentStartX = i === 0 ? startX : getX(currentEvent.date);
      const segmentEndX = i === sortedSalaryEvents.length - 1 ? endX : getX(nextEvent.date);
      const segmentY = getY(convertValue(currentEvent.salary, currentEvent.currency, currentEvent.country));
      
      salarySegments.push({
        startX: segmentStartX,
        endX: segmentEndX,
        y: segmentY,
        salary: convertValue(currentEvent.salary, currentEvent.currency, currentEvent.country),
        id: currentEvent.id
      });
    }
  }

  // Draw grid lines
  const gridLinesY = [];
  const yTicksCount = 5;
  const salaryDiff = currentMaxY - minY;
  for (let i = 0; i <= yTicksCount; i++) {
    const val = minY + (salaryDiff / yTicksCount) * i;
    gridLinesY.push(val);
  }

  // Cumulative earnings paths
  let cumulativeRealizedPathD = '';
  let cumulativeRealizedAreaD = '';
  let cumulativeProjectedPathD = '';
  let cumulativeProjectedAreaD = '';

  const realizedPoints = cumulativePoints.filter(p => p.dateStr < cutoffDate);
  const projectedPoints = cumulativePoints.filter(p => p.dateStr >= cutoffDate);
  const bottomY = dimensions.height - padding.bottom;

  // Cumulative area: plots absolute totalEarned $ (grows over time, always largest)
  // getAnnualizedRate is no longer used — area uses totalEarned directly.

  if (realizedPoints.length > 0) {
    const startX = getX(realizedPoints[0].dateStr);
    const startY = getY(realizedPoints[0].totalEarned);
    cumulativeRealizedPathD = `M ${startX} ${startY}`;
    cumulativeRealizedAreaD = `M ${startX} ${bottomY} L ${startX} ${startY}`;
    
    for (let i = 1; i < realizedPoints.length; i++) {
      const pt = realizedPoints[i];
      cumulativeRealizedPathD += ` L ${getX(pt.dateStr)} ${getY(pt.totalEarned)}`;
      cumulativeRealizedAreaD += ` L ${getX(pt.dateStr)} ${getY(pt.totalEarned)}`;
    }
    
    const lastRealized = realizedPoints[realizedPoints.length - 1];
    cumulativeRealizedAreaD += ` L ${getX(lastRealized.dateStr)} ${bottomY} Z`;

    if (projectedPoints.length > 0) {
      cumulativeProjectedPathD = `M ${getX(lastRealized.dateStr)} ${getY(lastRealized.totalEarned)}`;
      cumulativeProjectedAreaD = `M ${getX(lastRealized.dateStr)} ${bottomY} L ${getX(lastRealized.dateStr)} ${getY(lastRealized.totalEarned)}`;
      
      for (let i = 0; i < projectedPoints.length; i++) {
        const pt = projectedPoints[i];
        cumulativeProjectedPathD += ` L ${getX(pt.dateStr)} ${getY(pt.totalEarned)}`;
        cumulativeProjectedAreaD += ` L ${getX(pt.dateStr)} ${getY(pt.totalEarned)}`;
      }
      
      const lastProjected = projectedPoints[projectedPoints.length - 1];
      cumulativeProjectedAreaD += ` L ${getX(lastProjected.dateStr)} ${bottomY} Z`;
    }
  } else if (projectedPoints.length > 0) {
    const startX = getX(projectedPoints[0].dateStr);
    const startY = getY(projectedPoints[0].totalEarned);
    cumulativeProjectedPathD = `M ${startX} ${startY}`;
    cumulativeProjectedAreaD = `M ${startX} ${bottomY} L ${startX} ${startY}`;
    
    for (let i = 1; i < projectedPoints.length; i++) {
      const pt = projectedPoints[i];
      cumulativeProjectedPathD += ` L ${getX(pt.dateStr)} ${getY(pt.totalEarned)}`;
      cumulativeProjectedAreaD += ` L ${getX(pt.dateStr)} ${getY(pt.totalEarned)}`;
    }
    const lastProjected = projectedPoints[projectedPoints.length - 1];
    cumulativeProjectedAreaD += ` L ${getX(lastProjected.dateStr)} ${bottomY} Z`;
  }

  // Cumulative tax paid path
  let cumulativeTaxPathD = '';
  let cumulativeTaxAreaD = '';
  if (cumulativePoints.length > 0) {
    const startX = getX(cumulativePoints[0].dateStr);
    const startY = getY(cumulativePoints[0].taxCumulative);
    cumulativeTaxPathD = `M ${startX} ${startY}`;
    cumulativeTaxAreaD = `M ${startX} ${bottomY} L ${startX} ${startY}`;
    
    for (let i = 1; i < cumulativePoints.length; i++) {
      const pt = cumulativePoints[i];
      const x = getX(pt.dateStr);
      const y = getY(pt.taxCumulative);
      cumulativeTaxPathD += ` L ${x} ${y}`;
      cumulativeTaxAreaD += ` L ${x} ${y}`;
    }
    const lastPoint = cumulativePoints[cumulativePoints.length - 1];
    const endX = getX(lastPoint.dateStr);
    cumulativeTaxAreaD += ` L ${endX} ${bottomY} Z`;
  }

  // Average paths
  let avgMonthlyPathD = '';
  let avgAnnualPathD = '';

  // Both average lines start only after a full year (month index 11 = 12th month)
  const firstEventDateStr = sortedSalaryEvents.length > 0
    ? sortedSalaryEvents[0].date.slice(0, 7)
    : (cumulativePoints[0]?.dateStr || '');
  const firstEventIdx = cumulativePoints.findIndex(p => p.dateStr >= firstEventDateStr);
  // Start at whichever comes later: first event OR 1-year mark
  const avgStartIdx = Math.max(firstEventIdx >= 0 ? firstEventIdx : 0, 11);

  if (cumulativePoints.length > avgStartIdx) {
    // Career average: starts after 1 full year, same threshold as rolling average
    avgMonthlyPathD = `M ${getX(cumulativePoints[avgStartIdx].dateStr)} ${getY(cumulativePoints[avgStartIdx].avgMonthlyScaled)}`;
    for (let i = avgStartIdx + 1; i < cumulativePoints.length; i++) {
      const pt = cumulativePoints[i];
      avgMonthlyPathD += ` L ${getX(pt.dateStr)} ${getY(pt.avgMonthlyScaled)}`;
    }

    // Rolling average starts at m = 11 (the 12th month, i.e. after 1 full year)
    if (cumulativePoints.length > 11) {
      avgAnnualPathD = `M ${getX(cumulativePoints[11].dateStr)} ${getY(cumulativePoints[11].avgAnnualRolling)}`;
      for (let i = 12; i < cumulativePoints.length; i++) {
        const pt = cumulativePoints[i];
        avgAnnualPathD += ` L ${getX(pt.dateStr)} ${getY(pt.avgAnnualRolling)}`;
      }
    }
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
            {chartMode === 'cumulative' ? "Cumulative Career Earnings" : "Compensation Progression Timeline"}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {chartMode === 'cumulative' 
              ? "Continuous career base salary integration plus discrete cash payouts" 
              : "Proportional financial event circles mapped on salary remuneration timeline"}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mode Selector */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '2px', marginRight: '0.5rem' }}>
            <button
              type="button"
              className="btn"
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: chartMode === 'rate' ? 'var(--color-primary)' : 'transparent',
                color: chartMode === 'rate' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: 'auto'
              }}
              onClick={() => setChartMode('rate')}
            >
              Salary Rate & Events
            </button>
            <button
              type="button"
              className="btn"
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: chartMode === 'cumulative' ? 'var(--color-primary)' : 'transparent',
                color: chartMode === 'cumulative' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                width: 'auto'
              }}
              onClick={() => setChartMode('cumulative')}
            >
              Cumulative Earnings
            </button>
          </div>
 
          {/* Future View Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.5rem', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Future View:</span>
            <select
              value={futureViewDate}
              onChange={(e) => setFutureViewDate(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                outline: 'none',
                padding: '2px',
                cursor: 'pointer'
              }}
            >
              <option value="" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>None</option>
              {Array.from({ length: 10 }, (_, i) => {
                const year = currentYear + i + 1;
                return (
                  <option key={year} value={`${year}-12`} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    {year} ({i + 1} Yr Out)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Action buttons */}
          <button
            onClick={onOpenShareCard}
            className="btn"
            style={{ 
              padding: '0.25rem 0.6rem', 
              fontSize: '0.75rem', 
              width: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem', 
              background: 'var(--color-primary)', 
              color: '#fff',
              borderColor: 'var(--color-primary-hover)'
            }}
            title="Generate a beautiful shareable social card"
          >
            <Sparkles size={13} /> Share Card
          </button>
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
            onClick={exportCSV}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            title="Export data as CSV spreadsheet"
          >
            <FileSpreadsheet size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Event type filters row */}
      <div className="chart-filters-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, marginRight: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Filter Timeline:
        </span>
        {(chartMode === 'rate'
          ? [
              { key: 'salaryLine', label: 'Gross Salary Line', color: 'var(--color-base)' },
              { key: 'netSalaryLine', label: 'Net Take-Home Line', color: '#10b981' },
              { key: 'taxLine', label: 'Annual Direct Tax Paid', color: 'var(--color-tax)' },
              { key: 'hike', label: 'Salary Hikes', color: 'var(--color-hike)' },
              { key: 'promotion', label: 'Promotions', color: 'var(--color-promotion)' },
              { key: 'jobswitch', label: 'Job Switches', color: 'var(--color-switch)' },
              { key: 'bonus', label: 'Bonuses', color: 'var(--color-bonus)' },
              { key: 'grant', label: 'Grants', color: 'var(--color-grant)' },
              { key: 'vest', label: 'Vesting', color: 'var(--color-vest)' },
              { key: 'tax', label: 'Direct Tax Paid', color: 'var(--color-tax)' }
            ]
          : [
              { key: 'cumulativeLine', label: 'Cumulative Earnings', color: 'var(--color-vest)' },
              { key: 'taxLine', label: 'Cumulative Direct Tax Paid', color: 'var(--color-tax)' },
              { key: 'avgMonthlySalary', label: 'Cumulative Average Earnings', color: 'var(--color-avg-monthly)' },
              { key: 'avgAnnualSalary', label: 'Rolling Average Earnings', color: 'var(--color-avg-annual)' },
              { key: 'bonus', label: 'Bonuses', color: 'var(--color-bonus)' },
              { key: 'vest', label: 'Vesting', color: 'var(--color-vest)' },
              { key: 'tax', label: 'Direct Tax Paid', color: 'var(--color-tax)' }
            ]
        ).map((filter) => {
          const isActive = filters[filter.key];
          let rgbString = '168, 85, 247'; // Default violet
          if (filter.key === 'salaryLine') rgbString = '56, 189, 248';
          else if (filter.key === 'netSalaryLine') rgbString = '16, 185, 129';
          else if (filter.key === 'taxLine') rgbString = '244, 63, 94';
          else if (filter.key === 'hike') rgbString = '20, 184, 166';
          else if (filter.key === 'promotion') rgbString = '236, 72, 153';
          else if (filter.key === 'jobswitch') rgbString = '59, 130, 246';
          else if (filter.key === 'bonus') rgbString = '16, 185, 129';
          else if (filter.key === 'grant') rgbString = '245, 158, 11';
          else if (filter.key === 'vest') rgbString = '168, 85, 247';
          else if (filter.key === 'tax') rgbString = '244, 63, 94';
          else if (filter.key === 'unvestedRsu') rgbString = '168, 85, 247';
          else if (filter.key === 'cumulativeLine') rgbString = '168, 85, 247';
          else if (filter.key === 'avgMonthlySalary') rgbString = '14, 165, 233';
          else if (filter.key === 'avgAnnualSalary') rgbString = '99, 102, 241';

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
              onClick={() => {
                setFilters(prev => ({ ...prev, [filter.key]: !prev[filter.key] }));
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: filter.color, display: 'inline-block' }}></span>
              {filter.label}
            </button>
          );
        })}
      </div>

      <div ref={containerRef} className="chart-container">
        {salaryEvents.length === 0 ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <span className="empty-state-icon" style={{ fontSize: '3rem' }}>📈</span>
            <h3>No compensation details entered</h3>
            <p>Use the sidebar form to add your salary remuneration milestones, or import a JSON backup.</p>
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
              <linearGradient id="net-salary-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="tax-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-tax)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--color-tax)" stopOpacity="0.0" />
              </linearGradient>

              {/* Cumulative Gradients */}
              <linearGradient id="cumulative-realized-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-vest)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-vest)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="cumulative-projected-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-vest)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--color-vest)" stopOpacity="0.0" />
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



            {/* Render lines and nodes based on Mode */}
            {chartMode === 'rate' ? (
              <g>
                {/* Annual Tax Step Line & Area */}
                {filters.taxLine && taxAreaD && <path className="chart-line-tax-shadow" d={taxAreaD} />}
                {filters.taxLine && taxPathD && <path className="chart-line-tax" d={taxPathD} />}

                {/* Net Salary Step Line & Area */}
                {filters.netSalaryLine && netSalaryAreaD && <path className="chart-line-net-shadow" d={netSalaryAreaD} />}
                {filters.netSalaryLine && netSalaryPathD && <path className="chart-line-net-salary" d={netSalaryPathD} />}

                {/* Salary Area Shading */}
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

                {/* Salary Change Event Nodes (Diamond/Square Indicators) */}
                {sortedSalaryEvents.map((evt, idx) => {
                  if (idx === 0) return null;
                  if (!filters[evt.type]) return null;
                  
                  const x = getX(evt.date);
                  const y = getY(convertValue(evt.salary, evt.currency, evt.country));
                  
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
                          const prevEvent = sortedSalaryEvents[idx - 1];
                          const prevSalary = convertValue(prevEvent.salary, prevEvent.currency, prevEvent.country);
                          const currSalary = convertValue(evt.salary, evt.currency, evt.country);
                          const pctDiff = prevSalary !== 0 ? ((currSalary - prevSalary) / prevSalary) * 100 : 0;
                          
                          const prevNetVal = prevEvent.monthlyNetSalary !== undefined && prevEvent.monthlyNetSalary !== null
                            ? prevEvent.monthlyNetSalary * 12
                            : prevEvent.salary;
                          const currNetVal = evt.monthlyNetSalary !== undefined && evt.monthlyNetSalary !== null
                            ? evt.monthlyNetSalary * 12
                            : evt.salary;
                          
                          const prevNetSalary = convertValue(prevNetVal, prevEvent.currency, prevEvent.country);
                          const currNetSalary = convertValue(currNetVal, evt.currency, evt.country);
                          const netHikeDiff = (currNetSalary - prevNetSalary) / 12;
                          const pctNetDiff = prevNetSalary !== 0 ? ((currNetSalary - prevNetSalary) / prevNetSalary) * 100 : 0;

                          setHoveredItem({
                            x: x,
                            y: y - 10,
                            title: evt.title,
                            value: `${formatFullCurrency(currSalary)}/yr`,
                            subValue: pctDiff > 0 ? `+${pctDiff.toFixed(0)}% gross change` : `${pctDiff.toFixed(0)}% gross change`,
                            date: formatDateLabel(evt.date),
                            type: evt.type,
                            company: evt.company || 'Self-Employed',
                            country: evt.country,
                            currency: evt.currency,
                            location: evt.location,
                            category: 'salary',
                            convertedGross: currSalary / 12,
                            convertedNet: evt.monthlyNetSalary !== undefined && evt.monthlyNetSalary !== null 
                              ? convertValue(evt.monthlyNetSalary, evt.currency, evt.country) 
                              : convertValue(evt.salary / 12, evt.currency, evt.country),
                            netHikeDiff: netHikeDiff,
                            pctNetDiff: pctNetDiff
                          });
                        }}
                       onMouseLeave={() => setHoveredItem(null)}
                    >
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
                  const endLimitDate = `${endYear}-${String(endMonth).padStart(2, '0')}-31`;
                  const filteredCompEvents = expandedCompEvents.filter(evt => {
                    if (evt.date > endLimitDate) return false;
                    if (evt.status === 'projected') {
                      return true;
                    }
                    if (evt.type === 'rsu_forfeited') return filters.vest;
                    return filters[evt.type];
                  });
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
                    
                    const sortedGroup = [...group].sort((a, b) => {
                      const valA = convertValue(a.amount, a.currency, a.country);
                      const valB = convertValue(b.amount, b.currency, b.country);
                      return valB - valA;
                    });
      
                    const groupWithRadii = [];
                    let prevRadius = 0;
                    for (let i = sortedGroup.length - 1; i >= 0; i--) {
                      const evt = sortedGroup[i];
                      const convertedAmt = convertValue(evt.amount, evt.currency, evt.country);
                      const baseRadius = getCircleRadius(convertedAmt);
                      
                      let radius;
                      if (i === sortedGroup.length - 1) {
                        radius = baseRadius;
                      } else {
                        const areaSumRadius = Math.sqrt(prevRadius * prevRadius + baseRadius * baseRadius);
                        radius = Math.max(areaSumRadius, prevRadius + 6);
                      }
                      
                      groupWithRadii.unshift({ evt, radius });
                      prevRadius = radius;
                    }
     
                    return (
                      <g key={`comp-group-${date}`}>
                        {groupWithRadii.map(({ evt, radius }, idx) => {
                          let fillColor = 'rgba(16, 185, 129, 0.22)';
                          let strokeColor = 'var(--color-bonus)';
                          const isDashed = evt.status === 'projected' || evt.type === 'rsu_forfeited';

                          if (evt.type === 'grant') {
                            fillColor = 'rgba(245, 158, 11, 0.22)';
                            strokeColor = 'var(--color-grant)';
                          } else if (evt.type === 'vest') {
                            fillColor = 'rgba(168, 85, 247, 0.22)';
                            strokeColor = 'var(--color-vest)';
                          } else if (evt.type === 'tax') {
                            fillColor = 'rgba(244, 63, 94, 0.22)';
                            strokeColor = 'var(--color-tax)';
                          } else if (evt.type === 'rsu_forfeited') {
                            fillColor = 'rgba(148, 163, 184, 0.08)';
                            strokeColor = '#94a3b8';
                          }
     
                          const isInnermost = idx === groupWithRadii.length - 1;
     
                          if (isInnermost) {
                            return (
                              <g
                                key={`comp-evt-${evt.id}`}
                                className="chart-comp-node"
                                style={{ '--node-color': strokeColor, opacity: evt.status === 'projected' ? 0.35 : 1 }}
                                transform={`translate(${x}, ${y})`}
                                onMouseEnter={() => {
                                  setHoveredItem({
                                    x: x,
                                    y: y - radius - 10,
                                    title: evt.title,
                                    value: formatFullCurrency(convertValue(evt.amount, evt.currency, evt.country)),
                                    amount: evt.amount,
                                    date: formatDateLabel(evt.date),
                                    type: evt.type,
                                    company: evt.company || 'Self-Employed',
                                    country: evt.country,
                                    currency: evt.currency,
                                    location: getRsuLocation(evt),
                                    category: 'comp',
                                    taxableIncome: evt.taxableIncome,
                                    financialYear: evt.financialYear,
                                    assessmentYear: evt.assessmentYear
                                  });
                                }}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <circle
                                  r={radius}
                                  fill={fillColor}
                                  stroke={strokeColor}
                                  strokeWidth="2"
                                  strokeDasharray={isDashed ? "3,3" : undefined}
                                  style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}
                                />
                                <circle
                                  r={Math.max(radius - 4, 3)}
                                  fill="transparent"
                                  stroke="rgba(255,255,255,0.15)"
                                  strokeWidth="1"
                                  strokeDasharray="2,2"
                                />
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
                            const nextRadius = groupWithRadii[idx + 1].radius;
                            const strokeWidth = radius - nextRadius;
                            const ringRadius = (radius + nextRadius) / 2;
     
                            return (
                              <g
                                key={`comp-evt-${evt.id}`}
                                className="chart-comp-node"
                                style={{ '--node-color': strokeColor, opacity: evt.status === 'projected' ? 0.35 : 1 }}
                                transform={`translate(${x}, ${y})`}
                                onMouseEnter={() => {
                                  setHoveredItem({
                                    x: x,
                                    y: y - radius - 10,
                                    title: evt.title,
                                    value: formatFullCurrency(convertValue(evt.amount, evt.currency, evt.country)),
                                    date: formatDateLabel(evt.date),
                                    type: evt.type,
                                    company: evt.company || 'Self-Employed',
                                    country: evt.country,
                                    currency: evt.currency,
                                    location: getRsuLocation(evt),
                                    category: 'comp'
                                  });
                                }}
                                onMouseLeave={() => setHoveredItem(null)}
                              >
                                <circle
                                  r={ringRadius}
                                  fill="none"
                                  stroke={strokeColor}
                                  strokeWidth={strokeWidth}
                                  strokeOpacity="0.22"
                                />
                                <circle
                                  r={radius}
                                  fill="none"
                                  stroke={strokeColor}
                                  strokeWidth="1.5"
                                  strokeDasharray={isDashed ? "3,3" : undefined}
                                />
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
              </g>
            ) : (
              <g>
                {/* Cumulative Tax Area & Line */}
                {filters.taxLine && cumulativeTaxAreaD && (
                  <path className="chart-line-tax-cumulative-shadow" d={cumulativeTaxAreaD} />
                )}
                {filters.taxLine && cumulativeTaxPathD && (
                  <path className="chart-line-tax-cumulative" d={cumulativeTaxPathD} />
                )}

                {/* Cumulative Realized Area & Line */}
                {filters.cumulativeLine && cumulativeRealizedAreaD && (
                  <path className="chart-line-cumulative-realized-shadow" d={cumulativeRealizedAreaD} />
                )}
                {filters.cumulativeLine && cumulativeRealizedPathD && (
                  <path className="chart-line-cumulative-realized" d={cumulativeRealizedPathD} />
                )}

                {/* Cumulative Projected Area & Line */}
                {filters.cumulativeLine && cumulativeProjectedAreaD && (
                  <path className="chart-line-cumulative-projected-shadow" d={cumulativeProjectedAreaD} />
                )}
                {filters.cumulativeLine && cumulativeProjectedPathD && (
                  <path className="chart-line-cumulative-projected" d={cumulativeProjectedPathD} />
                )}

                {/* Average Monthly Salary Line */}
                {filters.avgMonthlySalary && avgMonthlyPathD && (
                  <path className="chart-line-avg-monthly" d={avgMonthlyPathD} />
                )}

                {/* Average Annual Salary Line */}
                {filters.avgAnnualSalary && avgAnnualPathD && (
                  <path className="chart-line-avg-annual" d={avgAnnualPathD} />
                )}

                {/* Discrete Compensation events as points */}
                {(() => {
                  const endLimitDate = `${endYear}-${String(endMonth).padStart(2, '0')}-31`;
                  const cumulativeCompEvents = expandedCompEvents.filter(evt => {
                    if (evt.date > endLimitDate) return false;
                    if (evt.status === 'projected') {
                      return true;
                    }
                    return (evt.type === 'bonus' || evt.type === 'vest' || evt.type === 'tax') && filters[evt.type];
                  });
                  return cumulativeCompEvents.map((evt) => {
                    const normDate = normalizeDate(evt.date);
                    const datePrefix = normDate.slice(0, 7); // YYYY-MM
                    const pt = cumulativePoints.find(p => p.dateStr === datePrefix);
                    if (!pt) return null;
                    
                    const x = getX(evt.date);
                    // In cumulative mode, plot the point on the cumulative earnings line
                    const y = getY(pt.totalEarned);
                    
                    let color = 'var(--color-bonus)';
                    if (evt.type === 'vest') color = 'var(--color-vest)';
                    if (evt.type === 'tax') color = 'var(--color-tax)';
                    
                    return (
                      <g
                        key={`cum-comp-evt-${evt.id}`}
                        className="chart-comp-node"
                        style={{ '--node-color': color, opacity: evt.status === 'projected' ? 0.35 : 1 }}
                        transform={`translate(${x}, ${y})`}
                        onMouseEnter={() => {
                          setHoveredItem({
                            x: x,
                            y: y - 15,
                            title: evt.title,
                            value: formatFullCurrency(convertValue(evt.amount, evt.currency, evt.country)),
                            amount: evt.amount,
                            date: formatDateLabel(evt.date),
                            type: evt.type,
                            company: evt.company || 'Self-Employed',
                            country: evt.country,
                            currency: evt.currency,
                            location: getRsuLocation(evt),
                            category: 'comp',
                            taxableIncome: evt.taxableIncome,
                            financialYear: evt.financialYear,
                            assessmentYear: evt.assessmentYear
                          });
                        }}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <circle
                          r="5"
                          fill={color}
                          stroke="#fff"
                          strokeWidth="1.5"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                        />
                      </g>
                    );
                  });
                })()}
              </g>
            )}

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
              <span className={`tooltip-badge ${hoveredItem.type}`} style={{ textTransform: 'capitalize' }}>
                {hoveredItem.type === 'rsu_forfeited' ? 'Forfeited' : (hoveredItem.type === 'jobswitch' ? 'Job Switch' : (hoveredItem.type === 'tax' ? 'Direct Tax Paid' : hoveredItem.type))}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-word', display: 'inline-block', maxWidth: '220px' }}>
                {hoveredItem.title}
              </span>
            </div>
            <div className="tooltip-value">{hoveredItem.value}</div>
            {hoveredItem.type === 'tax' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.1rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {hoveredItem.taxableIncome !== undefined && (
                  <div>Taxable Income: <strong style={{ color: 'var(--text-primary)' }}>{formatFullCurrency(convertValue(hoveredItem.taxableIncome, hoveredItem.currency, hoveredItem.country))}</strong></div>
                )}
                {hoveredItem.taxableIncome > 0 && hoveredItem.amount > 0 && (
                  <div>Effective Tax Rate: <strong style={{ color: 'var(--color-tax)' }}>{((Number(hoveredItem.amount) / Number(hoveredItem.taxableIncome)) * 100).toFixed(1)}%</strong></div>
                )}
                {hoveredItem.financialYear && (
                  <div>Period: <strong style={{ color: 'var(--text-primary)' }}>{hoveredItem.financialYear} ({hoveredItem.assessmentYear})</strong></div>
                )}
              </div>
            )}
            {hoveredItem.category === 'salary' && hoveredItem.convertedGross !== undefined && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.1rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>Monthly Gross: <strong style={{ color: 'var(--text-primary)' }}>{formatFullCurrency(hoveredItem.convertedGross)}</strong></div>
                {hoveredItem.convertedNet !== undefined && (
                  <div>Monthly Net: <strong style={{ color: '#10b981' }}>{formatFullCurrency(hoveredItem.convertedNet)}</strong></div>
                )}
                {hoveredItem.netHikeDiff !== undefined && (
                  <div style={{ marginTop: '0.15rem', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    Monthly Net Hike: <strong style={{ color: '#10b981' }}>{hoveredItem.netHikeDiff >= 0 ? '+' : ''}{formatFullCurrency(hoveredItem.netHikeDiff)}</strong> ({hoveredItem.pctNetDiff >= 0 ? '+' : ''}{hoveredItem.pctNetDiff.toFixed(0)}%)
                  </div>
                )}
              </div>
            )}
            {hoveredItem.company && hoveredItem.type !== 'tax' && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem', marginBottom: '0.1rem' }}>
                Employer: <strong style={{ color: 'var(--color-primary)' }}>{hoveredItem.company}</strong>
              </div>
            )}
            {hoveredItem.country && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.15rem', marginBottom: '0.1rem' }}>
                <span>🏳️</span> <span>{COUNTRIES.find(c => c.code === hoveredItem.country)?.name || hoveredItem.country}</span>
              </div>
            )}
            {hoveredItem.location && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.15rem', marginBottom: '0.1rem' }}>
                <span>📍</span> <span>{hoveredItem.location}</span>
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

      {/* Periodic Earnings Summary Section */}
      {salaryEvents.length > 0 && (
        <CompanyEarningsList
          salaryEvents={salaryEvents}
          compEvents={compEvents}
          startDate={startDate}
          currency={currency}
          formatFullCurrency={formatFullCurrency}
          pppMode={pppMode}
          exchangeRates={exchangeRates}
          pppFactors={pppFactors}
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
          pppMode={pppMode}
          exchangeRates={exchangeRates}
          pppFactors={pppFactors}
          endYear={endYear}
        />
      )}
    </div>
  );
}

// Company Earnings List helper component
function CompanyEarningsList({ 
  salaryEvents, 
  compEvents, 
  startDate, 
  currency, 
  formatFullCurrency,
  pppMode,
  exchangeRates,
  pppFactors 
}) {
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

  const expandedCompEvents = getExpandedCompEvents(compEvents, sortedSalaryEvents, cutoffDate);

  const convertValue = (amount, eventCurrency, countryCode) => {
    if (pppMode) {
      return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
    } else {
      return convertCurrency(amount, eventCurrency, currency, exchangeRates);
    }
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
          const earned = convertValue(currentEvent.salary, currentEvent.currency, currentEvent.country) * durationYears;
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
    expandedCompEvents.forEach(evt => {
      if (evt.type === 'tax') return; // Skip tax events in organization earnings
      if (normalizeDate(evt.date) >= normCutoff) return;

      const companyName = evt.company || 'Self-Employed';
      if (!data[companyName]) {
        data[companyName] = { name: companyName, base: 0, bonus: 0, vest: 0, total: 0, earliestDate: evt.date, latestDate: evt.date };
      }

      const val = convertValue(Number(evt.amount), evt.currency, evt.country);
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
                        title={`Salary Remuneration: ${formatFullCurrency(company.base)} (${basePct.toFixed(0)}%)`}
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
                      <span>Salary Remuneration: <strong>{formatFullCurrency(company.base)}</strong> ({basePct.toFixed(0)}%)</span>
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
function PeriodicEarningsList({ 
  salaryEvents, 
  compEvents, 
  startDate, 
  currency, 
  formatFullCurrency, 
  formatShortCurrency,
  pppMode,
  exchangeRates,
  pppFactors,
  endYear 
}) {
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

  const currentMonth = today.getMonth() + 1;
  const cutoffDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const expandedCompEvents = getExpandedCompEvents(compEvents, sortedSalaryEvents, cutoffDate);

  const maxYear = endYear || currentYear;

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

  const convertValue = (amount, eventCurrency, countryCode) => {
    if (pppMode) {
      return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
    } else {
      return convertCurrency(amount, eventCurrency, currency, exchangeRates);
    }
  };

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
          baseEarned += convertValue(currentEvent.salary, currentEvent.currency, currentEvent.country) * overlap;
        }
      }
    }

    const bonusEarned = expandedCompEvents
      .filter(e => {
        const normDate = normalizeDate(e.date);
        return e.type === 'bonus' && normDate >= p.start && normDate < p.end;
      })
      .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

    const vestEarned = expandedCompEvents
      .filter(e => {
        const normDate = normalizeDate(e.date);
        return e.type === 'vest' && normDate >= p.start && normDate < p.end;
      })
      .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

    const taxPaid = expandedCompEvents
      .filter(e => {
        const normDate = normalizeDate(e.date);
        return e.type === 'tax' && normDate >= p.start && normDate < p.end;
      })
      .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

    const totalEarned = baseEarned + bonusEarned + vestEarned;

    return {
      id: p.id,
      label: p.label,
      start: p.start,
      end: p.end,
      base: baseEarned,
      bonus: bonusEarned,
      vest: vestEarned,
      tax: taxPaid,
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

      // Calculate Net Comp and growth
      const currentNet = current.total - current.tax;
      const prevNet = prev.total - prev.tax;
      if (prevNet > 0) {
        current.netGrowth = ((currentNet - prevNet) / prevNet) * 100;
      } else {
        current.netGrowth = null;
      }

      // Calculate Tax and growth
      if (prev.tax > 0) {
        current.taxGrowth = ((current.tax - prev.tax) / prev.tax) * 100;
      } else {
        current.taxGrowth = null;
      }
    } else {
      current.growth = null;
      current.netGrowth = null;
      current.taxGrowth = null;
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
  const maxTaxVal = Math.max(...activePeriods.map(p => p.tax || 0), 0);
  let taxSteps = 0;
  if (maxTaxVal > 0) {
    taxSteps = Math.ceil(maxTaxVal / cleanStep);
  }
  const minYComp = -taxSteps * cleanStep;

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
    const range = maxYComp - minYComp;
    const ratio = (val - minYComp) / range;
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

              {/* Shared Horizontal grid lines */}
              {showTotalComp ? (
                // Draw based on compensation scale (positive & negative axes)
                Array.from({ length: 4 + taxSteps + 1 }).map((_, idx) => {
                  const compVal = minYComp + idx * cleanStep;
                  const y = getYComp(compVal);
                  return (
                    <g key={`comp_grid_${idx}`}>
                      <line
                        x1={chartPadding.left}
                        y1={y}
                        x2={680 - chartPadding.right}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeDasharray="4 4"
                      />
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
                    </g>
                  );
                })
              ) : (
                // Draw based on growth scale
                showGrowth && Array.from({ length: 5 }).map((_, idx) => {
                  const y = chartPadding.top + chartHeight - (idx * chartHeight) / 4;
                  return (
                    <line
                      key={`growth_grid_${idx}`}
                      x1={chartPadding.left}
                      y1={y}
                      x2={680 - chartPadding.right}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="4 4"
                    />
                  );
                })
              )}

              {/* Right Axis ticks (Growth %) */}
              {showGrowth && Array.from({ length: 5 }).map((_, idx) => {
                const growthVal = minGrowthScale + idx * cleanStepGrowth;
                const y = getGrowthY(growthVal);
                return (
                  <text
                    key={`growth_tick_${idx}`}
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
                );
              })}

              {/* Zero line for compensation chart */}
              {showTotalComp && minYComp < 0 && (
                <line
                  x1={chartPadding.left}
                  y1={getYComp(0)}
                  x2={680 - chartPadding.right}
                  y2={getYComp(0)}
                  stroke="rgba(99, 102, 241, 0.35)"
                  strokeWidth="1.2"
                />
              )}

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
                    {showTotalComp && (p.total > 0 || p.tax > 0) && (
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
                        {/* Tax segment (negative axis) */}
                        {p.tax > 0 && (
                          <rect
                            x={compBarX}
                            y={yZero}
                            width={compBarWidth}
                            height={getYComp(-p.tax) - yZero}
                            fill="rgba(244, 63, 94, 0.25)"
                            stroke="var(--color-tax)"
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
                        Gross Comp: <strong style={{ color: 'var(--text-primary)' }}>{formatFullCurrency(hoveredBar.total)}</strong>
                        {hoveredBar.growth !== null && showGrowth && (
                          <span style={{ fontSize: '0.68rem', color: hoveredBar.growth > 0 ? '#10b981' : '#ef4444', marginLeft: '0.35rem', fontWeight: 600 }}>
                            ({hoveredBar.growth > 0 ? '+' : ''}{hoveredBar.growth.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                      {hoveredBar.tax > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Tax Paid: <strong style={{ color: 'var(--color-tax)' }}>-{formatFullCurrency(hoveredBar.tax)}</strong>
                          {hoveredBar.taxGrowth !== null && showGrowth && (
                            <span style={{ fontSize: '0.68rem', color: hoveredBar.taxGrowth > 0 ? '#ef4444' : '#10b981', marginLeft: '0.35rem', fontWeight: 600 }}>
                              ({hoveredBar.taxGrowth > 0 ? '+' : ''}{hoveredBar.taxGrowth.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      )}
                      {hoveredBar.tax > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Net Realized: <strong style={{ color: 'var(--color-primary)' }}>{formatFullCurrency(hoveredBar.total - hoveredBar.tax)}</strong>
                          {hoveredBar.netGrowth !== null && showGrowth && (
                            <span style={{ fontSize: '0.68rem', color: hoveredBar.netGrowth > 0 ? '#10b981' : '#ef4444', marginLeft: '0.35rem', fontWeight: 600 }}>
                              ({hoveredBar.netGrowth > 0 ? '+' : ''}{hoveredBar.netGrowth.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Breakdown context */}
                  {showTotalComp && (hoveredBar.base > 0 || hoveredBar.bonus > 0 || hoveredBar.vest > 0 || hoveredBar.tax > 0) && (
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
                      {hoveredBar.tax > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-tax)' }}></span>
                            <span>Direct Tax Paid</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatFullCurrency(hoveredBar.tax)}</span>
                        </div>
                      )}
                      {hoveredBar.tax > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderTop: '1px dashed rgba(255, 255, 255, 0.08)', paddingTop: '0.2rem', marginTop: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-primary)' }}></span>
                            <span>Net Realized</span>
                          </div>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{formatFullCurrency(hoveredBar.total - hoveredBar.tax)}</span>
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

            const isTaxPos = p.taxGrowth !== null && p.taxGrowth > 0;
            const taxSign = p.taxGrowth !== null && p.taxGrowth > 0 ? '+' : '';
            const taxGrowthColor = isTaxPos ? '#ef4444' : '#10b981';
            const taxGrowthBg = isTaxPos ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
            const taxGrowthBorder = isTaxPos ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';

            const isNetPos = p.netGrowth !== null && p.netGrowth > 0;
            const netSign = p.netGrowth !== null && p.netGrowth > 0 ? '+' : '';
            const netGrowthColor = isNetPos ? '#10b981' : '#ef4444';
            const netGrowthBg = isNetPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            const netGrowthBorder = isNetPos ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';

            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</span>
                    {growthEl}
                  </div>
                  {showTotalComp && (
                    <div style={{ fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginRight: '0.25rem' }}>Gross:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{formatFullCurrency(p.total)}</span>
                    </div>
                  )}
                </div>

                {showTotalComp && p.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginTop: '-0.1rem', marginBottom: '0.15rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ color: 'var(--color-tax)', fontSize: '0.72rem', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                        Tax Paid: -{formatFullCurrency(p.tax)}
                      </span>
                      {p.taxGrowth !== null && showGrowth && (
                        <span style={{ fontSize: '0.68rem', padding: '0.05rem 0.3rem', borderRadius: '4px', border: `1px solid ${taxGrowthBorder}`, background: taxGrowthBg, color: taxGrowthColor, fontWeight: 600 }}>
                          {taxSign}{p.taxGrowth.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginRight: '0.25rem' }}>Net Realized:</span>
                        <span style={{ color: 'var(--color-primary)' }}>{formatFullCurrency(p.total - p.tax)}</span>
                      </div>
                      {p.netGrowth !== null && showGrowth && (
                        <span style={{ fontSize: '0.68rem', padding: '0.05rem 0.3rem', borderRadius: '4px', border: `1px solid ${netGrowthBorder}`, background: netGrowthBg, color: netGrowthColor, fontWeight: 600 }}>
                          {netSign}{p.netGrowth.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                )}

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
                      {p.tax > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-tax)' }}></span>
                          <span>Direct Tax Paid: <strong style={{ color: 'var(--text-secondary)' }}>{formatFullCurrency(p.tax)}</strong>{p.taxableIncome > 0 && ` (Effective Rate: ${((p.tax / p.taxableIncome) * 100).toFixed(1)}%)`}</span>
                        </div>
                      )}
                      {p.tax > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }}></span>
                          <span>Net Realized: <strong style={{ color: 'var(--color-primary)' }}>{formatFullCurrency(p.total - p.tax)}</strong></span>
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
