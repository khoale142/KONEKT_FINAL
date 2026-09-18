import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireStoreManager, requireStoreContext } from '../../middlewares/role.middleware.js';
import * as hrController from './hr.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());
router.get('/shifts', hrController.getShifts);
router.post('/shifts', requireStoreManager(), hrController.createNewShift);
router.put('/shifts/:id', requireStoreManager(), hrController.updateExistingShift);
router.delete('/shifts/:id', requireStoreManager(), hrController.deleteExistingShift);

// --- STAFF LIST ---
router.get('/staff', hrController.getStaffList);

// --- AVAILABILITY ---
router.get('/availabilities', requireStoreManager(), hrController.getAvailabilities);
router.get('/my-availabilities', hrController.getMyAvailabilities);
router.post('/availabilities', hrController.createNewAvailability);
router.delete('/availabilities/:id', requireStoreManager(), hrController.deleteExistingAvailability);
router.delete('/my-availabilities/:id', hrController.deleteMyAvailability);

// --- SHIFT ASSIGNMENT ---
router.get('/assigned-shifts', requireStoreManager(), hrController.getAssignedShifts);
router.get('/my-assigned-shifts', hrController.getMyAssignedShifts);
router.post('/assigned-shifts', requireStoreManager(), hrController.assignNewShift);
router.patch('/assigned-shifts/:id/status', requireStoreManager(), hrController.changeShiftStatus);
router.delete('/assigned-shifts/:id', requireStoreManager(), hrController.deleteAssignedShift);

// --- REQUESTS ---
router.get('/requests', requireStoreManager(), hrController.getRequests);
router.get('/my-requests', hrController.getMyRequests);
router.post('/requests', hrController.createNewRequest);
router.patch('/requests/:id/process', requireStoreManager(), hrController.processExistingRequest);

// --- REPORTS ---
router.get('/reports/my-salary', hrController.getMySalary);
router.get('/reports/hr-costs', requireStoreManager(), hrController.getAdminHRCosts);

export default router;
