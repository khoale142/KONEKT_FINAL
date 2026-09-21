import { apiClient } from '../../../services/apiClient.js';

function withOperationId(data = {}) {
  if (!data.operationId) data.operationId = crypto.randomUUID();
  return data;
}

function buildQueryString(filters = {}) {
  const query = new URLSearchParams();

  if (filters.ingredientId) {
    query.set('ingredientId', filters.ingredientId);
  }

  if (filters.type && filters.type !== 'ALL') {
    query.set('type', filters.type);
  }

  if (filters.dateFrom) {
    query.set('dateFrom', filters.dateFrom);
  }

  if (filters.dateTo) {
    query.set('dateTo', filters.dateTo);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export const stockApi = {
  importStock(data) {
    return apiClient.post('/stock/import', withOperationId(data));
  },
  importStockBatch(data) {
    return apiClient.post('/stock/import-batch', withOperationId(data));
  },
  adjustStock(data) {
    return apiClient.post('/stock/adjust', withOperationId(data));
  },
  countDailyStock(data) {
    return apiClient.post('/stock/count', withOperationId(data));
  },
  getTransactions(filters = {}) {
    return apiClient.get(`/stock/transactions${buildQueryString(filters)}`);
  },
  getForecast() {
    return apiClient.get('/stock/forecast');
  },
  discardStock(data) {
    return apiClient.post('/stock/discard', withOperationId(data));
  },
  producePreparation(data) {
    return apiClient.post('/stock/produce', withOperationId(data));
  },
};

export default stockApi;
