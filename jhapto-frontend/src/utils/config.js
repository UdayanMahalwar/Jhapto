import api from './api';

// Public server settings (Google client id, Firebase web config …), fetched once
let configPromise = null;

export const getConfig = () => {
  configPromise ??= api.get('/config').then((r) => r.data).catch(() => {
    configPromise = null;   // try again next time
    return {};
  });
  return configPromise;
};
