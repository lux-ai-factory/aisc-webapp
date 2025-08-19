/** Dictionary type for mapping original names to display names */
type NameDictionary = { [key: string]: string };

/**
 * Maps an array of names using a dictionary
 * @param names - Array of original names to map
 * @param dictionary - Dictionary containing name mappings
 * @returns Array of mapped names, using original name if no mapping exists
 */
function mapNames(names: string[], dictionary: NameDictionary): string[] {
    return names.map(name => dictionary[name] || name);
}

/** Dictionary mapping metric names to their display names */
const metricNames: NameDictionary = {
    "mcc": "MCC",
    "test_get_metric": "Testing metric",
    "accuracy": "Accuracy"
};

/**
 * Maps metric names to their display names
 * @param metrics - Single metric name or array of metric names
 * @returns Mapped metric name(s) using the metricNames dictionary
 */
export function mapMetricsNames(metrics: string[] | string): string[] | string {
    if (typeof metrics === 'string') {
        return mapNames([metrics], metricNames)[0];
    }
    return mapNames(metrics, metricNames);
}

/**
 * Maps a single metric name to its display name
 * @param metrics - Single metric name to map
 * @returns Mapped metric name using the metricNames dictionary
 */
export function mapMetricsName(metrics: string): string {
    return mapNames([metrics], metricNames)[0];
}



const isArray = Array.isArray;
const keyList = Object.keys;
const hasProp = Object.prototype.hasOwnProperty;

export function isDeeplyEqual<T extends any>(a: T, b: T): boolean {
    if (a === b) { return true; }

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const arrA = isArray(a),
            arrB = isArray(b);
        let i, length, key;

        if (arrA && arrB) {
            length = a.length;
            if (length !== b.length) { return false; }
            for (i = length; i-- !== 0;) {
                if (!isDeeplyEqual(a[i], b[i])) { return false; }
            }
            return true;
        }

        if (arrA !== arrB) { return false; }

        const dateA = a instanceof Date,
            dateB = b instanceof Date;
        if (dateA !== dateB) { return false; }
        if (dateA && dateB) { return a.getTime() === b.getTime(); }

        const regexpA = a instanceof RegExp,
            regexpB = b instanceof RegExp;
        if (regexpA !== regexpB) { return false; }
        if (regexpA && regexpB) { return a.toString() === b.toString(); }

        const keys = keyList(a);
        length = keys.length;

        if (length !== keyList(b).length) {
            return false;
        }

        for (i = length; i-- !== 0;) {
            if (!hasProp.call(b, keys[i])) { return false; }
        }

        for (i = length; i-- !== 0;) {
            key = keys[i];
            if (!isDeeplyEqual((a as Record<string, any>)[key], (b as Record<string, any>)[key])) {
                return false;
            }
        }

        return true;
    }

    return a !== a && b !== b;
}

