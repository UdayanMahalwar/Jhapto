// Order list tabs and the query params sent to GET /orders/my and /orders/selling

export const STATUSES_FOR_TAB = {
  active : ['Placed', 'Confirmed'],
  history: ['Delivered', 'Cancelled'],
};

export const EMPTY_FILTERS = { status: '', from: '', to: '' };

export const orderFilterParams = (tab, filters) => {
  const params = { status: filters.status || STATUSES_FOR_TAB[tab].join(',') };
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return params;
};
