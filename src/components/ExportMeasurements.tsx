interface ExportMeasurementsProps {
    data: any[];
    filename: string;
}

const ExportMeasurements = (props: ExportMeasurementsProps) => {

    const handleExport = () => {
        if (!props.data || props.data.length === 0) return;

        const headers = Object.keys(props.data[0]);

        const csvContent = [
            headers.join(','),
            ...props.data.map((row: any) =>
                headers.map(header => row[header]).join(',')
            )
        ].join('\n');


        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);

        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${props.filename}.csv`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <button onClick={handleExport}>
            Download CSV
        </button>
    );
};

export default ExportMeasurements;