import prisma from '../prismaClient.js';

export const getEvents = async (req, res) => {
  try {
    const salaryEvents = await prisma.salaryEvent.findMany({
      where: { userId: req.userId }
    });

    const compEvents = await prisma.compEvent.findMany({
      where: { userId: req.userId }
    });

    return res.json({ salaryEvents, compEvents });
  } catch (err) {
    console.error('Get events error:', err);
    return res.status(500).json({ error: 'Internal server error fetching events.' });
  }
};

export const syncEvents = async (req, res) => {
  try {
    const { salaryEvents = [], compEvents = [] } = req.body;

    // Build lists with mapping to active userId
    const mappedSalaries = salaryEvents.map(e => ({
      id: e.id,
      userId: req.userId,
      date: e.date,
      salary: parseFloat(e.salary),
      type: e.type,
      title: e.title || '',
      company: e.company || '',
      currency: e.currency || null,
      country: e.country || null,
      location: e.location || null,
      monthlyNetSalary: e.monthlyNetSalary !== undefined && e.monthlyNetSalary !== null ? parseFloat(e.monthlyNetSalary) : null
    }));

    const mappedComps = compEvents.map(e => ({
      id: e.id,
      userId: req.userId,
      date: e.date,
      amount: parseFloat(e.amount),
      type: e.type,
      title: e.title || '',
      company: e.company || '',
      currency: e.currency || null,
      country: e.country || null,
      location: e.location || null
    }));

    // Run delete and insert in a single database transaction
    await prisma.$transaction([
      prisma.salaryEvent.deleteMany({ where: { userId: req.userId } }),
      prisma.compEvent.deleteMany({ where: { userId: req.userId } }),
      prisma.salaryEvent.createMany({ data: mappedSalaries }),
      prisma.compEvent.createMany({ data: mappedComps })
    ]);

    return res.json({ success: true, message: 'Timeline synced successfully.' });
  } catch (err) {
    console.error('Sync events error:', err);
    return res.status(500).json({ error: 'Internal server error syncing events.' });
  }
};

export const createSalaryEvent = async (req, res) => {
  try {
    const { id, date, salary, type, title, company, currency, country, location, monthlyNetSalary } = req.body;

    if (!id || !date || salary === undefined || !type) {
      return res.status(400).json({ error: 'ID, date, salary, and type are required.' });
    }

    const event = await prisma.salaryEvent.create({
      data: {
        id,
        userId: req.userId,
        date,
        salary: parseFloat(salary),
        type,
        title: title || '',
        company: company || '',
        currency: currency || null,
        country: country || null,
        location: location || null,
        monthlyNetSalary: monthlyNetSalary !== undefined && monthlyNetSalary !== null ? parseFloat(monthlyNetSalary) : null
      }
    });

    return res.status(201).json(event);
  } catch (err) {
    console.error('Create salary event error:', err);
    return res.status(500).json({ error: 'Internal server error saving salary milestone.' });
  }
};

export const updateSalaryEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, salary, type, title, company, currency, country, location, monthlyNetSalary } = req.body;

    const event = await prisma.salaryEvent.update({
      where: { id, userId: req.userId },
      data: {
        date: date || undefined,
        salary: salary !== undefined ? parseFloat(salary) : undefined,
        type: type || undefined,
        title: title || undefined,
        company: company || undefined,
        currency: currency !== undefined ? currency : undefined,
        country: country !== undefined ? country : undefined,
        location: location !== undefined ? location : undefined,
        monthlyNetSalary: monthlyNetSalary !== undefined ? (monthlyNetSalary !== null ? parseFloat(monthlyNetSalary) : null) : undefined
      }
    });

    return res.json(event);
  } catch (err) {
    console.error('Update salary event error:', err);
    return res.status(500).json({ error: 'Internal server error updating salary milestone.' });
  }
};

export const deleteSalaryEvent = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.salaryEvent.delete({
      where: { id, userId: req.userId }
    });

    return res.json({ success: true, message: 'Salary event deleted.' });
  } catch (err) {
    console.error('Delete salary event error:', err);
    return res.status(500).json({ error: 'Internal server error deleting salary milestone.' });
  }
};

export const createCompEvent = async (req, res) => {
  try {
    const { id, date, amount, type, title, company, currency, country, location } = req.body;

    if (!id || !date || amount === undefined || !type) {
      return res.status(400).json({ error: 'ID, date, amount, and type are required.' });
    }

    const event = await prisma.compEvent.create({
      data: {
        id,
        userId: req.userId,
        date,
        amount: parseFloat(amount),
        type,
        title: title || '',
        company: company || '',
        currency: currency || null,
        country: country || null,
        location: location || null
      }
    });

    return res.status(201).json(event);
  } catch (err) {
    console.error('Create comp event error:', err);
    return res.status(500).json({ error: 'Internal server error saving compensation event.' });
  }
};

export const updateCompEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, amount, type, title, company, currency, country, location } = req.body;

    const event = await prisma.compEvent.update({
      where: { id, userId: req.userId },
      data: {
        date: date || undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        type: type || undefined,
        title: title || undefined,
        company: company || undefined,
        currency: currency !== undefined ? currency : undefined,
        country: country !== undefined ? country : undefined,
        location: location !== undefined ? location : undefined
      }
    });

    return res.json(event);
  } catch (err) {
    console.error('Update comp event error:', err);
    return res.status(500).json({ error: 'Internal server error updating compensation event.' });
  }
};

export const deleteCompEvent = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.compEvent.delete({
      where: { id, userId: req.userId }
    });

    return res.json({ success: true, message: 'Compensation event deleted.' });
  } catch (err) {
    console.error('Delete comp event error:', err);
    return res.status(500).json({ error: 'Internal server error deleting compensation event.' });
  }
};
