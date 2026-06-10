import { useState } from 'react';
import { PlusCircle, Trash2, Shield, TrendingUp, Calendar, Tag, Briefcase } from 'lucide-react';

export default function EventForm({ 
  salaryEvents, 
  compEvents, 
  onAddSalaryEvent, 
  onAddCompEvent, 
  onDeleteSalaryEvent, 
  onDeleteCompEvent,
  startDate,
  currency
}) {
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'manage'
  const [formType, setFormType] = useState('salary'); // 'salary' or 'comp'

  // Salary form state
  const [salaryDate, setSalaryDate] = useState(startDate || '2024-01');
  const [salaryVal, setSalaryVal] = useState('100000');
  const [salaryType, setSalaryType] = useState('hike'); // hike, promotion, jobswitch
  const [salaryTitle, setSalaryTitle] = useState('');

  // Comp form state
  const [compDate, setCompDate] = useState(startDate || '2024-01');
  const [compAmount, setCompAmount] = useState('10000');
  const [compType, setCompType] = useState('bonus'); // bonus, grant, vest
  const [compTitle, setCompTitle] = useState('');

  // Sync date inputs when baseline changes (during render)
  const [prevStartDate, setPrevStartDate] = useState(startDate);
  if (startDate !== prevStartDate) {
    setPrevStartDate(startDate);
    setSalaryDate(startDate || '2024-01');
    setCompDate(startDate || '2024-01');
  }

  const handleSalarySubmit = (e) => {
    e.preventDefault();
    if (!salaryDate || !salaryVal || Number(salaryVal) === 0) return;

    onAddSalaryEvent({
      date: salaryDate,
      salary: Number(salaryVal),
      type: salaryType,
      title: salaryTitle.trim() || getDefaultSalaryTitle(salaryType)
    });

    // Reset inputs
    setSalaryTitle('');
  };

  const handleCompSubmit = (e) => {
    e.preventDefault();
    if (!compDate || !compAmount || Number(compAmount) === 0) return;

    onAddCompEvent({
      date: compDate,
      amount: Number(compAmount),
      type: compType,
      title: compTitle.trim() || getDefaultCompTitle(compType)
    });

    // Reset inputs
    setCompTitle('');
  };

  const getDefaultSalaryTitle = (type) => {
    if (type === 'promotion') return 'Promotion';
    if (type === 'jobswitch') return 'Job Switch';
    return 'Salary Hike';
  };

  const getDefaultCompTitle = (type) => {
    if (type === 'bonus') return 'Cash Bonus';
    if (type === 'grant') return 'Equity Grant';
    return 'Stock Vesting';
  };

  // Combine and sort all events chronologically for the manager view
  const allEventsChronological = [
    ...salaryEvents.map(e => ({ ...e, eventCategory: 'salary' })),
    ...compEvents.map(e => ({ ...e, eventCategory: 'comp' }))
  ].sort((a, b) => b.date.localeCompare(a.date)); // Newest first for list view

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

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(month) - 1]} ${year}`;
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="tab-container">
        <button 
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          Add Event
        </button>
        <button 
          className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          Manage ({allEventsChronological.length})
        </button>
      </div>

      {activeTab === 'add' ? (
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
                padding: '0.4rem'
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
                padding: '0.4rem'
              }}
              onClick={() => setFormType('comp')}
            >
              <Shield size={14} /> Bonus / Stock
            </button>
          </div>

          {formType === 'salary' ? (
            <form onSubmit={handleSalarySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label><Calendar size={12} style={{ marginRight: 4 }} /> Date</label>
                <input 
                  type="month" 
                  min="2000-01" 
                  value={salaryDate}
                  onChange={(e) => setSalaryDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label><Tag size={12} style={{ marginRight: 4 }} /> Event Type</label>
                <select value={salaryType} onChange={(e) => setSalaryType(e.target.value)}>
                  <option value="hike">Base Salary Hike</option>
                  <option value="promotion">Promotion Hike</option>
                  <option value="jobswitch">Job Switch Increase</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                    {getCurrencySymbol(currency || 'USD').trim()}
                  </span>
                  New Annual Base Salary ({getCurrencySymbol(currency || 'USD')})
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={salaryVal}
                  onChange={(e) => setSalaryVal(e.target.value)}
                  required
                />
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

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <PlusCircle size={18} /> Update Salary
              </button>
            </form>
          ) : (
            <form onSubmit={handleCompSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label><Calendar size={12} style={{ marginRight: 4 }} /> Date</label>
                <input 
                  type="month" 
                  min="2000-01" 
                  value={compDate}
                  onChange={(e) => setCompDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label><Tag size={12} style={{ marginRight: 4 }} /> Category</label>
                <select value={compType} onChange={(e) => setCompType(e.target.value)}>
                  <option value="bonus">Cash Bonus</option>
                  <option value="grant">Stock Grant (Initial/Refresh)</option>
                  <option value="vest">Vested Stock (RSUs / Options)</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', color: 'var(--color-primary)', fontSize: '9px', fontWeight: '800', marginRight: '6px', fontFamily: 'var(--font-mono)', verticalAlign: 'middle', lineHeight: 1 }}>
                    {getCurrencySymbol(currency || 'USD').trim()}
                  </span>
                  Event Value / Amount ({getCurrencySymbol(currency || 'USD')})
                </label>
                <input 
                  type="number" 
                  step="any"
                  value={compAmount}
                  onChange={(e) => setCompAmount(e.target.value)}
                  required
                />
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

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                <PlusCircle size={18} /> Record Payout/Grant
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="events-manager-container">
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

              return (
                <div key={item.id} className="manager-item">
                  <div className="manager-item-info">
                    <div className="manager-item-name">
                      <span className={`tooltip-badge ${colorClass}`}>{label}</span>
                      <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                        {item.title}
                      </span>
                    </div>
                    <div className="manager-item-meta">
                      {formatDateLabel(item.date)} • {formatCurrency(isSalary ? item.salary : item.amount)}
                      {isSalary && ' / yr'}
                    </div>
                  </div>
                  <button 
                    onClick={() => isSalary ? onDeleteSalaryEvent(item.id) : onDeleteCompEvent(item.id)}
                    className="btn-danger"
                    style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
