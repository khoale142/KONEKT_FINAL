import { Router } from 'express';
import {
  handleListAuditLogs,
  handleGetAuditLogById,
  handleExportAuditLogs,
} from './admin_audit.controller.js';
import { requireAdminAuth } from '../../middlewares/adminAuth.middleware.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/', handleListAuditLogs);
router.get('/export', handleExportAuditLogs);
router.get('/:id', handleGetAuditLogById);

export default router;
