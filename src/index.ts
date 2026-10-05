export type { Interceptor, HttpMethod, AbraConfigs } from './types.js';
export { Abra } from './Abra.js';
export { AbraError } from './AbraError.js';

import { Abra as AbraClass } from './Abra.js';

const abra = AbraClass.getInstance();

export default abra;