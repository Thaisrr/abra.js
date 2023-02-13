export {Interceptor, HttpMethod, AbraConfigs} from "./types";
export {Abra} from "./Abra";

import {Abra} from "./Abra";

function getAbra() {
    return Abra.getInstance();
}

export default getAbra();


