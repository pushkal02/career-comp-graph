/**
 * Client-side RFC 4180-compliant CSV parser.
 * Handles nested quotes, escaped double quotes, and multi-line fields.
 */
export const parseCSVText = (text) => {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false; // End of quoted text
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        row.push(currentField.trim());
        currentField = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
      } else {
        currentField += char;
      }
    }
  }

  // Push remaining elements
  if (currentField !== '' || row.length > 0) {
    row.push(currentField.trim());
    lines.push(row);
  }

  return lines;
};

/**
 * Parses a CSV file and extracts formatted SalaryEvent[] and CompEvent[].
 * @param {File} file
 * @returns {Promise<{salaryEvents: any[], compEvents: any[]}>}
 */
export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSVText(text);

        if (rows.length < 2) {
          throw new Error('CSV file is empty or does not contain data.');
        }

        const headers = rows[0];
        
        // Find indices using flexible, case-insensitive keyword searches
        const dateIdx = headers.findIndex(h => h.toLowerCase().includes('date'));
        const categoryIdx = headers.findIndex(h => h.toLowerCase().includes('category'));
        const typeIdx = headers.findIndex(h => h.toLowerCase().includes('type'));
        const amountIdx = headers.findIndex(h => h.toLowerCase().includes('amount') || h.toLowerCase().includes('salary') || h.toLowerCase().includes('value'));
        const currencyIdx = headers.findIndex(h => h.toLowerCase().includes('currency'));
        const netIdx = headers.findIndex(h => h.toLowerCase().includes('net'));
        const companyIdx = headers.findIndex(h => h.toLowerCase().includes('employer') || h.toLowerCase().includes('company'));
        const countryIdx = headers.findIndex(h => h.toLowerCase().includes('country'));
        const locationIdx = headers.findIndex(h => h.toLowerCase().includes('location'));
        const titleIdx = headers.findIndex(h => h.toLowerCase().includes('title'));

        if (dateIdx === -1 || typeIdx === -1 || amountIdx === -1) {
          throw new Error('Required headers (Date, Type, Amount/Salary) are missing.');
        }

        const salaryEvents = [];
        const compEvents = [];

        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 2) continue; // Skip empty rows

          const date = row[dateIdx] || '';
          const categoryRaw = categoryIdx !== -1 ? (row[categoryIdx] || '').toLowerCase() : '';
          const type = (row[typeIdx] || '').toLowerCase();
          const amount = parseFloat(row[amountIdx]) || 0;
          const currency = currencyIdx !== -1 ? (row[currencyIdx] || 'USD').toUpperCase() : 'USD';
          const net = netIdx !== -1 && row[netIdx] !== '' ? parseFloat(row[netIdx]) : null;
          const company = companyIdx !== -1 ? row[companyIdx] || 'Self-Employed' : 'Self-Employed';
          const country = countryIdx !== -1 ? row[countryIdx] || '' : '';
          const location = locationIdx !== -1 ? row[locationIdx] || '' : '';
          const title = titleIdx !== -1 ? row[titleIdx] || '' : '';

          // Validate date format YYYY-MM or YYYY-MM-DD
          const datePattern = /^\d{4}-\d{2}(-\d{2})?$/;
          if (!datePattern.test(date)) {
            continue; // Skip invalid dates
          }

          const isSalary = 
            categoryRaw.includes('salary') || 
            ['hike', 'promotion', 'jobswitch'].includes(type);

          if (isSalary) {
            salaryEvents.push({
              id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              date: date.substr(0, 7), // Truncate to YYYY-MM
              salary: amount,
              type: ['hike', 'promotion', 'jobswitch'].includes(type) ? type : 'hike',
              title: title || 'Milestone Entry',
              company,
              currency,
              country: country || undefined,
              location: location || undefined,
              monthlyNetSalary: net !== null ? net : undefined
            });
          } else {
            compEvents.push({
              id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              date: date.substr(0, 7), // Truncate to YYYY-MM
              amount,
              type: ['bonus', 'grant', 'vest'].includes(type) ? type : 'bonus',
              title: title || 'Payout Entry',
              company,
              currency,
              country: country || undefined,
              location: location || undefined
            });
          }
        }

        resolve({ salaryEvents, compEvents });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read CSV file.'));
    reader.readAsText(file);
  });
};
