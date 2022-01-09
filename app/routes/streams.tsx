import { useLoaderData } from "remix";
import { ungzip } from 'pako';

interface BaseNode {
    id: number,
    name: string,
}
interface MainNode extends BaseNode {
    startdate?: string;
    children: MainNode[],
    vod: VodNode[]
}
interface VodNode extends BaseNode {
    date?: string;
    frame_url: string;
}

const filterVod = (data: VodNode): VodNode | null => {
    const { id, name, frame_url, date } = data;
    const contains = (needle: string) => {
        return (name || '').indexOf(needle) >= 0;
    }
    if (!contains('Replay')) {
        if (contains('Best of') || contains('Press') || contains('Highlights') || contains('Zeroing') || contains('of the Week') || contains('Interviews') || contains('Throwback') || contains('This Week in') || contains('Target ') || contains('Ultimate Roommate') || contains('Being back') || contains('Last Time in')) {
            return null;
        }
    }
    return {
        id,
        name,
        frame_url,
        date,
    };
}
const filterChild = (level: number, data: MainNode): MainNode | null => {
    const { id, name, startdate } = data;
    const contains = (needle: string) => {
        return (name || '').indexOf(needle) >= 0;
    }
    if (level == 1) {
        if (contains('Youth') || contains('Junior') || contains('Summer')) {
            return null;
        }
        if (!contains('World') && !contains('Olympic')) {
            return null;
        }
        if (!contains('2021') && !contains('2022')) {
            return null;
        }
    }
    const children = (data.children || []).map(i => filterChild(level + 1, i)).filter(Boolean).map(i => i as MainNode).sort((a,b) => -a.name.localeCompare(b.name));
    const vod = (data.vod || []).map(filterVod).filter(Boolean) as VodNode[];
    return {
        id,
        name,
        startdate,
        children,
        vod,
    };
}

export const loader = async () => {
    const res = await fetch('https://www.eurovisionsports.tv/ibu/data.json.gz');
    const blob = await res.blob();
    const compressedData = await blob.arrayBuffer();
    const uncompressedData = await ungzip(new Uint8Array(compressedData));
    const uncompressedString = Buffer.from(uncompressedData).toString('utf-8').toString();
    console.log(`strlen: ${uncompressedString.length}`);
    const rawData = JSON.parse(uncompressedString);
    const filteredData = filterChild(0, rawData as MainNode);
    console.log(`filteredData: ${!!filteredData}`);
    return filteredData;
}

const RenderVod = ({ node }: { node: VodNode }) => {
    return (<>
        <a href={node.frame_url} target="_blank">{node.name}</a> 
        {node.date && (
            <> - {new Date(parseInt(node.date) * 1000).toLocaleString()}</>
        )}
    </>);
}

const RenderMain = ({ node, level }: { node: MainNode, level: number }) => {
    if (!node) {
        return null;
    }
    return (
        <div>
            {level > 0 && <p>
                {node.name}
                {node.startdate && (
                    <> - {new Date(parseInt(node.startdate) * 1000).toLocaleString()}</>
                )}
            </p> }
            <ul>
                {node.vod.map(i => <li key={i.id}><RenderVod node={i}/></li>)}
                {node.children.map(i => <li key={i.id}><RenderMain node={i} level={level+1}/></li>)}
            </ul>
        </div>
    )
}

export default () => {
    const data = useLoaderData() as MainNode;
    return <RenderMain node={data} level={0}/>;
}