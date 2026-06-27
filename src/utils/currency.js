export const EXCHANGE_RATES = {
  USD: 1.0,
  INR: 83.0,
  GBP: 0.79,
  EUR: 0.92,
  JPY: 155.0,
  CAD: 1.37,
  AUD: 1.51,
  SGD: 1.35
};

export const DEFAULT_PPP_FACTORS = {
  US: 1.0,
  IN: 19.517,
  GB: 0.6736,
  DE: 0.7024,
  JP: 99.191,
  CA: 1.227,
  AU: 1.396,
  SG: 1.048
};

export const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', defaultCurrency: 'USD' },
  { code: 'IN', name: 'India', flag: '🇮🇳', defaultCurrency: 'INR' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', defaultCurrency: 'GBP' },
  { code: 'DE', name: 'Germany (Eurozone)', flag: '🇩🇪', defaultCurrency: 'EUR' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', defaultCurrency: 'JPY' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', defaultCurrency: 'CAD' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', defaultCurrency: 'AUD' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', defaultCurrency: 'SGD' }
];

export function getCountryByCurrency(currencyCode) {
  const found = COUNTRIES.find(c => c.defaultCurrency === currencyCode);
  return found ? found.code : 'US';
}

/**
 * Converts a monetary amount from one currency to another using dynamic or fallback exchange rates.
 * @param {number} amount - The amount to convert.
 * @param {string} from - The source currency code (e.g. 'USD').
 * @param {string} to - The target currency code (e.g. 'INR').
 * @param {object} [rates] - Optional dynamic exchange rates object.
 * @returns {number} The converted amount.
 */
export function convertCurrency(amount, from = 'USD', to = 'USD', rates = EXCHANGE_RATES) {
  const f = from || 'USD';
  const t = to || 'USD';
  if (f === t) return amount;
  
  const currentRates = { ...EXCHANGE_RATES, ...rates };
  const usdAmount = amount / (currentRates[f] || EXCHANGE_RATES[f] || 1.0);
  return usdAmount * (currentRates[t] || EXCHANGE_RATES[t] || 1.0);
}

/**
 * Converts a monetary amount to USD (PPP) based on the country, event currency, exchange rates, and PPP factors.
 * @param {number} amount - The amount to convert.
 * @param {string} eventCurrency - The event currency code (e.g. 'USD').
 * @param {string} countryCode - The 2-letter country code (e.g. 'IN').
 * @param {object} [rates] - Optional dynamic exchange rates object.
 * @param {object} [pppFactors] - Optional dynamic PPP factors object.
 * @returns {number} The converted PPP USD amount.
 */
export function convertToPPP(amount, eventCurrency, countryCode, rates = EXCHANGE_RATES, pppFactors = DEFAULT_PPP_FACTORS) {
  const cCode = countryCode || getCountryByCurrency(eventCurrency);
  const country = COUNTRIES.find(c => c.code === cCode);
  const localCurrency = country ? country.defaultCurrency : (eventCurrency || 'USD');

  // Convert to country's local currency first
  const localAmount = convertCurrency(amount, eventCurrency, localCurrency, rates);

  // Divide local currency amount by local PPP factor to get international dollars (USD PPP)
  const currentPPPFactors = { ...DEFAULT_PPP_FACTORS, ...pppFactors };
  const pppFactor = currentPPPFactors[cCode] || DEFAULT_PPP_FACTORS[cCode] || 1.0;
  return localAmount / pppFactor;
}

/**
 * Parses vesting tranches from an RSU event.
 */
export function parseRsuTranches(event) {
  if (!event || event.type !== 'rsu') return [];
  try {
    if (event.location && typeof event.location === 'string' && (event.location.startsWith('{') || event.location.startsWith('['))) {
      const parsed = JSON.parse(event.location);
      if (parsed && Array.isArray(parsed.tranches)) {
        return parsed.tranches;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse RSU tranches', err);
  }
  return [];
}

/**
 * Returns the active company at a given date based on salary event history.
 */
export function getActiveCompanyAt(date, salaryEvents, defaultValue = '') {
  const defVal = defaultValue || '';
  if (!salaryEvents || salaryEvents.length === 0) return defVal;
  
  const sorted = [...salaryEvents].sort((a, b) => {
    const normA = (a.date && a.date.length === 7) ? `${a.date}-01` : (a.date || '');
    const normB = (b.date && b.date.length === 7) ? `${b.date}-01` : (b.date || '');
    return normA.localeCompare(normB);
  });
  
  const targetDateNorm = (date && date.length === 7) ? `${date}-01` : (date || '');
  
  let activeCompany = defVal;
  let hasSet = false;
  for (let i = 0; i < sorted.length; i++) {
    const eventDateNorm = (sorted[i].date && sorted[i].date.length === 7) ? `${sorted[i].date}-01` : (sorted[i].date || '');
    if (eventDateNorm <= targetDateNorm) {
      activeCompany = sorted[i].company || '';
      hasSet = true;
    }
  }
  return hasSet ? activeCompany : (sorted[0]?.company || defVal);
}

/**
 * Expands RSU grants into visual grant events and tranche vesting events.
 */
export function getExpandedCompEvents(compEvents, salaryEvents, cutoffDate = '') {
  if (!compEvents) return [];
  const list = [];
  compEvents.forEach(evt => {
    if (evt.type === 'rsu') {
      const evtCompany = evt.company || 'Self-Employed';
      
      // 2. Add each tranche as a virtual 'vest' style event at the tranche date
      const tranches = parseRsuTranches(evt);
      tranches.forEach(tranche => {
        const activeCompany = getActiveCompanyAt(tranche.date, salaryEvents, evtCompany);
        const isLegacyOrBlank = !evt.company || evt.company.trim() === '' || evt.company.trim().toLowerCase() === 'self-employed' || evt.company.trim().toLowerCase() === 'freelance';
        const isMatching = isLegacyOrBlank || (activeCompany || '').trim().toLowerCase() === (evtCompany || '').trim().toLowerCase();
        const isFuture = cutoffDate ? (tranche.date >= cutoffDate) : false;
        
        let type = 'vest';
        let title = `${evt.title || 'RSU'} (Vest)`;
        let status = 'realized';
        
        if (!isMatching) {
          status = 'forfeited';
          type = 'rsu_forfeited';
          title = `${evt.title || 'RSU'} (Forfeited - Left ${evtCompany})`;
        } else if (isFuture) {
          status = 'projected';
          title = `${evt.title || 'RSU'} (Projected Vest)`;
        }
        
        list.push({
          ...evt,
          id: `rsu-tranche-${evt.id}-${tranche.id}`,
          date: tranche.date,
          amount: tranche.amount,
          type,
          title,
          status,
          isRsuTranche: true,
          rsuParentId: evt.id
        });
      });
    } else {
      const isFuture = cutoffDate ? (evt.date && evt.date >= cutoffDate) : false;
      list.push({
        ...evt,
        status: isFuture ? 'projected' : 'realized'
      });
    }
  });
  return list;
}

/**
 * Safely parses the text location from an RSU event's serialized location field.
 */
export function getRsuLocation(event) {
  if (!event) return '';
  try {
    if (event.location && typeof event.location === 'string' && (event.location.startsWith('{') || event.location.startsWith('['))) {
      const parsed = JSON.parse(event.location);
      if (parsed && typeof parsed === 'object' && 'location' in parsed) {
        return parsed.location || '';
      }
    }
  } catch (err) {
    // ignore
  }
  return event.location || '';
}

