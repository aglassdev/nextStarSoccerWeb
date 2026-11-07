import { useEffect, useState } from 'react';
import {
  Bill,
  BillItem,
  getBillItems,
  formatMoney,
  formatBillDate,
  formatSessionDate,
  calculateLateFee,
} from '../../../services/payment/billingService';
import {
  PrepaidPayment,
  billDateRange,
  formatLongDate,
  formatShortDate,
  paymentMethodIcon,
  paymentMethodName,
} from './paymentCenterData';

// The app's bill and payment detail sheets: a light receipt card over a dimmed
// page — title, dates, payment method, line items, then the USD total and,
// for an unpaid bill, a black Pay button. Amounts use the web's billing rules
// (an overdue bill carries its 10% late fee), so what's shown is what's charged.

const Shell = ({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="relative w-[90%] max-w-[400px] md:max-w-[460px] max-h-[80vh] overflow-y-auto bg-[#F4F2EE] rounded-2xl shadow-[0_2px_4px_rgba(0,0,0,0.1)] p-6 md:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#666] hover:text-black hover:bg-black/5 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};

const Title = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[28px] md:text-[32px] leading-tight font-bold text-black text-center mb-2 px-4">{children}</h3>
);

const Row = ({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) => (
  <div className="flex items-center justify-between gap-4 mb-4 py-2">
    <span className={`text-base ${danger ? 'text-[#DC2626]' : 'text-[#666]'}`}>{label}</span>
    <span className={`text-base text-right ${danger ? 'text-[#DC2626]' : 'text-black'}`}>{children}</span>
  </div>
);

/** The brand logo, as in the app; bank transfers (no logo) show their name. */
const MethodMark = ({ method }: { method: string }) => {
  const icon = paymentMethodIcon(method);
  return icon ? (
    <img src={icon} alt={paymentMethodName(method)} className="h-6 w-[60px] object-contain object-right" />
  ) : (
    <span>{paymentMethodName(method)}</span>
  );
};

const Total = ({ amount }: { amount: number }) => (
  <>
    <div className="h-px bg-[#e5e5e5] my-4" />
    <div className="flex items-baseline justify-between mt-2 mb-6">
      <span className="text-xl font-bold text-black">Total</span>
      <span className="flex items-baseline">
        <span className="text-sm text-[#666] mr-2">USD</span>
        <span className="text-2xl font-bold text-black">{formatMoney(amount)}</span>
      </span>
    </div>
  </>
);

export const BillDetailModal = ({
  bill,
  onClose,
  onPay,
}: {
  bill: Bill;
  onClose: () => void;
  onPay: (bill: Bill) => void;
}) => {
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const lateFee = calculateLateFee(bill);
  const isPaid = bill.status === 'paid';
  const isPending = bill.status === 'pending';
  const range = billDateRange(bill.month);
  const paidOn = formatLongDate(bill.paidAt || bill.$updatedAt);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const list = await getBillItems(bill.$id);
      if (!alive) return;
      setItems(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [bill.$id]);

  return (
    <Shell label={`Monthly Bill${bill.monthName ? `, ${bill.monthName}` : ''}`} onClose={onClose}>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-black/30 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <Title>Monthly Bill{bill.monthName ? `, ${bill.monthName}` : ''}</Title>
          {range ? <p className="text-sm text-[#666] text-center mb-6">{range}</p> : <div className="mb-6" />}

          {isPaid && bill.paymentMethod && (
            <>
              <Row label="Payment Method"><MethodMark method={bill.paymentMethod} /></Row>
              {paidOn && <Row label="Date">{paidOn}</Row>}
            </>
          )}

          {isPending && <Row label="Due Date">{formatBillDate(bill.dueDate)}</Row>}

          {items.length > 0 && (
            <div className="my-4">
              {items.map((item) => (
                <div key={item.$id} className="flex items-start justify-between gap-4 mb-3 py-2 min-h-[50px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-black">{item.eventTitle || '—'}</p>
                    {item.eventDate && <p className="text-sm text-[#666]">{formatSessionDate(item.eventDate)}</p>}
                  </div>
                  <span className="text-base text-black flex-shrink-0">{formatMoney(item.price)}</span>
                </div>
              ))}
            </div>
          )}

          {lateFee > 0 && (
            <>
              <Row label="Subtotal">{formatMoney(bill.totalAmount)}</Row>
              <Row label="Late Fee (10%)" danger>{formatMoney(lateFee)}</Row>
            </>
          )}

          <Total amount={bill.totalAmount + lateFee} />

          {isPending && (
            <button
              type="button"
              onClick={() => onPay(bill)}
              className="w-full mt-2 bg-black hover:bg-[#1a1a1a] rounded-xl py-4 text-white text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F2EE]"
            >
              Pay
            </button>
          )}
        </>
      )}
    </Shell>
  );
};

export const PrepaidPaymentModal = ({ payment, onClose }: { payment: PrepaidPayment; onClose: () => void }) => {
  const created = formatLongDate(payment.$createdAt);
  return (
    <Shell label={payment.name} onClose={onClose}>
      <Title>{payment.name}</Title>
      {payment.weeks && payment.weeks.length > 0 ? (
        <div className="mb-6">
          {payment.weeks.map((week, i) => (
            <p key={i} className="text-sm text-[#666] text-center mb-1">{week}</p>
          ))}
        </div>
      ) : payment.date ? (
        <p className="text-sm text-[#666] text-center mb-6">{formatShortDate(payment.date)}</p>
      ) : (
        <div className="mb-6" />
      )}

      {payment.paymentMethod && <Row label="Payment Method"><MethodMark method={payment.paymentMethod} /></Row>}
      {created && <Row label="Date">{created}</Row>}

      <Total amount={payment.price} />
    </Shell>
  );
};
