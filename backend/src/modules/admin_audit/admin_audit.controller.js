import {
  listAuditLogs,
  getAuditLogById,
  exportAuditLogs,
} from './admin_audit.service.js';
import { sendSuccess, sendError } from '../../utils/apiResponse.js';

export async function handleListAuditLogs(req, res, next) {
  try {
    const {
      search = '',
      actionType = 'ALL',
      scope = 'ALL',
      actorId = 'ALL',
      timeRange = '7D',
      page = 1,
      limit = 20,
    } = req.query;

    const result = await listAuditLogs({
      search,
      actionType,
      scope,
      actorId,
      timeRange,
      page,
      limit,
    });

    return sendSuccess(res, {
      message: 'Lấy danh sách nhật ký kiểm toán thành công',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetAuditLogById(req, res, next) {
  try {
    const { id } = req.params;
    const item = await getAuditLogById(id);
    if (!item) {
      return sendError(res, {
        status: 404,
        message: 'Không tìm thấy sự kiện kiểm toán',
      });
    }
    return sendSuccess(res, {
      message: 'Lấy chi tiết sự kiện kiểm toán thành công',
      data: item,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleExportAuditLogs(req, res, next) {
  try {
    const {
      search = '',
      actionType = 'ALL',
      scope = 'ALL',
      actorId = 'ALL',
      timeRange = 'ALL',
      format = 'csv',
    } = req.query;

    const content = await exportAuditLogs({
      search,
      actionType,
      scope,
      actorId,
      timeRange,
      format,
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.json`);
      return res.send(content);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    return res.send('\uFEFF' + content); // UTF-8 BOM for Excel compatibility
  } catch (error) {
    next(error);
  }
}

export default {
  handleListAuditLogs,
  handleGetAuditLogById,
  handleExportAuditLogs,
};
