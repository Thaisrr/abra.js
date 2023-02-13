export {Interceptor, HttpMethod, AbraConfigs} from "./types";
export {Abra} from "./Abra";

import {Abra as AbraClass} from "./Abra";

const Abra = AbraClass.getInstance();

export default Abra;


