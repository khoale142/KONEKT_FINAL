import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { requireOwner, requireStoreContext } from '../../middlewares/role.middleware.js';
import * as hrController from './hr.controller.js';

const router = Router();

router.use(requireAuth, requireStoreContext());
router.get('/shifts', hrController.getShifts);
router.post('/shifts', requireOwner(), hrController.createNewShift);
router.put('/shifts/:id', requireOwner(), hrController.updateExistingShift);
router.delete('/shifts/:id', requireOwner(), hrController.deleteExistingShift);

// --- STAFF LIST ---
router.get('/staff', requireOwner(), hrController.getStaffList);

// --- AVAILABILITY ---
router.get('/availabilities', requireOwner(), hrController.getAvailabilities);
router.get('/my-availabilities', hrController.getMyAvailabilities);
router.post('/availabilities', hrController.createNewAvailability);
router.delete('/availabilities/:id', requireOwner(), hrController.deleteExistingAvailability);
router.delete('/my-availabilities/:id', hrController.deleteMyAvailability);

// --- SHIFT ASSIGNMENT ---
router.get('/assigned-shifts', requireOwner(), hrController.getAssignedShifts);
router.get('/my-assigned-shifts', hrController.getMyAssignedShifts);
router.post('/assigned-shifts', requireOwner(), hrController.assignNewShift);
router.patch('/assigned-shifts/:id/status', requireOwner(), hrController.changeShiftStatus);
router.delete('/assigned-shifts/:id', requireOwner(), hrController.deleteAssignedShift);

// --- REQUESTS ---
router.get('/requests', requireOwner(), hrController.getRequests);
router.get('/my-requests', hrController.getMyRequests);
router.post('/requests', hrController.createNewRequest);
router.patch('/requests/:id/process', requireOwner(), hrController.processExistingRequest);

// --- REPORTS ---
router.get('/reports/my-salary', hrController.getMySalary);
router.get('/reports/hr-costs', requireOwner(), hrController.getAdminHRCosts);

export default router;
