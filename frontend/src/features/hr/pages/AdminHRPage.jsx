import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, DollarSign, FileSpreadsheet, Users, X } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { TextareaInput } from '../../../components/forms/TextareaInput.jsx';
import { hrApi } from '../api/hrApi.js';
import { formatVND } from '../../../utils/currency.js';
import { toLocalDateString } from '../../../utils/date.js';

export function AdminHRPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'costs' ? 'costs' : 'requests';
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [requests, setRequests] = useState([]);
  const [costReport, setCostReport] = useState([]);
  const [processModal, setProcessModal] = useState({ show: false, requestId: null, status: 'APPROVED', note: '' });
  const [reportDates, setReportDates] = useState(() => {
    const today = new Date();
    return {
      start_date: toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1)),
      end_date: toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  });

  const loadRequests = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await hrApi.getRequests();
      setRequests(response.data?.requests || []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải danh sách yêu cầu.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCosts = async () => {
    if (!reportDates.start_date || !reportDates.end_date) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await hrApi.getAdminHRCosts(reportDates);
      setCostReport(response.data?.costs || []);
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải báo cáo chi phí nhân sự.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'costs') {
      loadCosts();
    } else {
      loadRequests();
    }
    // Dates are submitted explicitly by the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleProcessRequest = async () => {
    const { requestId, status, note } = processModal;
    try {
      await hrApi.processRequest(requestId, { status, admin_note: note });
      setToast({ show: true, type: 'success', msg: status === 'APPROVED' ? 'Đã phê duyệt yêu cầu.' : 'Đã từ chối yêu cầu.' });
      setProcessModal({ show: false, requestId: null, status: 'APPROVED', note: '' });
      loadRequests();
    } catch (processError) {
      setToast({ show: true, type: 'error', msg: processError.message || 'Xử lý yêu cầu thất bại.' });
    }
  };

  return (
    <div className="page-container">
      <PageHeader title="Quản lý nhân sự chi nhánh" description="Duyệt yêu cầu nhân sự và theo dõi chi phí lương của chi nhánh đang chọn." />
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="tab-container" style={{ display: 'flex', gap: '8px', marginBottom: 'var(--spacing-lg)' }}>
        <button type="button" onClick={() => setSearchParams({ tab: 'requests' })} className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}><Users size={18} /> Duyệt yêu cầu</button>
        <button type="button" onClick={() => setSearchParams({ tab: 'costs' })} className={`btn ${activeTab === 'costs' ? 'btn-primary' : 'btn-secondary'}`}><DollarSign size={18} /> Chi phí nhân sự</button>
      </div>

      {activeTab === 'requests' && (
        <div className="card">
          {isLoading ? <p>Đang tải dữ liệu...</p> : requests.length === 0 ? <p>Chưa có yêu cầu nào.</p> : (
            <div className="table-container"><table className="data-table">
              <thead><tr><th>Nhân viên</th><th>Loại</th><th>Ngày áp dụng</th><th>Lý do</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>{requests.map((request) => (
                <tr key={request.id}>
                  <td><strong>{request.staff_name}</strong><div>@{request.staff_username}</div></td>
                  <td>{request.type === 'LEAVE' ? 'Nghỉ phép' : 'Đổi ca'}</td>
                  <td>{request.target_date ? new Date(request.target_date).toLocaleDateString('vi-VN') : '-'}</td>
                  <td>{request.reason}</td><td>{request.status}</td>
                  <td>{request.status === 'PENDING' && <div style={{ display: 'flex', gap: '8px' }}>
                    <Button size="sm" onClick={() => setProcessModal({ show: true, requestId: request.id, status: 'APPROVED', note: '' })} icon={<Check size={14} />}>Duyệt</Button>
                    <Button size="sm" variant="secondary" onClick={() => setProcessModal({ show: true, requestId: request.id, status: 'REJECTED', note: '' })} icon={<X size={14} />}>Từ chối</Button>
                  </div>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {activeTab === 'costs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <TextInput type="date" name="start_date" label="Từ ngày" value={reportDates.start_date} onChange={(event) => setReportDates({ ...reportDates, start_date: event.target.value })} />
            <TextInput type="date" name="end_date" label="Đến ngày" value={reportDates.end_date} onChange={(event) => setReportDates({ ...reportDates, end_date: event.target.value })} />
            <Button onClick={loadCosts} disabled={isLoading} icon={<FileSpreadsheet size={16} />}>Tra cứu</Button>
          </div>
          <div className="card">
            {isLoading ? <p>Đang tổng hợp dữ liệu...</p> : costReport.length === 0 ? <p>Không có dữ liệu trong khoảng đã chọn.</p> : (
              <div className="table-container"><table className="data-table"><thead><tr><th>Nhân viên</th><th>Ca hoàn thành</th><th>Tổng lương</th></tr></thead>
                <tbody>{costReport.map((row) => <tr key={row.staff_id}><td>{row.staff_name}</td><td>{row.completed_shifts}</td><td>{formatVND(Number(row.total_salary))}</td></tr>)}</tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {processModal.show && <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div className="card" style={{ width: '450px', backgroundColor: '#fff' }}>
          <h3>{processModal.status === 'APPROVED' ? 'Phê duyệt yêu cầu' : 'Từ chối yêu cầu'}</h3>
          <TextareaInput label="Ghi chú" name="note" value={processModal.note} onChange={(event) => setProcessModal({ ...processModal, note: event.target.value })} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}><Button onClick={handleProcessRequest}>Xác nhận</Button><Button variant="secondary" onClick={() => setProcessModal({ show: false, requestId: null, status: 'APPROVED', note: '' })}>Hủy</Button></div>
        </div>
      </div>}
      {toast.show && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}

export default AdminHRPage;
