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
  return crypto.randomUUID();
};

// CSV export helper
export const exportToCSV = (headers: string[], rows: string[][], filename: string) => {
  const BOM = '\uFEFF'; // UTF-8 BOM for Hebrew support in Excel
  const csvContent = BOM + [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Format phone for WhatsApp (Israeli format)
export const formatPhoneForWhatsApp = (phone: string): string => {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+972')) return cleaned;
  if (cleaned.startsWith('972')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+972' + cleaned.substring(1);
  return '+972' + cleaned;
};

export const getMonthName = (monthKey: string) => {
  // YYYYMM
  if (!monthKey || monthKey.length !== 6) return monthKey;
  const year = monthKey.substring(0, 4);
  const month = monthKey.substring(4, 6);
  return `${month}/${year}`;
};
