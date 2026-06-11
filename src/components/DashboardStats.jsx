
import { DollarSign, Award, Percent, Layers, ShieldCheck } from 'lucide-react';
import { convertCurrency } from '../utils/currency';

export default function DashboardStats({ salaryEvents, compEvents, startDate, currency }) {
  const baselineDate = startDate || "2024-01";
  // Format currency
  // Format currency dynamically based on selected option
  const formatCurrency = (val) => {
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

  // Calculate chronological difference in years (supporting day precision)
  const getYearDiff = (date1, date2) => {
    const d1 = new Date(date1.length === 7 ? `${date1}-01` : date1);
    const d2 = new Date(date2.length === 7 ? `${date2}-01` : date2);
    return (d2.getTime() - d1.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  };


  const normalizeDate = (d) => (d && d.length === 7) ? `${d}-01` : d;

  // 1. Calculate current salary (most recent salary event)
  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => {
    const normA = normalizeDate(a.date);
    const normB = normalizeDate(b.date);
    return normA.localeCompare(normB);
  });
  const currentSalary = sortedSalaryEvents.length > 0 
    ? convertCurrency(sortedSalaryEvents[sortedSalaryEvents.length - 1].salary, sortedSalaryEvents[sortedSalaryEvents.length - 1].currency, currency) 
    : 0;

  // Get cutoff date representing the start of the current month (i.e. end of the last completed month)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const cutoffDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const normCutoff = `${cutoffDate}-01`;
  const normBaseline = normalizeDate(baselineDate);

  // 2. Calculate cumulative base salary earned over time (up to the last completed month)
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
        const segmentSalaryInDisplay = convertCurrency(currentEvent.salary, currentEvent.currency, currency);
        cumulativeBaseEarned += segmentSalaryInDisplay * durationYears;
      }
    }
  }

  // 3. Sum of bonus, grant, and vest (realized options filtered up to the last completed month)
  const totalBonus = compEvents
    .filter(e => e.type === 'bonus' && normalizeDate(e.date) < normCutoff)
    .reduce((sum, e) => sum + convertCurrency(Number(e.amount), e.currency, currency), 0);

  const totalGrant = compEvents
    .filter(e => e.type === 'grant')
    .reduce((sum, e) => sum + convertCurrency(Number(e.amount), e.currency, currency), 0);

  const totalVest = compEvents
    .filter(e => e.type === 'vest' && normalizeDate(e.date) < normCutoff)
    .reduce((sum, e) => sum + convertCurrency(Number(e.amount), e.currency, currency), 0);

  // 4. Realized Cumulative Compensation = Base Salary Earned + Bonus + Vests
  const totalRealizedComp = cumulativeBaseEarned + totalBonus + totalVest;

  const stats = [
    {
      label: "Current Base Salary",
      value: formatCurrency(currentSalary),
      subtext: "Annual Reference Salary rate",
      icon: <DollarSign size={20} style={{ color: 'var(--color-base)' }} />,
      className: "base"
    },
    {
      label: "Total Cash Bonuses",
      value: formatCurrency(totalBonus),
      subtext: "Discrete performance & sign-on payouts",
      icon: <Award size={20} style={{ color: 'var(--color-bonus)' }} />,
      className: "bonus"
    },
    {
      label: "Total Stock Grants",
      value: formatCurrency(totalGrant),
      subtext: "Total paper value of equity allocations",
      icon: <Layers size={20} style={{ color: 'var(--color-grant)' }} />,
      className: "grant"
    },
    {
      label: "Total Vested Stocks",
      value: formatCurrency(totalVest),
      subtext: "Realized equity value (vested over time)",
      icon: <ShieldCheck size={20} style={{ color: 'var(--color-vest)' }} />,
      className: "vest"
    },
    {
      label: "Realized Career Earnings",
      value: formatCurrency(totalRealizedComp),
      subtext: "Cumulative base + bonuses + vested stock",
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
