
import { DollarSign, Award, Percent, Layers, ShieldCheck } from 'lucide-react';

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

  // Helper to parse date string YYYY-MM into numeric year/month
  const parseDate = (dateStr) => {
    const [year, month] = dateStr.split('-').map(Number);
    return { year, month: month - 1 }; // month 0-indexed
  };

  // Calculate chronological difference in years
  const getYearDiff = (date1, date2) => {
    const d1 = parseDate(date1);
    const d2 = parseDate(date2);
    const months1 = d1.year * 12 + d1.month;
    const months2 = d2.year * 12 + d2.month;
    return (months2 - months1) / 12;
  };

  // 1. Calculate current salary (most recent salary event)
  const sortedSalaryEvents = [...salaryEvents].sort((a, b) => a.date.localeCompare(b.date));
  const currentSalary = sortedSalaryEvents.length > 0 
    ? sortedSalaryEvents[sortedSalaryEvents.length - 1].salary 
    : 0;

  // 2. Calculate cumulative base salary earned over time
  let cumulativeBaseEarned = 0;
  if (sortedSalaryEvents.length > 0) {
    // We assume the timeline goes from the first event (or baseline date) to the latest event (both salary and comp events)
    const allDates = [...salaryEvents, ...compEvents].map(e => e.date);
    allDates.push(baselineDate);
    allDates.sort();
    
    const minDate = baselineDate;
    const maxDate = allDates[allDates.length - 1];

    // Integrate area under step function
    for (let i = 0; i < sortedSalaryEvents.length; i++) {
      const currentEvent = sortedSalaryEvents[i];
      const nextEvent = sortedSalaryEvents[i + 1];
      
      const startDate = currentEvent.date < minDate ? minDate : currentEvent.date;
      const endDate = nextEvent ? nextEvent.date : maxDate;
      
      const durationYears = getYearDiff(startDate, endDate);
      if (durationYears > 0) {
        cumulativeBaseEarned += currentEvent.salary * durationYears;
      }
    }
  }

  // 3. Sum of bonus, grant, and vest
  const totalBonus = compEvents
    .filter(e => e.type === 'bonus')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalGrant = compEvents
    .filter(e => e.type === 'grant')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalVest = compEvents
    .filter(e => e.type === 'vest')
    .reduce((sum, e) => sum + Number(e.amount), 0);

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
      subtext: `Cumulative base + bonuses + vested stock (since ${baselineDate.split('-')[0]})`,
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
