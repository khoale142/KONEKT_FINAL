import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  UserCheck, RotateCcw, DollarSign, AlertTriangle, 
  TrendingUp, Wallet, Clock, Printer, FileText, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { posSessionApi } from '../api/posSessionApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { TextareaInput } from '../../../components/forms/TextareaInput.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { formatVND } from '../../../utils/currency.js';

export function StaffSessionPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Current session state
  const [activeSession, setActiveSession] = useState(null);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'history'
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [reloadNonce, setReloadNonce] = useState(0);

  // Time & Shift Check (real-time UTC+7)
  const [vnTime, setVnTime] = useState(new Date());

  // Form states
  const [startingCash, setStartingCash] = useState('');
  const [startingNotes, setStartingNotes] = useState('');
  const [midShiftCash, setMidShiftCash] = useState('');
  const [midShiftNotes, setMidShiftNotes] = useState('');
  const [endingCashActual, setEndingCashActual] = useState('');
  const [endingNotes, setEndingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History state
  const [sessionsHistory, setSessionsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Selected session report for modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Handle message passed from POSPage redirect
  useEffect(() => {
    if (location.state?.message) {
      setPageError(location.state.message);
      // Clear state message so it does not persist on reload
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Real-time clock update (UTC+7 / Asia/Ho_Chi_Minh)
  useEffect(() => {
    const timer = setInterval(() => {
      const options = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
      const vnTimeStr = new Date().toLocaleString('en-US', options);
      setVnTime(new Date(vnTimeStr));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active session and history
  useEffect(() => {
    let isCancelled = false;

    const fetchSessionData = async () => {
      setIsSessionLoading(true);
      try {
        const response = await posSessionApi.getActiveSession();
        if (!isCancelled) {
          setActiveSession(response.data.session || null);
        }
      } catch (err) {
        if (!isCancelled) {
          setPageError(err.message || 'Không thể xác thực ca làm việc.');
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    };

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await posSessionApi.getSessionHistory({ limit: 10 });
        if (!isCancelled) {
          setSessionsHistory(response.data.sessions || []);
        }
      } catch (err) {
        console.error('Failed to load session history:', err);
      } finally {
        if (!isCancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void fetchSessionData();
    void fetchHistory();

    return () => {
      isCancelled = true;
    };
  }, [reloadNonce]);

  // Format Helper
  const formatDateTimeUTC7 = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getShiftName = (time) => {
    const hour = time.getHours();
    if (hour >= 7 && hour < 15) return 'Ca Sáng (07:00 - 15:00)';
    if (hour >= 15 && hour < 23) return 'Ca Chiều (15:00 - 23:00)';
    return 'Ngoài ca chính thức';
  };

  const currentShift = getShiftName(vnTime);
  const hour = vnTime.getHours();

  // Handover warning logic
  // Allow counting starting from 12:00 (3 hours before 15:00)
  const isMorningShiftActive = activeSession && (() => {
    const openTime = new Date(activeSession.opened_at);
    const vnOpenTimeStr = openTime.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const vnOpenTime = new Date(vnOpenTimeStr);
    return vnOpenTime.getHours() >= 7 && vnOpenTime.getHours() < 15;
  })();

  const isTransitionTime = isMorningShiftActive && hour >= 12 && hour < 15;
  const isOverdueTransition = isMorningShiftActive && hour >= 15;
  const showMidShiftCount = isMorningShiftActive && (hour >= 12 || activeSession.mid_shift_cash !== null);

  // Handlers
  const handleOpenSession = async (e) => {
    e.preventDefault();
    setPageError('');
    if (!startingCash || isNaN(Number(startingCash)) || Number(startingCash) < 0) {
      setPageError('Vui lòng nhập số tiền mặt đầu ca hợp lệ.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await posSessionApi.openSession(Number(startingCash), startingNotes);
      setActiveSession(response.data.session);
      setToastMsg('Mở ca làm việc thành công!');
      setToastType('success');
      setReloadNonce((current) => current + 1);
      setStartingCash('');
      setStartingNotes('');
    } catch (err) {
      setPageError(err.message || 'Mở ca làm việc thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMidShiftCount = async (e) => {
    e.preventDefault();
    setPageError('');
    if (!midShiftCash || isNaN(Number(midShiftCash)) || Number(midShiftCash) < 0) {
      setPageError('Vui lòng nhập số tiền mặt kiểm đếm hợp lệ.');
      return;
    }
    setIsSubmitting(true);
    try {
      await posSessionApi.midShiftCount(Number(midShiftCash), midShiftNotes);
      setToastMsg('Tổng kết ca sáng thành công!');
      setToastType('success');
      setReloadNonce((current) => current + 1);
      setMidShiftCash('');
      setMidShiftNotes('');
    } catch (err) {
      setPageError(err.message || 'Tổng kết ca sáng thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSession = async (e) => {
    e.preventDefault();
    setPageError('');
    if (!endingCashActual || isNaN(Number(endingCashActual)) || Number(endingCashActual) < 0) {
      setPageError('Vui lòng nhập số tiền mặt thực tế cuối ngày hợp lệ.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await posSessionApi.closeSession(Number(endingCashActual), endingNotes);
      setToastMsg('Đóng ca làm việc thành công!');
      setToastType('success');
      setEndingCashActual('');
      setEndingNotes('');
      // Trigger modal view for report immediately
      handleViewReport(response.data.session.id);
      setReloadNonce((current) => current + 1);
    } catch (err) {
      setPageError(err.message || 'Đóng ca làm việc thất bại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewReport = async (sessionId) => {
    setReportLoading(true);
    try {
      const response = await posSessionApi.getSessionReport(sessionId);
      setSelectedReport(response.data);
    } catch (err) {
      setToastMsg(err.message || 'Không thể tải báo cáo ca làm việc.');
      setToastType('error');
    } finally {
      setReportLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Hidden stylesheet for print layout */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            color: #000 !important;
            background: #fff !important;
            font-size: 13px !important;
          }
          .modal-overlay, .modal-footer, button, .app-sidebar, .app-header {
            display: none !important;
          }
        }
      ` }} />

      <PageHeader
        title="Quản lý ca làm việc (Shift Management)"
        description="Mở ca, kết ca, đối soát và bàn giao doanh thu két tiền mặt nhân viên."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface-container-low)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-outline-variant)'
            }}>
              <Clock size={16} />
              <span>{vnTime.toLocaleTimeString('vi-VN', { hour12: false })}</span>
              <span style={{ color: 'var(--color-outline)' }}>|</span>
              <span>{vnTime.toLocaleDateString('vi-VN')}</span>
            </div>
            <Button variant="secondary" onClick={() => setReloadNonce(n => n + 1)} disabled={isSessionLoading} icon={<RotateCcw size={16} />}>
              Làm mới
            </Button>
          </div>
        }
      />

      {pageError && <Alert type="warning" message={pageError} onClose={() => setPageError('')} />}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)', gap: '16px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('current')}
          style={{
            padding: '12px 16px',
            fontWeight: '600',
            fontSize: '14px',
            color: activeTab === 'current' ? 'var(--color-primary)' : 'var(--color-secondary)',
            borderBottom: activeTab === 'current' ? '2px solid var(--color-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <UserCheck size={16} />
          Ca làm việc hiện tại
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 16px',
            fontWeight: '600',
            fontSize: '14px',
            color: activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-secondary)',
            borderBottom: activeTab === 'history' ? '2px solid var(--color-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={16} />
          Lịch sử ca làm việc
        </button>
      </div>

      {isSessionLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-secondary)' }}>Đang tải trạng thái ca làm việc...</div>
      ) : (
        <div style={{ width: '100%' }}>
          {activeTab === 'current' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              
              {/* SECTION 1: ACTIVE SESSION OR OPEN SESSION FORM */}
              {!activeSession ? (
                <div className="card" style={{ padding: '24px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '12px' }}>
                    <div style={{ padding: '10px', borderRadius: 'var(--radius-default)', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-primary)' }}>
                      <UserCheck size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>Khai báo mở ca làm việc</h3>
                      <span style={{ fontSize: '13px', color: 'var(--color-secondary)' }}>Bắt đầu ca bán hàng mới trên POS</span>
                    </div>
                  </div>

                  <div style={{ 
                    backgroundColor: 'var(--color-surface-container-low)', 
                    padding: '12px 16px', 
                    borderRadius: 'var(--radius-default)', 
                    marginBottom: '20px',
                    borderLeft: '4px solid var(--color-primary)'
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-secondary)', display: 'block', fontWeight: '600', textTransform: 'uppercase' }}>
                      Ca phát sinh (Thời gian thực)
                    </span>
                    <strong style={{ fontSize: '15px', color: 'var(--color-primary)' }}>{currentShift}</strong>
                  </div>

                  <form onSubmit={handleOpenSession} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <TextInput
                      label="Tiền mặt đầu ca trong két (VNĐ) *"
                      placeholder="Nhập số tiền mặt có sẵn trong két (ví dụ: 500000)"
                      value={startingCash}
                      onChange={(e) => setStartingCash(e.target.value)}
                      required
                      inputMode="numeric"
                    />
                    <TextareaInput
                      label="Ghi chú mở ca"
                      placeholder="Nhập ghi chú mở ca (nếu có)..."
                      value={startingNotes}
                      onChange={(e) => setStartingNotes(e.target.value)}
                      rows={3}
                    />
                    <Button variant="primary" type="submit" loading={isSubmitting} style={{ padding: '12px', fontSize: '15px', marginTop: '8px' }}>
                      Mở ca làm việc
                    </Button>
                  </form>
                </div>
              ) : (
                // ACTIVE SESSION DETAILS PAGE
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                  
                  {/* Card: Active Session Header */}
                  <div className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ padding: '10px', borderRadius: 'var(--radius-default)', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-primary)' }}>
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>Ca bán hàng đang mở</h3>
                        <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>Mã ca: #{activeSession.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Button variant="secondary" onClick={() => navigate('/staff/pos')} style={{ fontWeight: '600' }}>
                        Vào bán hàng (POS)
                      </Button>
                    </div>
                  </div>

                  {/* Warnings and Alerts */}
                  {isTransitionTime && (
                    <Alert 
                      type="warning" 
                      message="⚠️ BÀN GIAO CA SÁNG: Hiện tại đã đến khung giờ bàn giao ca sáng (12h - 15h). Vui lòng thực hiện đếm tiền mặt tổng kết ca sáng để bàn giao!" 
                    />
                  )}
                  {isOverdueTransition && activeSession.mid_shift_cash === null && (
                    <Alert 
                      type="error" 
                      message="🚨 CẢNH BÁO BÀN GIAO: Đã quá giờ ca sáng (sau 15h) nhưng bạn chưa thực hiện đếm tiền tổng kết ca sáng. Vui lòng thực hiện kiểm tiền bàn giao ngay lập tức!" 
                    />
                  )}

                  {/* Grid: Financial status card */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: '600' }}>TIỀN MẶT ĐẦU CA</span>
                        <Wallet size={16} style={{ color: 'var(--color-outline)' }} />
                      </div>
                      <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>{formatVND(activeSession.starting_cash)}</strong>
                    </div>

                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: '600' }}>DOANH THU TIỀN MẶT</span>
                        <DollarSign size={16} style={{ color: 'var(--color-outline)' }} />
                      </div>
                      <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>+{formatVND(activeSession.cashSales || 0)}</strong>
                    </div>

                    <div className="card" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: '600' }}>DOANH THU VIETQR</span>
                        <TrendingUp size={16} style={{ color: 'var(--color-outline)' }} />
                      </div>
                      <strong style={{ fontSize: '18px', color: 'var(--color-primary)' }}>+{formatVND(activeSession.qrSales || 0)}</strong>
                    </div>

                    <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-secondary)', fontWeight: '600' }}>KÉT TIỀN LÝ THUYẾT</span>
                        <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <strong style={{ fontSize: '18px', color: 'var(--color-tertiary-container)' }}>{formatVND(activeSession.endingCashExpected || 0)}</strong>
                    </div>
                  </div>

                  {/* CARD: MID-SHIFT HANDOVER (CA SÁNG -> CA CHIỀU) */}
                  {showMidShiftCount && (
                    <div className="card" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '10px' }}>
                        <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>Tổng kết & Bàn giao ca sáng</h4>
                      </div>

                      {activeSession.mid_shift_cash === null ? (
                        <form onSubmit={handleMidShiftCount} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <p style={{ fontSize: '13px', color: 'var(--color-secondary)', margin: 0 }}>
                            Vui lòng kiểm đếm tiền mặt thực tế trong két để tổng kết ca sáng. Sau khi xác nhận, số tiền này sẽ làm số dư tiền mặt bắt đầu cho ca chiều. Buổi chiều sẽ tự động tích lũy doanh thu tiền mặt dựa trên số dư này.
                          </p>
                          <TextInput
                            label="Tiền mặt thực tế đếm được ca sáng (VNĐ) *"
                            placeholder="Nhập số tiền mặt đếm được lúc bàn giao"
                            value={midShiftCash}
                            onChange={(e) => setMidShiftCash(e.target.value)}
                            required
                            inputMode="numeric"
                          />
                          <TextareaInput
                            label="Ghi chú bàn giao ca sáng"
                            placeholder="Nhập ghi chú bàn giao ca sáng (nếu có)..."
                            value={midShiftNotes}
                            onChange={(e) => setMidShiftNotes(e.target.value)}
                            rows={2}
                          />
                          <Button variant="primary" type="submit" loading={isSubmitting} style={{ alignSelf: 'flex-start' }}>
                            Xác nhận tổng kết ca sáng
                          </Button>
                        </form>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                          <div style={{ 
                            backgroundColor: 'var(--color-surface-container-low)', 
                            padding: '12px', 
                            borderRadius: 'var(--radius-default)', 
                            borderLeft: '4px solid #22c55e',
                            marginBottom: '10px'
                          }}>
                            ✅ <strong>Đã hoàn tất đếm tiền bàn giao ca sáng!</strong> Ca chiều đã bắt đầu tích lũy doanh thu.
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div style={{ borderBottom: '1px dashed var(--color-outline-variant)', paddingBottom: '6px' }}>
                              <span style={{ color: 'var(--color-secondary)' }}>Thời gian đếm:</span>{' '}
                              <strong>{formatDateTimeUTC7(activeSession.mid_shift_counted_at)}</strong>
                            </div>
                            <div style={{ borderBottom: '1px dashed var(--color-outline-variant)', paddingBottom: '6px' }}>
                              <span style={{ color: 'var(--color-secondary)' }}>Tiền mặt đếm thực tế:</span>{' '}
                              <strong style={{ color: 'var(--color-primary)' }}>{formatVND(activeSession.mid_shift_cash)}</strong>
                            </div>
                            <div style={{ borderBottom: '1px dashed var(--color-outline-variant)', paddingBottom: '6px' }}>
                              <span style={{ color: 'var(--color-secondary)' }}>Tiền mặt lý thuyết ca sáng:</span>{' '}
                              <strong>{formatVND(activeSession.mid_shift_expected)}</strong>
                            </div>
                            <div style={{ borderBottom: '1px dashed var(--color-outline-variant)', paddingBottom: '6px' }}>
                              <span style={{ color: 'var(--color-secondary)' }}>Chênh lệch ca sáng:</span>{' '}
                              <strong style={{ color: Number(activeSession.mid_shift_discrepancy) < 0 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                                {Number(activeSession.mid_shift_discrepancy) > 0 ? '+' : ''}
                                {formatVND(activeSession.mid_shift_discrepancy)}
                              </strong>
                            </div>
                          </div>
                          {activeSession.mid_shift_notes && (
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ color: 'var(--color-secondary)' }}>Ghi chú bàn giao:</span> <em>"{activeSession.mid_shift_notes}"</em>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CARD: CLOSE SESSION / kết ca */}
                  <div className="card" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '10px' }}>
                      <Wallet size={20} style={{ color: 'var(--color-primary)' }} />
                      <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>Kết thúc ca làm việc (Kết ca & Đóng két)</h4>
                    </div>

                    <form onSubmit={handleCloseSession} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--color-secondary)', margin: 0 }}>
                        Nhập số tiền thực tế trong két khi đóng cửa hàng (Kết ca chiều). Hệ thống sẽ tự động tính toán tổng doanh thu và đối soát chênh lệch cuối ngày.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <TextInput
                          label="Tiền mặt thực tế đếm được cuối ca (VNĐ) *"
                          placeholder="Nhập số tiền thực tế đếm được"
                          value={endingCashActual}
                          onChange={(e) => setEndingCashActual(e.target.value)}
                          required
                          inputMode="numeric"
                        />

                        <div>
                          <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>Kết quả đối soát dự kiến</label>
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-default)',
                            border: '1px solid var(--color-outline-variant)',
                            backgroundColor: 'var(--color-surface-container-low)',
                            height: '42px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontWeight: '700',
                            fontSize: '14px'
                          }}>
                            <span style={{ color: 'var(--color-secondary)', fontWeight: 'normal', fontSize: '12px' }}>Chênh lệch:</span>
                            {endingCashActual !== '' && !isNaN(Number(endingCashActual)) ? (
                              <span style={{
                                color: Number(endingCashActual) - activeSession.endingCashExpected < 0 ? 'var(--color-error)' : 'var(--color-primary)'
                              }}>
                                {Number(endingCashActual) - activeSession.endingCashExpected > 0 ? '+' : ''}
                                {formatVND(Number(endingCashActual) - activeSession.endingCashExpected)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-outline)' }}>--</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <TextareaInput
                        label="Ghi chú kết ca / Báo cáo chênh lệch"
                        placeholder="Nhập ghi chú kết ca hoặc giải trình chênh lệch (nếu có)..."
                        value={endingNotes}
                        onChange={(e) => setEndingNotes(e.target.value)}
                        rows={2}
                      />

                      <Button variant="primary" type="submit" loading={isSubmitting} style={{ alignSelf: 'flex-start' }}>
                        Đóng ca bán hàng
                      </Button>
                    </form>
                  </div>

                </div>
              )}
            </div>
          ) : (
            /* SECTION 2: HISTORY LIST */
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '10px' }}>
                <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>Lịch sử ca làm việc gần đây</h4>
              </div>

              {historyLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-secondary)' }}>Đang tải lịch sử ca làm...</div>
              ) : sessionsHistory.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-secondary)' }}>Chưa có lịch sử ca làm việc nào.</div>
              ) : (
                <div className="table-responsive" style={{ overflowX: 'auto', width: '100%' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}>Giờ mở</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}>Giờ đóng</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}>Đầu ca</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}>Cuối ca đếm</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}>Chênh lệch</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}>Trạng thái</th>
                        <th style={{ padding: '12px 16px', borderBottom: '2px solid var(--color-outline-variant)', color: 'var(--color-secondary)', fontWeight: '600' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionsHistory.map((sess) => {
                        return (
                          <tr key={sess.id}>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {formatDateTimeUTC7(sess.opened_at)}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {sess.closed_at ? formatDateTimeUTC7(sess.closed_at) : <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>Đang mở</span>}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {formatVND(sess.starting_cash)}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {sess.ending_cash_actual !== null ? formatVND(sess.ending_cash_actual) : '--'}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {sess.discrepancy !== null ? (
                                <span style={{ color: Number(sess.discrepancy) < 0 ? 'var(--color-error)' : 'var(--color-primary)', fontWeight: '600' }}>
                                  {Number(sess.discrepancy) > 0 ? '+' : ''}
                                  {formatVND(sess.discrepancy)}
                                </span>
                              ) : '--'}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span className={`status-badge ${sess.status === 'OPEN' ? 'success' : 'neutral'}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
                                {sess.status === 'OPEN' ? 'MỞ' : 'ĐÃ ĐÓNG'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-outline-variant)', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => handleViewReport(sess.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', fontWeight: '600', cursor: 'pointer', background: 'none', border: 'none' }}
                              >
                                Chi tiết <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: DETAILED SHIFT REPORT & PRINT PREVIEW */}
      {selectedReport && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setSelectedReport(null)}>
          <div className="modal-content" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--color-primary)', margin: 0 }}>
                Báo cáo tổng kết ca làm việc
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Print Area */}
            <div className="modal-body" id="print-area" style={{ flex: 1, overflowY: 'auto', padding: '20px', fontSize: '14px', lineHeight: '1.5' }}>
              
              {/* Print Header */}
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-primary)', margin: '0 0 6px 0' }}>MINI COFFEE POS</h2>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>BÁO CÁO DOANH THU & KÉT TIỀN</h3>
                <span style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>Mã ca: #{selectedReport.session.id}</span>
              </div>

              {/* Section: Session Meta Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '14px' }}>
                <div>
                  <span style={{ color: 'var(--color-secondary)' }}>Nhân viên:</span>{' '}
                  <strong>{selectedReport.session.staff_name} (@{selectedReport.session.staff_username})</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-secondary)' }}>Trạng thái:</span>{' '}
                  <strong style={{ color: selectedReport.session.status === 'OPEN' ? 'var(--color-primary)' : 'inherit' }}>
                    {selectedReport.session.status === 'OPEN' ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-secondary)' }}>Thời gian mở:</span>{' '}
                  <span>{formatDateTimeUTC7(selectedReport.session.opened_at)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-secondary)' }}>Thời gian đóng:</span>{' '}
                  <span>{selectedReport.session.closed_at ? formatDateTimeUTC7(selectedReport.session.closed_at) : '--'}</span>
                </div>
              </div>

              {/* Section: Revenue Summary */}
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', margin: '0 0 8px 0', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '4px' }}>
                1. TỔNG HỢP DOANH THU CA
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Doanh thu Tiền mặt (Cash):</span>
                  <strong>{formatVND(selectedReport.session.cashSales)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Doanh thu Chuyển khoản (VietQR):</span>
                  <strong>{formatVND(selectedReport.session.qrSales)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-outline-variant)', paddingTop: '6px', fontWeight: 'bold' }}>
                  <span>Tổng doanh thu (Net):</span>
                  <span style={{ color: 'var(--color-tertiary-container)' }}>{formatVND(selectedReport.session.totalSales)}</span>
                </div>
              </div>

              {/* Section: Mid-Shift Handover Details */}
              {selectedReport.session.mid_shift_counted_at && (
                <>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', margin: '0 0 8px 0', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '4px' }}>
                    2. BÀN GIAO CA SÁNG
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Thời điểm đếm bàn giao:</span>
                      <span>{formatDateTimeUTC7(selectedReport.session.mid_shift_counted_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tiền mặt lý thuyết ca sáng:</span>
                      <span>{formatVND(selectedReport.session.mid_shift_expected)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tiền mặt đếm thực tế ca sáng:</span>
                      <strong>{formatVND(selectedReport.session.mid_shift_cash)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
                      <span>Chênh lệch ca sáng:</span>
                      <span style={{ color: Number(selectedReport.session.mid_shift_discrepancy) < 0 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                        {Number(selectedReport.session.mid_shift_discrepancy) > 0 ? '+' : ''}
                        {formatVND(selectedReport.session.mid_shift_discrepancy)}
                      </span>
                    </div>
                    {selectedReport.session.mid_shift_notes && (
                      <div style={{ fontSize: '12px', color: 'var(--color-secondary)', padding: '6px 10px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '4px', marginTop: '4px' }}>
                        Ghi chú: "{selectedReport.session.mid_shift_notes}"
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Section: Drawer Settlement Details */}
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', margin: '0 0 8px 0', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '4px' }}>
                {selectedReport.session.mid_shift_counted_at ? '3. TỔNG KẾT CA CHIỀU & CUỐI NGÀY' : '2. ĐỐI SOÁT KÉT TIỀN MẶT'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tiền mặt đầu ca (két ban đầu):</span>
                  <span>{formatVND(selectedReport.session.starting_cash)}</span>
                </div>
                {selectedReport.session.mid_shift_counted_at && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tiền mặt ca chiều kế thừa (két ca sáng):</span>
                    <span>{formatVND(selectedReport.session.mid_shift_cash)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tiền mặt lý thuyết cuối ngày:</span>
                  <span>{formatVND(selectedReport.session.ending_cash_expected)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tiền mặt thực tế đếm được:</span>
                  <strong>{selectedReport.session.ending_cash_actual !== null ? formatVND(selectedReport.session.ending_cash_actual) : 'Chưa đóng ca'}</strong>
                </div>
                {selectedReport.session.ending_cash_actual !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--color-outline-variant)', paddingTop: '6px', fontWeight: 'bold' }}>
                    <span>Chênh lệch két cuối ngày:</span>
                    <span style={{ color: Number(selectedReport.session.discrepancy) < 0 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                      {Number(selectedReport.session.discrepancy) > 0 ? '+' : ''}
                      {formatVND(selectedReport.session.discrepancy)}
                    </span>
                  </div>
                )}
                {selectedReport.session.notes && (
                  <div style={{ fontSize: '12px', color: 'var(--color-secondary)', padding: '6px 10px', backgroundColor: 'var(--color-surface-container-low)', borderRadius: '4px', marginTop: '4px' }}>
                    Ghi chú đóng ca: "{selectedReport.session.notes}"
                  </div>
                )}
              </div>

              {/* Section: Orders completed in this shift */}
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-primary)', margin: '0 0 8px 0', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '4px' }}>
                {selectedReport.session.mid_shift_counted_at ? '4. DANH SÁCH ĐƠN HÀNG TRONG CA' : '3. DANH SÁCH ĐƠN HÀNG TRONG CA'}
              </h4>
              {selectedReport.orders.length === 0 ? (
                <div style={{ color: 'var(--color-secondary)', fontSize: '12px', fontStyle: 'italic' }}>Không có đơn hàng phát sinh trong ca này.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 0' }}>Mã đơn</th>
                      <th>Thời gian</th>
                      <th>Thanh toán</th>
                      <th style={{ textAlign: 'right' }}>Tổng cộng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.orders.map((ord) => (
                      <tr key={ord.id} style={{ borderBottom: '1px dashed rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>#{ord.order_no}</td>
                        <td>{formatDateTimeUTC7(ord.created_at)}</td>
                        <td>{ord.payment_method === 'CASH' ? 'Tiền mặt' : 'VietQR'}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatVND(ord.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--color-outline-variant)' }}>
              <Button variant="secondary" onClick={() => setSelectedReport(null)}>
                Đóng lại
              </Button>
              <Button variant="primary" onClick={handlePrint} icon={<Printer size={16} />}>
                In báo cáo (Print)
              </Button>
            </div>

          </div>
        </div>
      )}

      <Toast message={toastMsg} type={toastType} onClose={() => setToastMsg('')} />
    </div>
  );
}

export default StaffSessionPage;
