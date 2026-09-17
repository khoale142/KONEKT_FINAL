export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  WORKSPACES: '/workspaces',
  PROFILE: '/profile',
  
  // Owner routes
  OWNER_DASHBOARD: '/owner/dashboard',
  OWNER_STORES: '/owner/stores',
  OWNER_PRODUCTS: '/owner/products',
  OWNER_PRODUCTS_NEW: '/owner/products/new',
  OWNER_PRODUCTS_EDIT: '/owner/products/:id/edit',
  OWNER_INGREDIENTS: '/owner/ingredients',
  OWNER_INGREDIENTS_NEW: '/owner/ingredients/new',
  OWNER_INGREDIENTS_EDIT: '/owner/ingredients/:id/edit',
  OWNER_RECIPES: '/owner/products?tab=recipes',
  OWNER_RECIPES_NEW: '/owner/recipes/new',
  OWNER_RECIPES_EDIT: '/owner/recipes/:id/edit',
  OWNER_REPORTS: '/owner/reports',
  OWNER_USERS: '/owner/hr?tab=users',

  // Store routes
  STORE_POS: '/store/pos',
  STORE_KDS: '/store/kds',
  STORE_ORDERS: '/store/orders',
  STORE_ORDERS_DETAIL: '/store/orders/:id',
  STORE_SESSION: '/store/session',
  STORE_STOCK: '/store/stock',
  STORE_STOCK_TRANSACTIONS: '/store/stock?tab=transactions',
  STORE_STOCK_FORECAST: '/store/stock?tab=forecast',
  STORE_HR_ATTENDANCE: '/store/hr/attendance',
};
