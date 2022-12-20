//import Abra from "./Abra";
export {Interceptor, HttpMethod, AbraConfigs} from "./types";
export {Abra as AbraClass} from "./Abra";
import {Abra as AbraClass} from "./Abra";
export const Abra = AbraClass.getInstance;
export default Abra;

// TODO : handle errors so that data is not null
// TODO : add support for simple js
