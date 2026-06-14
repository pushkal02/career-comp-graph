import { useState } from 'react';
import { PlusCircle, Trash2, Shield, TrendingUp, Calendar, Tag, Briefcase, Edit3, X, Check, MapPin } from 'lucide-react';

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
  const [salaryTitle, setSalaryTitle] = useState('');
  const [salaryWorkType, setSalaryWorkType] = useState('Company'); // Company, Freelance, Self-Employed
  const [salaryCompany, setSalaryCompany] = useState('');
  const [salaryLocation, setSalaryLocation] = useState('');

  // Comp form state
  const [compYear, setCompYear] = useState(() => (startDate || '2024-01').split('-')[0]);
  const [compMonth, setCompMonth] = useState(() => (startDate || '2024-01').split('-')[1]);
  const [compDay, setCompDay] = useState('');
  const [compAmount, setCompAmount] = useState('10000');
  const [compType, setCompType] = useState('bonus'); // bonus, grant, vest
  const [compCurrency, setCompCurrency] = useState(currency || 'USD');
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
  const [editTitle, setEditTitle] = useState('');
  const [editWorkType, setEditWorkType] = useState('Company');
  const [editCompany, setEditCompany] = useState('');
  const [editLocation, setEditLocation] = useState('');

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
  }

  // Sync default currency changes
  const [prevDefaultCurrency, setPrevDefaultCurrency] = useState(currency);
  if (currency !== prevDefaultCurrency) {
    setPrevDefaultCurrency(currency);
    setSalaryCurrency(currency || 'USD');
    setCompCurrency(currency || 'USD');
    if (editingEvent && !editingEvent.currency) {
      setEditCurrency(currency || 'USD');
    }
  }

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
      location: salaryLocation.trim() || undefined
    });

    // Reset inputs
    setSalaryTitle('');
    setSalaryCompany('');
    setSalaryLocation('');
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
      location: compLocation.trim() || undefined
    });

    // Reset inputs
    setCompTitle('');
    setCompCompany('');
    setCompLocation('');
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
    setEditTitle(item.title || '');
    setEditLocation(item.location || '');

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
        location: editLocation.trim() || undefined
      });
    } else {
      onEditCompEvent({
        id: editingEvent.id,
        date: finalDate,
        amount: Number(editVal),
        type: editType,
        currency: editCurrency,
        title: editTitle.trim() || getDefaultCompTitle(editType),
        company: finalCompany,
        location: editLocation.trim() || undefined
      });
    }

    setEditingEvent(null);
    setEditLocation('');
    setActiveTab('manage');
  };

  const cancelEdit = () => {
    setEditingEvent(null);
    setEditLocation('');
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
              <TrendingUp size={14} /> Base Salary
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
          </div>

          {formType === 'salary' ? (
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
                  <option value="hike">Base Salary Hike</option>
                  <option value="promotion">Promotion Hike</option>
                  <option value="jobswitch">Job Switch Increase</option>
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                      {getCurrencySymbol(salaryCurrency).trim()}
                    </span>
                    New Annual Base Salary ({getCurrencySymbol(salaryCurrency).trim()})
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
                  <select value={salaryCurrency} onChange={(e) => setSalaryCurrency(e.target.value)} style={{ height: '37px' }}>
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
                <PlusCircle size={18} /> Update Salary
              </button>
            </form>
          ) : (
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
                  <select value={compCurrency} onChange={(e) => setCompCurrency(e.target.value)} style={{ height: '37px' }}>
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
        </div>
      )}

      {activeTab === 'edit' && editingEvent && (
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit3 size={15} style={{ color: 'var(--color-primary)' }} />
            Edit {editingEvent.eventCategory === 'salary' ? 'Base Salary' : 'Payout / Grant'}
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
                  <option value="hike">Base Salary Hike</option>
                  <option value="promotion">Promotion Hike</option>
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
                </select>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                    {getCurrencySymbol(editCurrency).trim()}
                  </span>
                  {editingEvent.eventCategory === 'salary' ? 'Annual Base Salary' : 'Amount / Value'} ({getCurrencySymbol(editCurrency).trim()})
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
                <select value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} style={{ height: '37px' }}>
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
              const label = isSalary ? item.type : item.type;
              
              // Select class based on type
              let colorClass = 'hike';
              if (item.type === 'promotion') colorClass = 'promotion';
              if (item.type === 'jobswitch') colorClass = 'jobswitch';
              if (item.type === 'bonus') colorClass = 'bonus';
              if (item.type === 'grant') colorClass = 'grant';
              if (item.type === 'vest') colorClass = 'vest';

              const companyTag = item.company || 'Self-Employed';

              return (
                <div key={item.id} className="manager-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-color)', minWidth: 0 }}>
                  <div className="manager-item-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden', flex: 1, marginRight: '0.5rem', minWidth: 0 }}>
                    <div className="manager-item-name" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span className={`tooltip-badge ${colorClass}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', textTransform: 'capitalize', flexShrink: 0 }}>{label}</span>
                      <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, flex: 1, minWidth: 0 }} title={item.title}>
                        {item.title}
                      </span>
                    </div>
                    <div className="manager-item-meta" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${formatDateLabel(item.date)} • ${isSalary ? 'Salary' : 'Amount'}: ${formatCurrency(isSalary ? item.salary : item.amount, item.currency)}${isSalary ? '/yr' : ''} • Employer: ${companyTag}${item.location ? ` • Location: ${item.location}` : ''}`}>
                      {formatDateLabel(item.date)} • <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatCurrency(isSalary ? item.salary : item.amount, item.currency)}</span>
                      {isSalary && ' / yr'} • <strong style={{ color: 'var(--color-primary)' }}>{companyTag}</strong>
                      {item.location && ` • 📍 ${item.location}`}
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
