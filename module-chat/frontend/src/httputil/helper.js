import { isObject, isString } from 'lodash-es';
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export function joinTimestamp(join, restful = false) {
    if (!join) {
        return restful ? '' : {};
    }
    const now = new Date().getTime();
    if (restful) {
        return `?_t=${now}`;
    }
    return { _t: now };
}
/**
 * @description: Format request parameter time
 */
export function formatRequestDate(params) {
    if (Object.prototype.toString.call(params) !== '[object Object]') {
        return;
    }
    for (const key in params) {
        const format = params[key]?.format ?? null;
        if (format && typeof format === 'function') {
            params[key] = params[key].format(DATE_TIME_FORMAT);
        }
        if (isString(key)) {
            const value = params[key];
            if (value) {
                try {
                    params[key] = isString(value) ? value.trim() : value;
                }
                catch (error) {
                    throw new Error(error);
                }
            }
        }
        if (isObject(params[key])) {
            formatRequestDate(params[key]);
        }
    }
}
