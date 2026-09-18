import { useEffect, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Alert } from '../../../components/feedback/Alert.jsx';
import { Toast } from '../../../components/feedback/Toast.jsx';
import { StatusBadge } from '../../../components/common/StatusBadge.jsx';
import { formatVND } from '../../../utils/currency.js';
import { toLocalDateString } from '../../../utils/date.js';
import { hrApi } from '../api/hrApi.js';
import { Calendar as CalendarIcon, Plus, Trash2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

export function AdminCalendarPage() {
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);

  // Users & Master Shifts
  const [staffList, setStaffList] = useState([]);
  const [masterShifts, setMasterShifts] = useState([]);

  // Availability & Assignments
  const [availabilities, setAvailabilities] = useState([]);
  const [assignedShifts, setAssignedShifts] = useState([]);

  // Time navigation state (Current Week Monday)
  const [currentMonday, setCurrentMonday] = useState(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const distance = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today.setDate(today.getDate() + distance));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Modal State for Assigning / Managing Shifts
  const [cellModal, setCellModal] = useState({ show: false, staff: null, date: null, existingShifts: [], selectedShiftId: '' });

  const showToast = (msg, type = 'success') => {
    setToast({ show: true, msg, type });
  };

  const loadBaseMetadata = async () => {
    try {
      const [staffRes, shiftsRes] = await Promise.all([
        hrApi.getStaffList(),
        hrApi.getShifts(),
      ]);
      setStaffList(staffRes.data?.staff || []);
      setMasterShifts(shiftsRes.data?.shifts || []);
    } catch (err) {
      setError(err.message || 'Không tải được danh mục nhân sự cơ bản.');
    }
  };

  const loadCalendarData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const mondayStr = toLocalDateString(currentMonday);
      const sunday = new Date(currentMonday);
      sunday.setDate(sunday.getDate() + 6);
      const sundayStr = toLocalDateString(sunday);

      const [availRes, shiftsRes] = await Promise.all([
        hrApi.getAvailability({ start_date: mondayStr, end_date: sundayStr }),
        hrApi.getAssignedShifts({ start_date: mondayStr, end_date: sundayStr }),
      ]);

      setAvailabilities(availRes.data?.availabilities || []);
      setAssignedShifts(shiftsRes.data?.shifts || []);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu lịch làm.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBaseMetadata();
  }, []);

  useEffect(() => {
    loadCalendarData();
  }, [currentMonday]);

  const handlePrevWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(newMonday.getDate() - 7);
    setCurrentMonday(newMonday);
  };

  const handleNextWeek = () => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(newMonday.getDate() + 7);
    setCurrentMonday(newMonday);
  };

  const getWeekDays = (mondayDate) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const handleCellClick = (staff, day) => {
    const dayStr = toLocalDateString(day);
    const dayShifts = assignedShifts.filter(s => s.staff_id === staff.id && toLocalDateString(s.shift_date) === dayStr);
    setCellModal({
      show: true,
      staff,
      date: day,
      existingShifts: dayShifts,
      selectedShiftId: masterShifts[0]?.id || '',
      isFlexible: false,
      customStart: '08:00',
      customEnd: '12:00',
    });
  };

  const handleShiftSelectChange = (shiftId) => {
    const selectedShift = masterShifts.find(s => s.id === shiftId);
    setCellModal(prev => ({
      ...prev,
      selectedShiftId: shiftId,
      customStart: selectedShift ? formatTime(selectedShift.start_time) : '08:00',
      customEnd: selectedShift ? formatTime(selectedShift.end_time) : '12:00',
    }));
  };

  // Create Assignment
  const handleAssignShift = async () => {
    const { staff, date, selectedShiftId, isFlexible, customStart, customEnd } = cellModal;
    
    let finalShiftId = selectedShiftId;
    if (isFlexible && !finalShiftId) {
      finalShiftId = masterShifts[0]?.id || '';
    }

    if (!finalShiftId) {
      showToast('Vui lòng chọn một ca làm việc.', 'error');
      return;
    }

    if (isFlexible) {
      if (!customStart || !customEnd) {
        showToast('Vui lòng chọn thời gian bắt đầu và kết thúc cho ca làm linh động.', 'error');
        return;
      }

      const startParts = customStart.split(':');
      const startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
      const endParts = customEnd.split(':');
      const endMin = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);

      // 6 AM is 360 minutes, 11 PM is 1380 minutes
      if (startMin < 360 || endMin > 1380 || startMin >= endMin) {
        showToast('Chọn giờ tùy chọn trong khoảng 6h sáng (06:00) tới 11h tối (23:00) và không qua đêm.', 'error');
        return;
      }

      const diffHours = (endMin - startMin) / 60;
      if (diffHours < 3 || diffHours > 16) {
        showToast('Thời gian ca làm việc linh động phải từ 3 đến 16 tiếng.', 'error');
        return;
      }
    }

    try {
      await hrApi.assignShift({
        staff_id: staff.id,
        shift_id: finalShiftId,
        shift_date: toLocalDateString(date),
        custom_start_time: isFlexible ? customStart : null,
        custom_end_time: isFlexible ? customEnd : null,
      });
      showToast('Phân công ca làm thành công.');
      setCellModal({ ...cellModal, show: false });
      loadCalendarData();
    } catch (err) {
      showToast(err.message || 'Phân ca thất bại.', 'error');
    }
  };

  // Change Assignment Status
  const handleChangeStatus = async (assignmentId, status) => {
    try {
      await hrApi.changeShiftStatus(assignmentId, status);
      showToast('Đã cập nhật trạng thái ca làm.');
      setCellModal({ ...cellModal, show: false });
      loadCalendarData();
    } catch (err) {
      showToast(err.message || 'Cập nhật thất bại.', 'error');
    }
  };

  // Delete Assignment
  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Bạn có chắc muốn xóa lịch phân ca này?')) return;
    try {
      await hrApi.deleteAssignedShift(assignmentId);
      showToast('Đã xóa phân ca làm việc.');
      setCellModal({ ...cellModal, show: false });
      loadCalendarData();
    } catch (err) {
      showToast(err.message || 'Xóa phân ca thất bại.', 'error');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Lịch làm việc nhân sự"
        description="Giao diện thời khóa biểu trực quan. Xem lịch đăng ký rảnh và xếp lịch làm việc trực tiếp cho từng nhân viên."
      />

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Week navigator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-surface-container-high)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handlePrevWeek} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ChevronLeft size={16} /> Tuần trước
            </button>
            <button className="btn btn-secondary" onClick={handleNextWeek} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Tuần sau <ChevronRight size={16} />
            </button>
          </div>
          <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '16px' }}>
            Thời khóa biểu: {formatDate(currentMonday)} - {formatDate(new Date(new Date(currentMonday).setDate(currentMonday.getDate() + 6)))}
          </h3>
          <button className="btn btn-secondary" onClick={loadCalendarData} disabled={isLoading}>Tải lại</button>
        </div>

        {/* Timetable Table */}
        {isLoading && staffList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Đang tải danh sách lịch làm việc...</div>
        ) : (
          <div className="table-container">
            <table className="data-table" style={{ minWidth: '950px', borderCollapse: 'collapse', border: '1px solid var(--color-surface-container-high)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
                  <th style={{ width: '180px', padding: '12px 10px', color: '#fff', border: '1px solid var(--color-surface-container-high)', textAlign: 'left' }}>Nhân viên</th>
                  {getWeekDays(currentMonday).map((day) => {
                    const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day.getDay()];
                    const dateLabel = `${day.getDate()}/${day.getMonth() + 1}`;
                    const isToday = toLocalDateString(new Date()) === toLocalDateString(day);
                    return (
                      <th key={day.toString()} style={{ textAlign: 'center', padding: '12px 10px', color: '#fff', border: '1px solid var(--color-surface-container-high)', backgroundColor: isToday ? 'var(--color-primary-container)' : 'var(--color-primary)' }}>
                        <div style={{ fontWeight: 'bold' }}>{dayName}</div>
                        <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.9 }}>{dateLabel}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-secondary)' }}>
                      Không có tài khoản nhân viên nào hoạt động.
                    </td>
                  </tr>
                ) : (
                  staffList.map((staff) => (
                    <tr key={staff.id}>
                      <td style={{ fontWeight: 'bold', border: '1px solid var(--color-surface-container-high)', padding: '12px 10px', verticalAlign: 'middle' }}>
                        <div style={{ color: 'var(--color-primary)' }}>{staff.fullName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-secondary)', fontWeight: 'normal', marginTop: '4px' }}>
                          @{staff.username}
                        </div>
                      </td>
                      {getWeekDays(currentMonday).map((day) => {
                        const dayStr = toLocalDateString(day);
                        const dayShifts = assignedShifts.filter(s => s.staff_id === staff.id && toLocalDateString(s.shift_date) === dayStr);
                        const dayAvails = availabilities.filter(a => a.staff_id === staff.id && toLocalDateString(a.available_date) === dayStr);

                        return (
                          <td
                            key={dayStr}
                            onClick={() => handleCellClick(staff, day)}
                            style={{
                              textAlign: 'center',
                              cursor: 'pointer',
                              border: '1px solid var(--color-surface-container-high)',
                              verticalAlign: 'middle',
                              transition: 'background-color 0.2s',
                              padding: '8px',
                              minHeight: '80px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--color-surface-container-low)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                               {dayShifts.map(s => {
                                 let statusColor = 'var(--color-primary)';
                                 let cellBg = 'rgba(235, 245, 255, 0.9)';
                                 if (s.status === 'COMPLETED') {
                                   statusColor = 'var(--color-status-success-text)';
                                   cellBg = 'rgba(235, 250, 240, 0.9)';
                                 } else if (s.status === 'ABSENT') {
                                   statusColor = 'var(--color-status-error-text)';
                                   cellBg = 'rgba(255, 240, 240, 0.9)';
                                 }
                                 return (
                                   <div key={s.id} style={{ padding: '4px 6px', borderRadius: 'var(--radius-xs)', backgroundColor: cellBg, border: '1px solid var(--color-surface-container-high)', fontSize: '11px' }}>
                                     <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{s.shift_name}</div>
                                     <div style={{ fontSize: '9px', color: 'var(--color-secondary)', marginTop: '2px' }}>
                                       {formatTime(s.custom_start_time || s.start_time)}-{formatTime(s.custom_end_time || s.end_time)}
                                       {s.custom_start_time && <span style={{ color: 'var(--color-tertiary-container)', fontWeight: 'bold', marginLeft: '2px' }}>*</span>}
                                     </div>
                                     <div style={{ fontSize: '9px', color: statusColor, fontWeight: '700', marginTop: '2px' }}>{s.status}</div>
                                   </div>
                                 );
                               })}

                              {dayAvails.map(a => (
                                <div key={a.id} style={{ padding: '4px', borderRadius: 'var(--radius-xs)', border: '1px dashed var(--color-primary)', backgroundColor: 'rgba(255, 248, 220, 0.5)', fontSize: '10px', color: 'var(--color-primary)' }}>
                                  <strong>Báo rảnh:</strong>
                                  <div>{formatTime(a.start_time)}-{formatTime(a.end_time)}</div>
                                </div>
                              ))}

                              {dayShifts.length === 0 && dayAvails.length === 0 && (
                                <span style={{ color: 'var(--color-secondary)' }}>-</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cell Assign / View Modal */}
      {cellModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '500px', backgroundColor: '#fff', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-surface-container-high)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '16px' }}>
                Xếp ca làm: {cellModal.staff.fullName} ({formatDate(cellModal.date)})
              </h3>
              <button
                onClick={() => setCellModal({ ...cellModal, show: false })}
                style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--color-secondary)' }}
              >
                &times;
              </button>
            </div>

            {/* List existing shifts on this day */}
            {cellModal.existingShifts.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Ca làm đã xếp:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cellModal.existingShifts.map(s => (
                    <div key={s.id} style={{ padding: '10px', border: '1px solid var(--color-surface-container-high)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-surface-container-lowest)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px' }}>
                        <strong>{s.shift_name}</strong> ({formatTime(s.custom_start_time || s.start_time)} - {formatTime(s.custom_end_time || s.end_time)})
                        {s.custom_start_time && <span style={{ color: 'var(--color-tertiary-container)', fontWeight: 'bold', marginLeft: '6px' }}>(Linh động)</span>}
                        <div style={{ marginTop: '2px' }}><StatusBadge status={s.status} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {s.status === 'ASSIGNED' && (
                          <>
                            <button
                              onClick={() => handleChangeStatus(s.id, 'COMPLETED')}
                              className="badge badge-success"
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              Hoàn thành
                            </button>
                            <button
                              onClick={() => handleChangeStatus(s.id, 'ABSENT')}
                              className="badge badge-error"
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              Vắng mặt
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteAssignment(s.id)}
                          style={{ color: 'var(--color-error)', border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form to assign new shift */}
            <div style={{ borderTop: '1px solid var(--color-surface-container-high)', paddingTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '13px' }}>Phân công ca làm mới:</h4>
              
              {/* Shift mode selection tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setCellModal(prev => ({ ...prev, isFlexible: false, selectedShiftId: prev.selectedShiftId || (masterShifts[0]?.id || '') }))}
                  className={`btn ${!cellModal.isFlexible ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '12px', textAlign: 'center', justifyContent: 'center' }}
                >
                  Ca cố định theo mẫu
                </button>
                <button
                  type="button"
                  onClick={() => setCellModal(prev => ({ ...prev, isFlexible: true, selectedShiftId: prev.selectedShiftId || (masterShifts[0]?.id || '') }))}
                  className={`btn ${cellModal.isFlexible ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '12px', textAlign: 'center', justifyContent: 'center' }}
                >
                  Ca linh động (Part-time)
                </button>
              </div>

              {/* Fixed shift option */}
              {!cellModal.isFlexible && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Chọn ca làm việc mẫu</label>
                  <select
                    className="form-control"
                    value={cellModal.selectedShiftId}
                    onChange={(e) => handleShiftSelectChange(e.target.value)}
                  >
                    <option value="">-- Chọn ca làm việc mẫu --</option>
                    {masterShifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatTime(s.start_time)} - {formatTime(s.end_time)}) - {formatVND(Number(s.hourly_rate))}/h
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Flexible shift option */}
              {cellModal.isFlexible && (
                <>
                  <div style={{ fontSize: '11px', color: 'var(--color-secondary)', marginBottom: '8px' }}>
                    * Ca làm việc linh động được tính đơn giá cố định <strong>25.000đ/giờ</strong>.
                    <br />
                    * Thời gian làm việc phải từ 3 đến 16 tiếng, trong khoảng 6:00 sáng đến 11:00 tối.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Từ giờ</label>
                      <input
                        type="time"
                        className="form-control"
                        value={cellModal.customStart}
                        onChange={(e) => setCellModal({ ...cellModal, customStart: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Đến giờ</label>
                      <input
                        type="time"
                        className="form-control"
                        value={cellModal.customEnd}
                        onChange={(e) => setCellModal({ ...cellModal, customEnd: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <Button onClick={handleAssignShift} variant="primary" icon={<Plus size={16} />} style={{ width: '100%' }}>
                Xếp ca làm việc
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button onClick={() => setCellModal({ ...cellModal, show: false })} variant="secondary">Đóng</Button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}

export default AdminCalendarPage;
