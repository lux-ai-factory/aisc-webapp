import {useQuery} from '@tanstack/react-query'
import {API_VERSION_PREFIX} from "../config.tsx";
import {Link} from "react-router-dom";
import {useProject} from "../context/ProjectContext.tsx";

const API_URL = import.meta.env.VITE_API_URL + API_VERSION_PREFIX;


const getEvaluations = async (uuid: string) => {
    if (!uuid) throw new Error('Invalid uuid');
    const res = await fetch(`${API_URL}/projects/${uuid}/evaluations?status=Done`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
};

function PluginEvaluations() {
    const {projectUUID} = useProject();

    const {data: evaluations, isPending, error} = useQuery({
        queryKey: ['evaluations'],
        queryFn: () => getEvaluations(projectUUID ?? "")
    })

    if (isPending) return <span>Loading...</span>
    if (error) return <span>Oops!</span>


    return (
        <div>
            <h2>Evaluations:</h2>
            {evaluations && evaluations.map((evaluation: any) => (
                <li>
                    <Link to={`${evaluation["pid"]}`}>{evaluation["pid"]}</Link>
                    [{evaluation["status"]}]
                    ({evaluation["evaluation_plugins"].map(plugin => plugin.name).join(',')})
                </li>
            ))}
        </div>
    )
}

export default PluginEvaluations