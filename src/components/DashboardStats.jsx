import { DollarSign, Award, Percent, Layers, ShieldCheck, Receipt } from 'lucide-react';
import { convertCurrency, convertToPPP, getExpandedCompEvents } from '../utils/currency';

export default function DashboardStats({
  salaryEvents,
  compEvents,
  startDate,
  currency,
  pppMode,
  exchangeRates,
  pppFactors
}) {
  const baselineDate = startDate || "2024-01";

  // Format currency dynamically based on selected option and PPP Mode
  const formatCurrency = (val) => {
    if (pppMode) {
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(val);
      return formatted.replace('$', 'PPP $');
    }

    const activeCurrency = currency || 'USD';
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

  // Helper to convert event amount to local display or PPP USD
  const convertValue = (amount, eventCurrency, countryCode) => {
    if (pppMode) {
      return convertToPPP(amount, eventCurrency, countryCode, exchangeRates, pppFactors);
    } else {
      return convertCurrency(amount, eventCurrency, currency, exchangeRates);
    }
  };

  // Calculate chronological difference in years (supporting day precision via UTC month-based difference)
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

  const normalizeDate = (d) => (d && d.length === 7) ? `${d}-01` : d;

  // 1. Calculate current salary (most recent salary event)
  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => {
    const normA = normalizeDate(a.date);
    const normB = normalizeDate(b.date);
    return normA.localeCompare(normB);
  });
  const currentSalary = sortedSalaryEvents.length > 0
    ? convertValue(
      sortedSalaryEvents[sortedSalaryEvents.length - 1].salary,
      sortedSalaryEvents[sortedSalaryEvents.length - 1].currency,
      sortedSalaryEvents[sortedSalaryEvents.length - 1].country
    )
    : 0;

  // Get cutoff date representing the start of the current month (i.e. end of the last completed month)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const cutoffDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const normCutoff = `${cutoffDate}-01`;
  const normBaseline = normalizeDate(baselineDate);



  // 2. Calculate realized cumulative base salary earned over time (up to the last completed month)
  let cumulativeBaseEarned = 0;
  if (sortedSalaryEvents.length > 0 && normBaseline < normCutoff) {
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      const currentEvent = sortedSalaryEvents[i];
      const nextEvent = sortedSalaryEvents[i + 1];

      const normStart = normalizeDate(currentEvent.date);
      const normNext = nextEvent ? normalizeDate(nextEvent.date) : null;

      let segmentStart = normStart;
      if (segmentStart < normBaseline) segmentStart = normBaseline;
      if (segmentStart > normCutoff) segmentStart = normCutoff;

      let segmentEnd = normNext ? normNext : normCutoff;
      if (segmentEnd < normBaseline) segmentEnd = normBaseline;
      if (segmentEnd > normCutoff) segmentEnd = normCutoff;

      const durationYears = getYearDiff(segmentStart, segmentEnd);
      if (durationYears > 0) {
        const segmentSalaryInDisplay = convertValue(currentEvent.salary, currentEvent.currency, currentEvent.country);
        cumulativeBaseEarned += segmentSalaryInDisplay * durationYears;
      }
    }
  }

  // Expand RSU events into visual grants and tranches (realized/projected/forfeited)
  const expandedCompEvents = getExpandedCompEvents(compEvents, sortedSalaryEvents, cutoffDate);

  // 3. Sum of realized compensation
  const totalBonus = expandedCompEvents
    .filter(e => e.type === 'bonus' && e.status === 'realized')
    .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

  const totalGrant = expandedCompEvents
    .filter(e => e.type === 'grant')
    .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

  const totalVest = expandedCompEvents
    .filter(e => e.type === 'vest' && e.status === 'realized')
    .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

  const totalTax = expandedCompEvents
    .filter(e => e.type === 'tax' && e.status === 'realized')
    .reduce((sum, e) => sum + convertValue(Number(e.amount), e.currency, e.country), 0);

  // 4. Realized Cumulative Compensation = Base Salary Earned + Bonus + Vests
  const totalRealizedComp = cumulativeBaseEarned + totalBonus + totalVest;

  const stats = [
    {
      label: "Current Salary",
      value: formatCurrency(currentSalary),
      subtext: pppMode ? "Annual Reference Salary Remuneration (PPP adjusted)" : "Annual Reference Salary Remuneration rate",
      icon: <DollarSign size={20} style={{ color: 'var(--color-base)' }} />,
      className: "base"
    },
    {
      label: "Realized Cash Bonuses",
      value: formatCurrency(totalBonus),
      subtext: "Discrete performance & sign-on payouts",
      icon: <Award size={20} style={{ color: 'var(--color-bonus)' }} />,
      className: "bonus"
    },
    {
      label: "Total Grants",
      value: formatCurrency(totalGrant),
      subtext: "Total value of patent, stock, or other allocations",
      icon: <Layers size={20} style={{ color: 'var(--color-grant)' }} />,
      className: "grant"
    },
    {
      label: "Realized Vested Stocks",
      value: formatCurrency(totalVest),
      subtext: "Realized equity value (vested over time)",
      icon: <ShieldCheck size={20} style={{ color: 'var(--color-vest)' }} />,
      className: "vest"
    },
    {
      label: "Total Direct Tax Paid",
      value: formatCurrency(totalTax),
      subtext: "Cumulative direct income tax paid to date",
      icon: <Receipt size={20} style={{ color: 'var(--color-tax)' }} />,
      className: "tax"
    },
    {
      label: "Realized Career Earnings",
      value: formatCurrency(totalRealizedComp),
      subtext: pppMode
        ? "Cumulative remuneration + bonuses + vested stock (PPP adjusted)"
        : "Cumulative base + bonuses + vested stock (up to last completed day)",
      icon: <Percent size={20} style={{ color: 'var(--color-primary)' }} />,
      className: "total"
    }
  ];

  return (
    <div className="metrics-container animate-fade-in">
      {stats.map((stat, idx) => (
        <div key={idx} className={`metric-card ${stat.className}`}>
          <div className="metric-label">
            {stat.icon}
            <span>{stat.label}</span>
          </div>
          <div className="metric-value">{stat.value}</div>
          <div className="metric-subtext">{stat.subtext}</div>
        </div>
      ))}
    </div>
  );
}

