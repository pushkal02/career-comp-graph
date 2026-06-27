import { useState } from 'react';
import { PlusCircle, Trash2, Shield, TrendingUp, Calendar, Tag, Briefcase, Edit3, X, Check, MapPin } from 'lucide-react';
import { COUNTRIES, getCountryByCurrency, parseRsuTranches, getRsuLocation } from '../utils/currency';

const generateTranches = (templateType, totalAmt, startYearVal, startMonthVal) => {
  const amount = parseFloat(totalAmt) || 0;
  const tranches = [];
  let numVests = 0;
  let intervalMonths = 3;
  
  if (templateType === '4y_q') {
    numVests = 16;
    intervalMonths = 3;
  } else if (templateType === '3y_q') {
    numVests = 12;
    intervalMonths = 3;
  } else if (templateType === '1y_q') {
    numVests = 4;
    intervalMonths = 3;
  } else if (templateType === '4y_m') {
    numVests = 48;
    intervalMonths = 1;
  } else if (templateType === '1y_y') {
    numVests = 1;
    intervalMonths = 12;
  } else {
    return [];
  }
  
  const baseAmount = Math.floor((amount / numVests) * 100) / 100;
  const remainder = Math.round((amount - baseAmount * numVests) * 100) / 100;
  
  let currentY = parseInt(startYearVal);
  let currentM = parseInt(startMonthVal);
  
  for (let i = 0; i < numVests; i++) {
    currentM += intervalMonths;
    while (currentM > 12) {
      currentM -= 12;
      currentY += 1;
    }
    
    const trancheAmt = (i === numVests - 1) ? (baseAmount + remainder) : baseAmount;
    
    tranches.push({
      id: `t_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      date: `${currentY}-${String(currentM).padStart(2, '0')}`,
      amount: trancheAmt
    });
  }
  return tranches;
};

export default function EventForm({ 
  salaryEvents, 
  compEvents, 
  onAddSalaryEvent, 
  onAddCompEvent, 
  onEditSalaryEvent,
  onEditCompEvent,
  onDeleteSalaryEvent,
  onDeleteCompEvent,
  startDate,
  currency
}) {
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'manage', or 'edit'
  const [formType, setFormType] = useState('salary'); // 'salary' or 'comp'

  const startYearNum = Number((startDate || '2024-01').split('-')[0]);
  const yearsOptions = [];
  for (let y = startYearNum - 5; y <= startYearNum + 15; y++) {
    yearsOptions.push(y.toString());
  }

  const monthsOptions = [
    { value: '01', label: 'Jan' },
    { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' },
    { value: '04', label: 'Apr' },
    { value: '05', label: 'May' },
    { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' },
    { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' },
    { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' },
    { value: '12', label: 'Dec' }
  ];

  const daysOptions = [];
  for (let d = 1; d <= 31; d++) {
    daysOptions.push(String(d).padStart(2, '0'));
  }

  const getCombinedDate = (y, m, d) => {
    return d ? `${y}-${m}-${d}` : `${y}-${m}`;
  };

  const parseCombinedDate = (dateStr) => {
    if (!dateStr) return { year: '', month: '', day: '' };
    const parts = dateStr.split('-');
    return {
      year: parts[0] || '',
      month: parts[1] || '',
      day: parts[2] || ''
    };
  };

  // Salary form state
  const [salaryYear, setSalaryYear] = useState(() => (startDate || '2024-01').split('-')[0]);
  const [salaryMonth, setSalaryMonth] = useState(() => (startDate || '2024-01').split('-')[1]);
  const [salaryDay, setSalaryDay] = useState('');
  const [salaryVal, setSalaryVal] = useState('100000');
  const [salaryType, setSalaryType] = useState('hike'); // hike, promotion, jobswitch
  const [salaryCurrency, setSalaryCurrency] = useState(currency || 'USD');
  const [salaryCountry, setSalaryCountry] = useState(() => getCountryByCurrency(currency || 'USD'));
  const [salaryTitle, setSalaryTitle] = useState('');
  const [salaryWorkType, setSalaryWorkType] = useState('Company'); // Company, Freelance, Self-Employed
  const [salaryCompany, setSalaryCompany] = useState('');
  const [salaryLocation, setSalaryLocation] = useState('');
  const [salaryNetVal, setSalaryNetVal] = useState('');

  // Comp form state
  const [compYear, setCompYear] = useState(() => (startDate || '2024-01').split('-')[0]);
  const [compMonth, setCompMonth] = useState(() => (startDate || '2024-01').split('-')[1]);
  const [compDay, setCompDay] = useState('');
  const [compAmount, setCompAmount] = useState('10000');
  const [compType, setCompType] = useState('bonus'); // bonus, grant, vest
  const [compCurrency, setCompCurrency] = useState(currency || 'USD');
  const [compCountry, setCompCountry] = useState(() => getCountryByCurrency(currency || 'USD'));
  const [compTitle, setCompTitle] = useState('');
  const [compWorkType, setCompWorkType] = useState('Company'); // Company, Freelance, Self-Employed
  const [compCompany, setCompCompany] = useState('');
  const [compLocation, setCompLocation] = useState('');

  // Editing state
  const [editingEvent, setEditingEvent] = useState(null); // stores { ...event, eventCategory: 'salary'|'comp' }
  const [editYear, setEditYear] = useState('');
  const [editMonth, setEditMonth] = useState('');
  const [editDay, setEditDay] = useState('');
  const [editVal, setEditVal] = useState('');
  const [editType, setEditType] = useState('');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editCountry, setEditCountry] = useState('US');
  const [editTitle, setEditTitle] = useState('');
  const [editWorkType, setEditWorkType] = useState('Company');
  const [editCompany, setEditCompany] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editNetVal, setEditNetVal] = useState('');

  // RSU form state
  const [rsuYear, setRsuYear] = useState(() => (startDate || '2024-01').split('-')[0]);
  const [rsuMonth, setRsuMonth] = useState(() => (startDate || '2024-01').split('-')[1]);
  const [rsuDay, setRsuDay] = useState('');
  const [rsuAmount, setRsuAmount] = useState('100000');
  const [rsuCurrency, setRsuCurrency] = useState(currency || 'USD');
  const [rsuCountry, setRsuCountry] = useState(() => getCountryByCurrency(currency || 'USD'));
  const [rsuTitle, setRsuTitle] = useState('');
  const [rsuWorkType, setRsuWorkType] = useState('Company');
  const [rsuCompany, setRsuCompany] = useState('');
  const [rsuLocation, setRsuLocation] = useState('');
  const [rsuTranches, setRsuTranches] = useState([]);
  const [editTranches, setEditTranches] = useState([]);

  // Sync date inputs when baseline changes (during render)
  const [prevStartDate, setPrevStartDate] = useState(startDate);
  if (startDate !== prevStartDate) {
    setPrevStartDate(startDate);
    const [y, m] = (startDate || '2024-01').split('-');
    setSalaryYear(y);
    setSalaryMonth(m);
    setSalaryDay('');
    setCompYear(y);
    setCompMonth(m);
    setCompDay('');
    setRsuYear(y);
    setRsuMonth(m);
  }

  // Sync default currency changes
  const [prevDefaultCurrency, setPrevDefaultCurrency] = useState(currency);
  if (currency !== prevDefaultCurrency) {
    setPrevDefaultCurrency(currency);
    setSalaryCurrency(currency || 'USD');
    setSalaryCountry(getCountryByCurrency(currency || 'USD'));
    setCompCurrency(currency || 'USD');
    setCompCountry(getCountryByCurrency(currency || 'USD'));
    setRsuCurrency(currency || 'USD');
    setRsuCountry(getCountryByCurrency(currency || 'USD'));
    if (editingEvent && !editingEvent.currency) {
      setEditCurrency(currency || 'USD');
      setEditCountry(getCountryByCurrency(currency || 'USD'));
    }
  }

  const handleSalaryCurrencyChange = (curr) => {
    setSalaryCurrency(curr);
  };

  const handleCompCurrencyChange = (curr) => {
    setCompCurrency(curr);
  };

  const handleRsuCurrencyChange = (curr) => {
    setRsuCurrency(curr);
  };

  const handleEditCurrencyChange = (curr) => {
    setEditCurrency(curr);
  };

  const handleSalarySubmit = (e) => {
    e.preventDefault();
    if (!salaryYear || !salaryMonth || !salaryVal || Number(salaryVal) === 0) return;

    onAddSalaryEvent({
      date: getCombinedDate(salaryYear, salaryMonth, salaryDay),
      salary: Number(salaryVal),
      type: salaryType,
      currency: salaryCurrency,
      title: salaryTitle.trim() || getDefaultSalaryTitle(salaryType),
      company: salaryWorkType === 'Company' ? salaryCompany.trim() || 'Self-Employed' : salaryWorkType,
      location: salaryLocation.trim() || undefined,
      country: salaryCountry,
      monthlyNetSalary: salaryNetVal ? Number(salaryNetVal) : undefined
    });

    // Reset inputs
    setSalaryTitle('');
    setSalaryCompany('');
    setSalaryLocation('');
    setSalaryNetVal('');
  };

  const handleCompSubmit = (e) => {
    e.preventDefault();
    if (!compYear || !compMonth || !compAmount || Number(compAmount) === 0) return;

    onAddCompEvent({
      date: getCombinedDate(compYear, compMonth, compDay),
      amount: Number(compAmount),
      type: compType,
      currency: compCurrency,
      title: compTitle.trim() || getDefaultCompTitle(compType),
      company: compWorkType === 'Company' ? compCompany.trim() || 'Self-Employed' : compWorkType,
      location: compLocation.trim() || undefined,
      country: compCountry
    });

    // Reset inputs
    setCompTitle('');
    setCompCompany('');
    setCompLocation('');
  };

  const handleRsuSubmit = (e) => {
    e.preventDefault();
    if (!rsuYear || !rsuMonth || !rsuAmount || Number(rsuAmount) === 0) return;

    const trancheSum = rsuTranches.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    if (Math.abs(trancheSum - Number(rsuAmount)) > 0.01) {
      alert(`Vesting tranches total (${trancheSum}) does not match the total grant amount (${rsuAmount}). Please align them.`);
      return;
    }

    const serializedLocation = JSON.stringify({
      location: rsuLocation.trim(),
      tranches: rsuTranches.map(t => ({
        id: t.id || `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        date: t.date,
        amount: Number(t.amount)
      }))
    });

    onAddCompEvent({
      date: getCombinedDate(rsuYear, rsuMonth, rsuDay),
      amount: Number(rsuAmount),
      type: 'rsu',
      currency: rsuCurrency,
      title: rsuTitle.trim() || 'RSU Stock Grant',
      company: rsuWorkType === 'Company' ? rsuCompany.trim() || 'Self-Employed' : rsuWorkType,
      location: serializedLocation,
      country: rsuCountry
    });

    // Reset inputs
    setRsuTitle('');
    setRsuCompany('');
    setRsuLocation('');
    setRsuTranches([]);
    setRsuDay('');
  };

  const startEdit = (item) => {
    setEditingEvent(item);
    const parsed = parseCombinedDate(item.date);
    setEditYear(parsed.year);
    setEditMonth(parsed.month);
    setEditDay(parsed.day);
    
    const valStr = item.eventCategory === 'salary' ? item.salary.toString() : item.amount.toString();
    setEditVal(valStr);
    setEditType(item.type);
    setEditCurrency(item.currency || currency || 'USD');
    setEditCountry(item.country || getCountryByCurrency(item.currency || currency || 'USD'));
    setEditTitle(item.title || '');
    setEditLocation(item.type === 'rsu' ? getRsuLocation(item) : (item.location || ''));
    setEditNetVal(item.monthlyNetSalary ? item.monthlyNetSalary.toString() : '');
    
    if (item.type === 'rsu') {
      setEditTranches(parseRsuTranches(item));
    } else {
      setEditTranches([]);
    }

    const itemCompany = item.company || 'Self-Employed';
    if (['Freelance', 'Self-Employed'].includes(itemCompany)) {
      setEditWorkType(itemCompany);
      setEditCompany('');
    } else {
      setEditWorkType('Company');
      setEditCompany(itemCompany);
    }
    setActiveTab('edit');
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editYear || !editMonth || !editVal || Number(editVal) === 0) return;

    const isSalary = editingEvent.eventCategory === 'salary';
    const finalCompany = editWorkType === 'Company' ? editCompany.trim() || 'Self-Employed' : editWorkType;
    const finalDate = getCombinedDate(editYear, editMonth, editDay);

    if (isSalary) {
      onEditSalaryEvent({
        id: editingEvent.id,
        date: finalDate,
        salary: Number(editVal),
        type: editType,
        currency: editCurrency,
        title: editTitle.trim() || getDefaultSalaryTitle(editType),
        company: finalCompany,
        location: editLocation.trim() || undefined,
        country: editCountry,
        monthlyNetSalary: editNetVal ? Number(editNetVal) : undefined
      });
    } else {
      let finalLocation = editLocation.trim() || undefined;
      if (editType === 'rsu') {
        const trancheSum = editTranches.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        if (Math.abs(trancheSum - Number(editVal)) > 0.01) {
          alert(`Vesting tranches total (${trancheSum}) does not match the total grant amount (${editVal}). Please align them.`);
          return;
        }
        finalLocation = JSON.stringify({
          location: editLocation.trim(),
          tranches: editTranches.map(t => ({
            id: t.id || `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            date: t.date,
            amount: Number(t.amount)
          }))
        });
      }

      onEditCompEvent({
        id: editingEvent.id,
        date: finalDate,
        amount: Number(editVal),
        type: editType,
        currency: editCurrency,
        title: editTitle.trim() || getDefaultCompTitle(editType),
        company: finalCompany,
        location: finalLocation,
        country: editCountry
      });
    }

    setEditingEvent(null);
    setEditLocation('');
    setEditNetVal('');
    setEditTranches([]);
    setActiveTab('manage');
  };

  const cancelEdit = () => {
    setEditingEvent(null);
    setEditLocation('');
    setEditNetVal('');
    setActiveTab('manage');
  };

  const getDefaultSalaryTitle = (type) => {
    if (type === 'promotion') return 'Promotion';
    if (type === 'jobswitch') return 'Job Switch';
    return 'Salary Hike';
  };

  const getDefaultCompTitle = (type) => {
    if (type === 'bonus') return 'Cash Bonus';
    if (type === 'grant') return 'Grant';
    return 'Stock Vesting';
  };

  // Combine and sort all events chronologically for the manager view
  const allEventsChronological = [
    ...salaryEvents.map(e => ({ ...e, eventCategory: 'salary' })),
    ...compEvents.map(e => ({ ...e, eventCategory: 'comp' }))
  ].sort((a, b) => {
    const normA = a.date.length === 7 ? `${a.date}-01` : a.date;
    const normB = b.date.length === 7 ? `${b.date}-01` : b.date;
    return normB.localeCompare(normA); // Newest first for list view
  });

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

  const formatCurrency = (val, eventCurrency) => {
    const activeCurrency = eventCurrency || currency || 'USD';
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

  return (
    <div className="glass-panel animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="tab-container">
        <button 
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('add');
            setEditingEvent(null);
          }}
        >
          Add Event
        </button>
        <button 
          className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('manage');
            setEditingEvent(null);
          }}
        >
          Manage ({allEventsChronological.length})
        </button>
        {activeTab === 'edit' && editingEvent && (
          <button 
            className="tab-btn active"
            style={{ borderBottomColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
          >
            Edit Event
          </button>
        )}
      </div>

      {activeTab === 'add' && (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Sub tab for form selection */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '8px' }}>
            <button
              className="btn"
              style={{
                background: formType === 'salary' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: formType === 'salary' ? '1px solid var(--color-primary)' : '1px solid transparent',
                color: formType === 'salary' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                padding: '0.4rem',
                flex: 1
              }}
              onClick={() => setFormType('salary')}
            >
              <TrendingUp size={14} /> Salary Remuneration
            </button>
            <button
              className="btn"
              style={{
                background: formType === 'comp' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: formType === 'comp' ? '1px solid var(--color-primary)' : '1px solid transparent',
                color: formType === 'comp' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                padding: '0.4rem',
                flex: 1
              }}
              onClick={() => setFormType('comp')}
            >
              <Shield size={14} /> Bonus / Stock
            </button>
            <button
              className="btn"
              style={{
                background: formType === 'rsu' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: formType === 'rsu' ? '1px solid var(--color-primary)' : '1px solid transparent',
                color: formType === 'rsu' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                padding: '0.4rem',
                flex: 1
              }}
              onClick={() => setFormType('rsu')}
            >
              <Shield size={14} /> RSU Grant
            </button>
          </div>

          {formType === 'salary' && (
            <form onSubmit={handleSalarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label><Calendar size={12} style={{ marginRight: 4 }} /> Date (Year / Month / Optional Day)</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <select 
                    value={salaryYear} 
                    onChange={(e) => setSalaryYear(e.target.value)}
                    style={{ flex: 2 }}
                  >
                    {yearsOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select 
                    value={salaryMonth} 
                    onChange={(e) => setSalaryMonth(e.target.value)}
                    style={{ flex: 2 }}
                  >
                    {monthsOptions.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select 
                    value={salaryDay} 
                    onChange={(e) => setSalaryDay(e.target.value)}
                    style={{ flex: 1.5 }}
                  >
                    <option value="">No Day</option>
                    {daysOptions.map(d => (
                      <option key={d} value={d}>{Number(d)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label><Tag size={12} style={{ marginRight: 4 }} /> Event Type</label>
                <select value={salaryType} onChange={(e) => setSalaryType(e.target.value)}>
                  <option value="hike">Salary Remuneration Hike</option>
                  <option value="promotion">Promotion Remuneration Hike</option>
                  <option value="jobswitch">Job Switch Increase</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                      {getCurrencySymbol(salaryCurrency).trim()}
                    </span>
                    New Annual Salary Remuneration ({getCurrencySymbol(salaryCurrency).trim()})
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    value={salaryVal}
                    onChange={(e) => setSalaryVal(e.target.value)}
                    required
                  />
                </div>
                <div style={{ width: '95px' }}>
                  <label>Currency</label>
                  <select value={salaryCurrency} onChange={(e) => handleSalaryCurrencyChange(e.target.value)} style={{ height: '37px' }}>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CAD">CAD (CA$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="SGD">SGD (SG$)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Monthly Gross ({getCurrencySymbol(salaryCurrency).trim()}) (Read-Only)</label>
                  <input 
                    type="text"
                    value={salaryVal && !isNaN(salaryVal) ? (Number(salaryVal) / 12).toFixed(2) : '0.00'}
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', cursor: 'not-allowed', borderStyle: 'dashed' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Monthly Net ({getCurrencySymbol(salaryCurrency).trim()}) (Optional)</label>
                  <input 
                    type="number"
                    step="any"
                    placeholder="Take-home after PF & tax"
                    value={salaryNetVal}
                    onChange={(e) => setSalaryNetVal(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Country (For PPP conversion)</label>
                <select 
                  value={salaryCountry} 
                  onChange={(e) => {
                    const selectedCountry = e.target.value;
                    setSalaryCountry(selectedCountry);
                    const found = COUNTRIES.find(c => c.code === selectedCountry);
                    if (found) {
                      setSalaryCurrency(found.defaultCurrency);
                    }
                  }}
                  required
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label><Briefcase size={12} style={{ marginRight: 4 }} /> Company / Work Context</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  {['Company', 'Freelance', 'Self-Employed'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.78rem',
                        background: salaryWorkType === type ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        border: salaryWorkType === type ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                        color: salaryWorkType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                      onClick={() => {
                        setSalaryWorkType(type);
                        if (type !== 'Company') setSalaryCompany(type);
                        else setSalaryCompany('');
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {salaryWorkType === 'Company' && (
                  <input
                    type="text"
                    placeholder="Enter Company Name (e.g. Google)"
                    value={salaryCompany}
                    onChange={(e) => setSalaryCompany(e.target.value)}
                    required={salaryWorkType === 'Company'}
                  />
                )}
              </div>

              <div className="form-group">
                <label><Briefcase size={12} style={{ marginRight: 4 }} /> Description (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Lead Dev Promotion or Standard Merit Hike"
                  value={salaryTitle}
                  onChange={(e) => setSalaryTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label><MapPin size={12} style={{ marginRight: 4 }} /> Location (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Bangalore, India, Remote"
                  value={salaryLocation}
                  onChange={(e) => setSalaryLocation(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <PlusCircle size={18} /> Update Salary Remuneration
              </button>
            </form>
          )}

          {formType === 'comp' && (
            <form onSubmit={handleCompSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label><Calendar size={12} style={{ marginRight: 4 }} /> Date (Year / Month / Optional Day)</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <select 
                    value={compYear} 
                    onChange={(e) => setCompYear(e.target.value)}
                    style={{ flex: 2 }}
                  >
                    {yearsOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select 
                    value={compMonth} 
                    onChange={(e) => setCompMonth(e.target.value)}
                    style={{ flex: 2 }}
                  >
                    {monthsOptions.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select 
                    value={compDay} 
                    onChange={(e) => setCompDay(e.target.value)}
                    style={{ flex: 1.5 }}
                  >
                    <option value="">No Day</option>
                    {daysOptions.map(d => (
                      <option key={d} value={d}>{Number(d)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label><Tag size={12} style={{ marginRight: 4 }} /> Category</label>
                <select value={compType} onChange={(e) => setCompType(e.target.value)}>
                  <option value="bonus">Cash Bonus</option>
                  <option value="grant">Grant (Patent, Stock, etc.)</option>
                  <option value="vest">Vested Stock (RSUs / Options)</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                      {getCurrencySymbol(compCurrency).trim()}
                    </span>
                    Event Value / Amount ({getCurrencySymbol(compCurrency).trim()})
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    value={compAmount}
                    onChange={(e) => setCompAmount(e.target.value)}
                    required
                  />
                </div>
                <div style={{ width: '95px' }}>
                  <label>Currency</label>
                  <select value={compCurrency} onChange={(e) => handleCompCurrencyChange(e.target.value)} style={{ height: '37px' }}>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CAD">CAD (CA$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="SGD">SGD (SG$)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Country (For PPP conversion)</label>
                <select 
                  value={compCountry} 
                  onChange={(e) => {
                    const selectedCountry = e.target.value;
                    setCompCountry(selectedCountry);
                    const found = COUNTRIES.find(c => c.code === selectedCountry);
                    if (found) {
                      setCompCurrency(found.defaultCurrency);
                    }
                  }}
                  required
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label><Briefcase size={12} style={{ marginRight: 4 }} /> Company / Work Context</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  {['Company', 'Freelance', 'Self-Employed'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.78rem',
                        background: compWorkType === type ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        border: compWorkType === type ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                        color: compWorkType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                      onClick={() => {
                        setCompWorkType(type);
                        if (type !== 'Company') setCompCompany(type);
                        else setCompCompany('');
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {compWorkType === 'Company' && (
                  <input
                    type="text"
                    placeholder="Enter Company Name (e.g. Google)"
                    value={compCompany}
                    onChange={(e) => setCompCompany(e.target.value)}
                    required={compWorkType === 'Company'}
                  />
                )}
              </div>

              <div className="form-group">
                <label><Briefcase size={12} style={{ marginRight: 4 }} /> Description (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Sign-on Bonus, Annual RSUs, etc."
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label><MapPin size={12} style={{ marginRight: 4 }} /> Location (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. London, UK, Remote"
                  value={compLocation}
                  onChange={(e) => setCompLocation(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <PlusCircle size={18} /> Record Payout/Grant
              </button>
            </form>
          )}

          {formType === 'rsu' && (
            <form onSubmit={handleRsuSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label><Calendar size={12} style={{ marginRight: 4 }} /> Grant Date (Year / Month / Optional Day)</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <select 
                    value={rsuYear} 
                    onChange={(e) => setRsuYear(e.target.value)}
                    style={{ flex: 2 }}
                  >
                    {yearsOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select 
                    value={rsuMonth} 
                    onChange={(e) => setRsuMonth(e.target.value)}
                    style={{ flex: 2 }}
                  >
                    {monthsOptions.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select 
                    value={rsuDay} 
                    onChange={(e) => setRsuDay(e.target.value)}
                    style={{ flex: 1.5 }}
                  >
                    <option value="">No Day</option>
                    {daysOptions.map(d => (
                      <option key={d} value={d}>{Number(d)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Total Grant Value ({getCurrencySymbol(rsuCurrency).trim()})</label>
                  <input 
                    type="number" 
                    step="any"
                    value={rsuAmount}
                    onChange={(e) => setRsuAmount(e.target.value)}
                    required
                  />
                </div>
                <div style={{ width: '95px' }}>
                  <label>Currency</label>
                  <select value={rsuCurrency} onChange={(e) => handleRsuCurrencyChange(e.target.value)} style={{ height: '37px' }}>
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CAD">CAD (CA$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="SGD">SGD (SG$)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Country (For PPP conversion)</label>
                <select 
                  value={rsuCountry} 
                  onChange={(e) => {
                    const selectedCountry = e.target.value;
                    setRsuCountry(selectedCountry);
                    const found = COUNTRIES.find(c => c.code === selectedCountry);
                    if (found) {
                      setRsuCurrency(found.defaultCurrency);
                    }
                  }}
                  required
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label><Briefcase size={12} style={{ marginRight: 4 }} /> Company / Work Context</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  {['Company', 'Freelance', 'Self-Employed'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="btn"
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.78rem',
                        background: rsuWorkType === type ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        border: rsuWorkType === type ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                        color: rsuWorkType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                      onClick={() => {
                        setRsuWorkType(type);
                        if (type !== 'Company') setRsuCompany(type);
                        else setRsuCompany('');
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {rsuWorkType === 'Company' && (
                  <input
                    type="text"
                    placeholder="Enter Company Name (e.g. Google)"
                    value={rsuCompany}
                    onChange={(e) => setRsuCompany(e.target.value)}
                    required={rsuWorkType === 'Company'}
                  />
                )}
              </div>

              <div className="form-group">
                <label><Briefcase size={12} style={{ marginRight: 4 }} /> Grant Title / Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Google Initial L4 RSU Grant"
                  value={rsuTitle}
                  onChange={(e) => setRsuTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label><MapPin size={12} style={{ marginRight: 4 }} /> Location (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Mountain View, CA"
                  value={rsuLocation}
                  onChange={(e) => setRsuLocation(e.target.value)}
                />
              </div>

              {/* Tranche vesting scheduler */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                  <span>Vesting Schedule / Tranches</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Total: {formatCurrency(rsuAmount, rsuCurrency)}
                  </span>
                </h4>
                
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>Auto-Generate Schedule</label>
                  <select 
                    defaultValue="" 
                    onChange={(e) => {
                      if (e.target.value) {
                        const generated = generateTranches(e.target.value, rsuAmount, rsuYear, rsuMonth);
                        setRsuTranches(generated);
                        e.target.value = '';
                      }
                    }}
                    style={{ fontSize: '0.8rem', height: '32px' }}
                  >
                    <option value="">-- Choose a template to auto-populate --</option>
                    <option value="1y_y">1 Year - 1 Annual Vest</option>
                    <option value="1y_q">1 Year - 4 Quarterly Vests</option>
                    <option value="3y_q">3 Years - 12 Quarterly Vests</option>
                    <option value="4y_q">4 Years - 16 Quarterly Vests</option>
                    <option value="4y_m">4 Years - 48 Monthly Vests</option>
                  </select>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '4px' }}>
                  {rsuTranches.map((t, idx) => (
                    <div key={t.id || idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', width: '45px', color: 'var(--text-secondary)' }}>#{idx + 1}</span>
                      <input 
                        type="month" 
                        value={t.date} 
                        onChange={(e) => {
                          const updated = [...rsuTranches];
                          updated[idx].date = e.target.value;
                          setRsuTranches(updated);
                        }}
                        style={{ flex: 2, padding: '0.25rem', height: '30px', fontSize: '0.8rem' }}
                        required
                      />
                      <input 
                        type="number" 
                        value={t.amount} 
                        placeholder="Amount"
                        onChange={(e) => {
                          const updated = [...rsuTranches];
                          updated[idx].amount = e.target.value;
                          setRsuTranches(updated);
                        }}
                        style={{ flex: 1.5, padding: '0.25rem', height: '30px', fontSize: '0.8rem' }}
                        required
                      />
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={() => setRsuTranches(rsuTranches.filter((_, i) => i !== idx))}
                        style={{ padding: '0.25rem', height: '30px', width: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={12} style={{ color: 'var(--color-hike)' }} />
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setRsuTranches([...rsuTranches, { id: `t_${Date.now()}_${Math.random()}`, date: `${rsuYear}-${rsuMonth}`, amount: '' }])}
                  style={{ alignSelf: 'flex-start', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  + Add Tranche Row
                </button>

                {(() => {
                  const trancheSum = rsuTranches.reduce((sum, t) => sum + Number(t.amount || 0), 0);
                  const remaining = Number(rsuAmount) - trancheSum;
                  const isPerfect = Math.abs(remaining) <= 0.01;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', background: isPerfect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: isPerfect ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                      <span style={{ color: isPerfect ? '#10b981' : '#f87171' }}>
                        Allocated: {formatCurrency(trancheSum, rsuCurrency)}
                      </span>
                      <span style={{ color: isPerfect ? '#10b981' : '#f87171', fontWeight: 600 }}>
                        {isPerfect ? '✓ Fully Allocated' : `Remaining: ${formatCurrency(remaining, rsuCurrency)}`}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <PlusCircle size={18} /> Record RSU Grant
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'edit' && editingEvent && (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 size={15} style={{ color: 'var(--color-primary)' }} />
            Edit {editingEvent.eventCategory === 'salary' ? 'Salary Remuneration' : 'Payout / Grant'}
          </h3>

          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label><Calendar size={12} style={{ marginRight: 4 }} /> Date (Year / Month / Optional Day)</label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <select 
                  value={editYear} 
                  onChange={(e) => setEditYear(e.target.value)}
                  style={{ flex: 2 }}
                >
                  {yearsOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select 
                  value={editMonth} 
                  onChange={(e) => setEditMonth(e.target.value)}
                  style={{ flex: 2 }}
                >
                  {monthsOptions.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select 
                  value={editDay} 
                  onChange={(e) => setEditDay(e.target.value)}
                  style={{ flex: 1.5 }}
                >
                  <option value="">No Day</option>
                  {daysOptions.map(d => (
                    <option key={d} value={d}>{Number(d)}</option>
                  ))}
                </select>
              </div>
            </div>

            {editingEvent.eventCategory === 'salary' ? (
              <div className="form-group">
                <label><Tag size={12} style={{ marginRight: 4 }} /> Event Type</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="hike">Salary Remuneration Hike</option>
                  <option value="promotion">Promotion Remuneration Hike</option>
                  <option value="jobswitch">Job Switch Increase</option>
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label><Tag size={12} style={{ marginRight: 4 }} /> Category</label>
                <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="bonus">Cash Bonus</option>
                  <option value="grant">Grant (Patent, Stock, etc.)</option>
                  <option value="vest">Vested Stock (RSUs / Options)</option>
                  <option value="rsu">RSU Stock Grant</option>
                </select>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                    {getCurrencySymbol(editCurrency).trim()}
                  </span>
                  {editingEvent.eventCategory === 'salary' ? 'Annual Salary Remuneration' : 'Amount / Value'} ({getCurrencySymbol(editCurrency).trim()})
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  required
                />
              </div>
              <div style={{ width: '95px' }}>
                <label>Currency</label>
                <select value={editCurrency} onChange={(e) => handleEditCurrencyChange(e.target.value)} style={{ height: '37px' }}>
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="CAD">CAD (CA$)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="SGD">SGD (SG$)</option>
                </select>
              </div>
            </div>

            {editingEvent.eventCategory === 'salary' && (
              <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label>Monthly Gross ({getCurrencySymbol(editCurrency).trim()}) (Read-Only)</label>
                  <input 
                    type="text"
                    value={editVal && !isNaN(editVal) ? (Number(editVal) / 12).toFixed(2) : '0.00'}
                    readOnly
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', cursor: 'not-allowed', borderStyle: 'dashed' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label>Monthly Net ({getCurrencySymbol(editCurrency).trim()}) (Optional)</label>
                  <input 
                    type="number"
                    step="any"
                    placeholder="Take-home after PF & tax"
                    value={editNetVal}
                    onChange={(e) => setEditNetVal(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Country (For PPP conversion)</label>
              <select 
                value={editCountry} 
                onChange={(e) => {
                  const selectedCountry = e.target.value;
                  setEditCountry(selectedCountry);
                  const found = COUNTRIES.find(c => c.code === selectedCountry);
                  if (found) {
                    setEditCurrency(found.defaultCurrency);
                  }
                }}
                required
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label><Briefcase size={12} style={{ marginRight: 4 }} /> Company / Work Context</label>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.25rem' }}>
                {['Company', 'Freelance', 'Self-Employed'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="btn"
                    style={{
                      flex: 1,
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.78rem',
                      background: editWorkType === type ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      border: editWorkType === type ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                      color: editWorkType === type ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                    onClick={() => {
                      setEditWorkType(type);
                      if (type !== 'Company') setEditCompany(type);
                      else setEditCompany('');
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
              {editWorkType === 'Company' && (
                <input
                  type="text"
                  placeholder="Enter Company Name (e.g. Google)"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  required={editWorkType === 'Company'}
                />
              )}
            </div>

            <div className="form-group">
              <label><Briefcase size={12} style={{ marginRight: 4 }} /> Description (Optional)</label>
              <input 
                type="text" 
                placeholder="Description"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label><MapPin size={12} style={{ marginRight: 4 }} /> Location (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Remote, city, etc."
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
            </div>

            {editType === 'rsu' && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
                  <span>Vesting Schedule / Tranches</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Total: {formatCurrency(editVal, editCurrency)}
                  </span>
                </h4>
                
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>Auto-Generate Schedule</label>
                  <select 
                    defaultValue="" 
                    onChange={(e) => {
                      if (e.target.value) {
                        const generated = generateTranches(e.target.value, editVal, editYear, editMonth);
                        setEditTranches(generated);
                        e.target.value = '';
                      }
                    }}
                    style={{ fontSize: '0.8rem', height: '32px' }}
                  >
                    <option value="">-- Choose a template to auto-populate --</option>
                    <option value="1y_y">1 Year - 1 Annual Vest</option>
                    <option value="1y_q">1 Year - 4 Quarterly Vests</option>
                    <option value="3y_q">3 Years - 12 Quarterly Vests</option>
                    <option value="4y_q">4 Years - 16 Quarterly Vests</option>
                    <option value="4y_m">4 Years - 48 Monthly Vests</option>
                  </select>
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '4px' }}>
                  {editTranches.map((t, idx) => (
                    <div key={t.id || idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', width: '45px', color: 'var(--text-secondary)' }}>#{idx + 1}</span>
                      <input 
                        type="month" 
                        value={t.date} 
                        onChange={(e) => {
                          const updated = [...editTranches];
                          updated[idx].date = e.target.value;
                          setEditTranches(updated);
                        }}
                        style={{ flex: 2, padding: '0.25rem', height: '30px', fontSize: '0.8rem' }}
                        required
                      />
                      <input 
                        type="number" 
                        value={t.amount} 
                        placeholder="Amount"
                        onChange={(e) => {
                          const updated = [...editTranches];
                          updated[idx].amount = e.target.value;
                          setEditTranches(updated);
                        }}
                        style={{ flex: 1.5, padding: '0.25rem', height: '30px', fontSize: '0.8rem' }}
                        required
                      />
                      <button 
                        type="button" 
                        className="btn" 
                        onClick={() => setEditTranches(editTranches.filter((_, i) => i !== idx))}
                        style={{ padding: '0.25rem', height: '30px', width: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={12} style={{ color: 'var(--color-hike)' }} />
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  className="btn" 
                  onClick={() => setEditTranches([...editTranches, { id: `t_${Date.now()}_${Math.random()}`, date: `${editYear}-${editMonth}`, amount: '' }])}
                  style={{ alignSelf: 'flex-start', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                >
                  + Add Tranche Row
                </button>

                {(() => {
                  const trancheSum = editTranches.reduce((sum, t) => sum + Number(t.amount || 0), 0);
                  const remaining = Number(editVal) - trancheSum;
                  const isPerfect = Math.abs(remaining) <= 0.01;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', background: isPerfect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: isPerfect ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)', padding: '0.4rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                      <span style={{ color: isPerfect ? '#10b981' : '#f87171' }}>
                        Allocated: {formatCurrency(trancheSum, editCurrency)}
                      </span>
                      <span style={{ color: isPerfect ? '#10b981' : '#f87171', fontWeight: 600 }}>
                        {isPerfect ? '✓ Fully Allocated' : `Remaining: ${formatCurrency(remaining, editCurrency)}`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                <Check size={16} /> Save Changes
              </button>
              <button type="button" onClick={cancelEdit} className="btn btn-secondary" style={{ flex: 1 }}>
                <X size={16} /> Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="events-manager-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
          {allEventsChronological.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">📭</span>
              <p>No events listed yet.</p>
            </div>
          ) : (
            allEventsChronological.map((item) => {
              const isSalary = item.eventCategory === 'salary';
              const label = isSalary ? item.type : (item.type === 'rsu' ? 'RSU Grant' : item.type);
              
              // Select class based on type
              let colorClass = 'hike';
              if (item.type === 'promotion') colorClass = 'promotion';
              if (item.type === 'jobswitch') colorClass = 'jobswitch';
              if (item.type === 'bonus') colorClass = 'bonus';
              if (item.type === 'grant') colorClass = 'grant';
              if (item.type === 'vest') colorClass = 'vest';
              if (item.type === 'rsu') colorClass = 'vest'; // Reuse vest purple or define class

              const companyTag = item.company || 'Self-Employed';
              const itemLoc = item.type === 'rsu' ? getRsuLocation(item) : item.location;

              return (
                <div key={item.id} className="manager-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', minWidth: 0 }}>
                  <div className="manager-item-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden', flex: 1, marginRight: '0.5rem', minWidth: 0 }}>
                    <div className="manager-item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span className={`tooltip-badge ${colorClass}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', textTransform: 'capitalize', flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, flex: 1, minWidth: 0 }} title={item.title}>
                        {item.title}
                      </span>
                    </div>
                    <div className="manager-item-meta" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${formatDateLabel(item.date)} • ${isSalary ? 'Salary Remuneration' : 'Amount'}: ${formatCurrency(isSalary ? item.salary : item.amount, item.currency)}${isSalary ? '/yr' : ''}${isSalary ? ` (Gross: ${formatCurrency(item.salary / 12, item.currency)}/mo${item.monthlyNetSalary ? `, Net: ${formatCurrency(item.monthlyNetSalary, item.currency)}/mo` : ''})` : ''} • Employer: ${companyTag}${item.country ? ` • Country: ${item.country}` : ''}${itemLoc ? ` • Location: ${itemLoc}` : ''}`}>
                      {formatDateLabel(item.date)} • <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCurrency(isSalary ? item.salary : item.amount, item.currency)}</span>
                      {isSalary && ' / yr'} • <strong style={{ color: 'var(--color-primary)' }}>{companyTag}</strong>
                      {isSalary && ` (Gross: ${formatCurrency(item.salary / 12, item.currency)}/mo${item.monthlyNetSalary ? `, Net: ${formatCurrency(item.monthlyNetSalary, item.currency)}/mo` : ''})`}
                      {item.country && ` • ${COUNTRIES.find(c => c.code === item.country)?.flag || ''} ${item.country}`}
                      {itemLoc && ` • 📍 ${itemLoc}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button 
                      onClick={() => startEdit(item)}
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.45rem', display: 'flex', alignItems: 'center', minWidth: 'auto', background: 'rgba(255,255,255,0.03)' }}
                      title="Edit this event"
                      type="button"
                    >
                      <Edit3 size={12} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <button 
                      onClick={() => isSalary ? onDeleteSalaryEvent(item.id) : onDeleteCompEvent(item.id)}
                      className="btn-danger"
                      style={{ padding: '0.25rem 0.45rem', display: 'flex', alignItems: 'center', minWidth: 'auto' }}
                      title="Delete this event"
                      type="button"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
