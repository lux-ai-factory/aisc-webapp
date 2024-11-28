type NameDictionary = { [key: string]: string };

function mapNames(names: string[], dictionary: NameDictionary): string[] {
    return names.map(name => dictionary[name] || name);
}

// Example usage:
const metricNames: NameDictionary = {
    "mcc": "MCC",
    "test_get_metric": "Testing metric",
    "accuracy": "Accuracy"
};

export function mapMetricsNames(metrics: string[] | string): string[] | string {
    if (typeof metrics === 'string') {
        return mapNames([metrics], metricNames)[0];
    }
    return mapNames(metrics, metricNames);
}
