import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { testConnection } from './config/db.js';
import authRoutes from './modules/auth/auth.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import ingredientRoutes from './modules/ingredients/ingredient.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import kdsRoutes from './modules/kds/kds.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import productRoutes from './modules/products/product.routes.js';
import recipeRoutes from './modules/recipes/recipe.routes.js';
import reportRoutes from './modules/reports/report.routes.js';
import stockRoutes from './modules/stock/stock.routes.js';
import hrRoutes from './modules/hr/hr.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import posSessionRoutes from './modules/pos_sessions/pos_session.routes.js';
import workspaceRoutes from './modules/workspaces/workspace.routes.js';
import tenantRoutes from './modules/tenants/tenant.routes.js';
import storeRoutes from './modules/stores/store.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import adminAuthRoutes from './modules/admin_auth/admin_auth.routes.js';
import adminDashboardRoutes from './modules/admin_dashboard/admin_dashboard.routes.js';
import adminTenantRoutes from './modules/admin_tenants/admin_tenant.routes.js';
import adminStoreRoutes from './modules/admin_stores/admin_store.routes.js';
import adminAccountRoutes from './modules/admin_accounts/admin_account.routes.js';
import adminInternalStaffRoutes from './modules/admin_internal_staff/admin_internal_staff.routes.js';
import adminAuditRoutes from './modules/admin_audit/admin_audit.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { sendSuccess } from './utils/apiResponse.js';

export const app = express();

app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/api/health', async (req, res, next) => {
  try {
    const db = await testConnection();
    return sendSuccess(res, {
      message: 'Mini Coffee POS API is running.',
      data: {
        service: 'backend',
        databaseTime: db.now,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/pos-sessions', posSessionRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/tenants', adminTenantRoutes);
app.use('/api/admin/stores', adminStoreRoutes);
app.use('/api/admin/accounts', adminAccountRoutes);
app.use('/api/admin/internal-staff', adminInternalStaffRoutes);
app.use('/api/admin/audit', adminAuditRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
