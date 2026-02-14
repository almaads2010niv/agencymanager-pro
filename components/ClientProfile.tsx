import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import type { ClientFile } from '../contexts/DataContext';
import { formatCurrency, formatDate, getMonthName, formatPhoneForWhatsApp } from '../utils';
import { ArrowRight, Phone, Mail, Calendar, Star, Upload, FileText, Trash2, ExternalLink, MessageCircle } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const ClientProfile: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients, oneTimeDeals, expenses, payments, services, retainerHistory, uploadClientFile, listClientFiles, deleteClientFile } = useData();
  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files when clientId changes
  useEffect(() => {
    if (clientId) {
      listClientFiles(clientId).then(setClientFiles);
    }
  }, [clientId, listClientFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !clientId) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await uploadClientFile(clientId, file);
      }
      // Refresh file list
      const files = await listClientFiles(clientId);
      setClientFiles(files);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!clientId) return;
    await deleteClientFile(clientId, fileName);
    const files = await listClientFiles(clientId);
    setClientFiles(files);
    setConfirmDeleteFile(null);
  };

  const client = clients.find(c => c.clientId === clientId);

  if (!client) {
    return (
      <div className="space-y-6">
        <Button onClick={() => navigate('/clients')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה ללקוחות</Button>
        <Card>
          <p className="text-gray-400 text-center py-12">לקוח לא נמצא</p>
        </Card>
      </div>
    );
  }

  const clientDeals = oneTimeDeals.filter(d => d.clientId === clientId);
  const clientExpenses = expenses.filter(e => e.clientId === clientId);
  const clientPayments = payments.filter(p => p.clientId === clientId);
  const clientRetainerHistory = retainerHistory.filter(rc => rc.clientId === clientId);

  const monthlyProfit = client.monthlyRetainer - client.supplierCostMonthly;
  const totalDealValue = clientDeals.reduce((sum, d) => sum + d.dealAmount, 0);
  const totalExpenses = clientExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = clientPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalOwed = clientPayments.reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);

  const activeServiceKeys = client.services || [];
  const activeServiceLabels = services
    .filter(s => activeServiceKeys.includes(s.serviceKey))
    .map(s => s.label);

  const getStatusBadge = (status: string) => {
    if (status === 'פעיל') return 'success';
    if (status === 'בתהליך עזיבה') return 'danger';
    if (status === 'מושהה') return 'warning';
    return 'neutral';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/clients')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה</Button>
        <div className="flex-1">
          <h2 className="text-3xl font-black text-white tracking-tight">{client.businessName}</h2>
          <p className="text-gray-400 mt-1">{client.clientName}</p>
        </div>
        <Badge variant={getStatusBadge(client.status)} className="text-sm py-1.5 px-3">{client.status}</Badge>
        <Badge variant={client.rating === 'A_plus' ? 'primary' : 'neutral'} className="text-sm py-1.5 px-3">{client.rating}</Badge>
      </div>

      {/* Contact + Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader title="פרטי קשר" />
          <div className="space-y-4 mt-4">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-primary" />
                <a href={`tel:${client.phone}`} className="text-primary hover:underline">{client.phone}</a>
                <a href={`https://wa.me/${formatPhoneForWhatsApp(client.phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all" title="WhatsApp">
                  <MessageCircle size={14} />
                </a>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-gray-400" />
                <span className="text-gray-300">{client.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-gray-300">הצטרף: {formatDate(client.joinDate)}</span>
            </div>
            {client.industry && (
              <div className="flex items-center gap-3">
                <Star size={16} className="text-gray-400" />
                <span className="text-gray-300">תעשייה: {client.industry}</span>
              </div>
            )}
            {client.notes && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">הערות</p>
                <p className="text-gray-300 text-sm">{client.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Financial Summary */}
        <Card className="lg:col-span-2">
          <CardHeader title="סיכום פיננסי" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">ריטיינר חודשי</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{formatCurrency(client.monthlyRetainer)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">עלות ספקים</div>
              <div className="text-xl font-bold text-red-400 font-mono mt-1">{formatCurrency(client.supplierCostMonthly)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">רווח חודשי</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{formatCurrency(monthlyProfit)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">חוב פתוח</div>
              <div className={`text-xl font-bold font-mono mt-1 ${totalOwed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(totalOwed)}</div>
            </div>
          </div>

          {/* Services */}
          {activeServiceLabels.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">שירותים פעילים</p>
              <div className="flex flex-wrap gap-2">
                {activeServiceLabels.map(label => (
                  <Badge key={label} variant="primary">{label}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Deals History */}
      {clientDeals.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="פרויקטים" subtitle={`${clientDeals.length} פרויקטים | סה"כ ${formatCurrency(totalDealValue)}`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>שם</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>סטטוס</TableHead>
            </TableHeader>
            <TableBody>
              {clientDeals.map(deal => (
                <TableRow key={deal.dealId}>
                  <TableCell className="font-medium text-white">{deal.dealName}</TableCell>
                  <TableCell className="text-gray-400">{deal.dealType}</TableCell>
                  <TableCell className="text-white font-mono">{formatCurrency(deal.dealAmount)}</TableCell>
                  <TableCell className="text-gray-400">{formatDate(deal.dealDate)}</TableCell>
                  <TableCell><Badge variant="neutral">{deal.dealStatus}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Expenses History */}
      {clientExpenses.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="הוצאות" subtitle={`${clientExpenses.length} הוצאות | סה"כ ${formatCurrency(totalExpenses)}`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>תאריך</TableHead>
              <TableHead>ספק</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סכום</TableHead>
            </TableHeader>
            <TableBody>
              {clientExpenses.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(exp => (
                <TableRow key={exp.expenseId}>
                  <TableCell className="text-gray-400">{formatDate(exp.expenseDate)}</TableCell>
                  <TableCell className="font-medium text-white">{exp.supplierName}</TableCell>
                  <TableCell className="text-gray-400">{exp.expenseType}</TableCell>
                  <TableCell className="text-red-400 font-mono font-bold">{formatCurrency(exp.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Payment History */}
      {clientPayments.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="היסטוריית תשלומים" subtitle={`שולם: ${formatCurrency(totalPaid)} | חוב: ${formatCurrency(totalOwed)}`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>חודש</TableHead>
              <TableHead>חוב</TableHead>
              <TableHead>שולם</TableHead>
              <TableHead>יתרה</TableHead>
              <TableHead>סטטוס</TableHead>
            </TableHeader>
            <TableBody>
              {clientPayments.sort((a, b) => b.periodMonth.localeCompare(a.periodMonth)).map(pay => (
                <TableRow key={pay.paymentId}>
                  <TableCell className="text-gray-300">{getMonthName(pay.periodMonth)}</TableCell>
                  <TableCell className="text-white font-mono">{formatCurrency(pay.amountDue)}</TableCell>
                  <TableCell className="text-emerald-400 font-mono">{formatCurrency(pay.amountPaid)}</TableCell>
                  <TableCell className="text-red-400 font-mono">{formatCurrency(pay.amountDue - pay.amountPaid)}</TableCell>
                  <TableCell>
                    <Badge variant={pay.paymentStatus === 'Paid' ? 'success' : pay.paymentStatus === 'Partial' ? 'warning' : 'danger'}>
                      {pay.paymentStatus === 'Paid' ? 'שולם' : pay.paymentStatus === 'Partial' ? 'חלקי' : 'לא שולם'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Retainer Change History */}
      {clientRetainerHistory.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="היסטוריית שינויי ריטיינר" subtitle={`${clientRetainerHistory.length} שינויים`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>תאריך</TableHead>
              <TableHead>ריטיינר ישן</TableHead>
              <TableHead>ריטיינר חדש</TableHead>
              <TableHead>עלות ספקים ישנה</TableHead>
              <TableHead>עלות ספקים חדשה</TableHead>
            </TableHeader>
            <TableBody>
              {clientRetainerHistory.map(rc => (
                <TableRow key={rc.id}>
                  <TableCell className="text-gray-400">{formatDate(rc.changedAt)}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{formatCurrency(rc.oldRetainer)}</TableCell>
                  <TableCell className="text-white font-mono font-bold">{formatCurrency(rc.newRetainer)}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{formatCurrency(rc.oldSupplierCost)}</TableCell>
                  <TableCell className="text-white font-mono font-bold">{formatCurrency(rc.newSupplierCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Client Files / Contracts */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="קבצים והסכמים" subtitle={`${clientFiles.length} קבצים`} />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload size={16} />}
              disabled={isUploading}
            >
              {isUploading ? 'מעלה...' : 'העלאת קובץ'}
            </Button>
          </div>
        </div>

        {clientFiles.length > 0 ? (
          <div className="space-y-2">
            {clientFiles.map(file => (
              <div key={file.name} className="flex items-center justify-between p-3 rounded-lg bg-[#0B1121] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText size={18} className="text-primary shrink-0" />
                  <span className="text-white text-sm truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                    title="פתח קובץ"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => setConfirmDeleteFile(file.name)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="מחק קובץ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-6 italic">אין קבצים. העלה הסכמים, חשבוניות או מסמכים.</p>
        )}
      </Card>

      {/* Confirm Delete File Modal */}
      <Modal isOpen={!!confirmDeleteFile} onClose={() => setConfirmDeleteFile(null)} title="מחיקת קובץ" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את הקובץ &quot;{confirmDeleteFile}&quot;?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteFile(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={() => confirmDeleteFile && handleDeleteFile(confirmDeleteFile)}>מחק</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientProfile;
