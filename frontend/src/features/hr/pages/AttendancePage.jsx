import { useEffect, useState, useCallback } from 'react';
import { RotateCcw, QrCode, List, Clock } from 'lucide-react';
import { attendanceApi } from '../api/attendanceApi.js';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/common/DataTable.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { TextInput } from '../../../components/forms/TextInput.jsx';
import { formatVND } from '../../../utils/currency.js';

export function AttendancePage() {
  const [activeTab, setActiveTab] = useState('qr'); // 'qr' or 'logs'
  const [qrToken, setQrToken] = useState('');
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');

  const fetchQRToken = useCallback(async () => {
    try {
      setError('');
      const response = await attendanceApi.getQRToken();
      setQrToken(response.data.token);
    } catch (err) {
      setError(err.message || 'Không lấy được mã QR chấm công.');
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await attendanceApi.getLogs({ startDate, endDate });
      setLogs(response.data || []);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách chấm công.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (activeTab === 'qr') {
      fetchQRToken();
    } else {
      fetchLogs();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeTab, fetchQRToken, fetchLogs]);

  const handleRefresh = () => {
    if (activeTab === 'qr') {
      fetchQRToken();
    } else {
      fetchLogs();
    }
  };

  const filteredLogs = logs.filter(log => 
    log.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.staff_username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.shift_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const checkInURL = `${window.location.origin}/store/hr?token=${qrToken}`;
  const qrImageURL = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(checkInURL)}`;

  const headers = [
    {
      key: 'staff_name',
      label: 'Nhân viên',
      render: (row) => (
        <div>
          <div style={{ fontWeight: '600' }}>{row.staff_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>@{row.staff_username}</div>
        </div>
      ),
    },
    {
      key: 'shift_name',
      label: 'Ca làm việc',
      render: (row) => (
        <div>
          <span style={{ fontWeight: '600' }}>{row.shift_name}</span>
          <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
            Lịch: {row.planned_start.slice(0, 5)} - {row.planned_end.slice(0, 5)}
          </div>
        </div>
      ),
    },
    {
      key: 'shift_date',
      label: 'Ngày làm',
      render: (row) => {
        const [y, m, d] = row.shift_date.split('-');
        return `${d}/${m}/${y}`;
      },
    },
    {
      key: 'check_in_at',
      label: 'Check-In',
      render: (row) => row.check_in_at ? (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
            {new Date(row.check_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {row.lateness_minutes > 0 ? (
            <span style={{ fontSize: '10px', color: 'var(--color-error)', fontWeight: '600' }}>
              Trễ {row.lateness_minutes} phút
            </span>
          ) : (
            <span style={{ fontSize: '10px', color: 'var(--color-tertiary-container)', fontWeight: '600' }}>
              Đúng giờ
            </span>
          )}
        </div>
      ) : (
        <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>Chưa ghi nhận</span>
      ),
    },
    {
      key: 'check_out_at',
      label: 'Check-Out',
      render: (row) => row.check_out_at ? (
        <div>
          <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>
            {new Date(row.check_out_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--color-secondary)' }}>
            Làm thực tế: {row.actual_hours}h
          </span>
        </div>
      ) : (
        <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>Chưa ghi nhận</span>
      ),
    },
    {
      key: 'total_salary',
      label: 'Lương ca',
      style: { textAlign: 'right' },
      render: (row) => (
        <span style={{ fontWeight: '700', color: 'var(--color-tertiary-container)' }}>
          {formatVND(row.total_salary)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => {
        let type = 'info';
        let label = row.status;
        if (row.status === 'COMPLETED') {
          type = 'success';
          label = 'Hoàn thành';
        } else if (row.status === 'ASSIGNED') {
          if (row.check_in_at) {
            type = 'warning';
            label = 'Đang làm việc';
          } else {
            type = 'info';
            label = 'Chưa vào ca';
          }
        } else if (row.status === 'ABSENT') {
          type = 'error';
          label = 'Vắng mặt';
        }
        return <StatusBadge status={type.toUpperCase()} customLabel={label} />;
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <PageHeader
        title="Quản lý chấm công"
        description="Theo dõi lịch sử vào ca, ra ca và giờ làm thực tế của nhân viên bằng mã QR."
        actions={
          <Button variant="secondary" onClick={handleRefresh} disabled={isLoading} icon={<RotateCcw size={16} />}>
            Tải lại
          </Button>
        }
      />

      {error && <Alert type="warning" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)', gap: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('qr')}
          style={{
            padding: '12px 16px',
            fontWeight: '600',
            fontSize: '14px',
            color: activeTab === 'qr' ? 'var(--color-primary)' : 'var(--color-secondary)',
            borderBottom: activeTab === 'qr' ? '2px solid var(--color-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <QrCode size={16} />
          Mã QR Chấm công hôm nay
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '12px 16px',
            fontWeight: '600',
            fontSize: '14px',
            color: activeTab === 'logs' ? 'var(--color-primary)' : 'var(--color-secondary)',
            borderBottom: activeTab === 'logs' ? '2px solid var(--color-primary)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <List size={16} />
          Lịch sử Chấm công
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'qr' ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '32px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--color-primary)' }}>QR CODE ĐIỂM DANH</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-secondary)' }}>
                Đặt mã này tại quầy để nhân viên quét QR trên điện thoại khi vào ca. Mã này tự động đổi hàng ngày.
              </p>
            </div>
            
            <div style={{
              padding: '16px',
              borderRadius: 'var(--radius-default)',
              backgroundColor: 'white',
              border: '1px solid var(--color-outline-variant)',
              boxShadow: 'var(--shadow-low)',
              display: 'inline-block'
            }}>
              {qrToken ? (
                <img src={qrImageURL} alt="Attendance QR Code" style={{ display: 'block', width: '280px', height: '280px' }} />
              ) : (
                <div style={{ width: '280px', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-secondary)' }}>
                  Đang tạo mã QR...
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-secondary)', backgroundColor: 'var(--color-surface-container-low)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              <Clock size={14} style={{ color: 'var(--color-primary)' }} />
              <span>Cập nhật ngày: {new Date().toLocaleDateString('vi-VN')}</span>
            </div>
            
            <a href={checkInURL} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'underline' }}>
              Sử dụng liên kết trực tiếp nếu không thể quét mã QR
            </a>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters */}
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '16px 16px 0 16px' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <TextInput
                label="Tìm kiếm nhân viên, ca làm..."
                placeholder="Nhập tên nhân viên, ca làm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div style={{ width: '160px' }}>
              <div className="form-group">
                <label className="form-label">
                  Từ ngày
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ width: '160px' }}>
              <div className="form-group">
                <label className="form-label">
                  Đến ngày
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <DataTable
            headers={headers}
            data={filteredLogs}
            loading={isLoading}
            emptyMessage="Không tìm thấy lịch sử chấm công nào trong khoảng thời gian này."
          />
        </div>
      )}
    </div>
  );
}
export default AttendancePage;
