export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('he-IL');
};

export const getMonthKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const getMonthName = (monthKey: string) => {
  // YYYYMM
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const year = monthKey.substring(0, 4);
  const month = monthKey.substring(4, 6);
  return `${month}/${year}`;
};
