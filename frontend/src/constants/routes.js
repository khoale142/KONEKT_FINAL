export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  WORKSPACES: '/workspaces',
  PROFILE: '/profile',
  
  // Tenant owner routes
  OWNER_DASHBOARD: '/owner/stores',
  OWNER_STORES: '/owner/stores',

  // Store routes
  STORE_DASHBOARD: '/store/dashboard',
  STORE_POS: '/store/pos',
  STORE_KDS: '/store/kds',
  STORE_ORDERS: '/store/orders',
  STORE_ORDERS_DETAIL: '/store/orders/:id',
  STORE_SESSION: '/store/session',
  STORE_STOCK: '/store/stock',
  STORE_STOCK_TRANSACTIONS: '/store/stock?tab=transactions',
  STORE_STOCK_FORECAST: '/store/stock?tab=forecast',
  STORE_PRODUCTS: '/store/products',
  STORE_PRODUCTS_NEW: '/store/products/new',
  STORE_INGREDIENTS: '/store/ingredients',
  STORE_INGREDIENTS_NEW: '/store/ingredients/new',
  STORE_RECIPES: '/store/products?tab=recipes',
  STORE_RECIPES_NEW: '/store/recipes/new',
  STORE_REPORTS: '/store/reports',
  STORE_HR: '/store/hr',
  STORE_MANAGER_HR: '/store/manager-hr',
  STORE_HR_CALENDAR: '/store/manager-hr/calendar',
  STORE_HR_ATTENDANCE: '/store/hr/attendance',
};
