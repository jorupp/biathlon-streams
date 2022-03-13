import { useLoaderData } from "remix";
import { ungzip } from 'pako';
import styles from '~/styles/streams.css';
import { useCallback, useState } from "react";
import { max } from 'lodash';

export const links = () => {
    return [{ rel: "stylesheet", href: styles }];
  };
  
interface BaseNode {
    id: number,
    name: string,
}
interface MainNode extends BaseNode {
    startdate?: string;
    latestdate?: number;
    children: MainNode[],
    vod: VodNode[]
}
interface VodNode extends BaseNode {
    date?: string;
    frame_url: string;
    isReplay: boolean;
    isHighlights: boolean;
}

const filterVod = (data: VodNode): VodNode | null => {
    const { id, name, frame_url, date } = data;
    const contains = (needle: string) => {
        return (name || '').indexOf(needle) >= 0;
    }
    const isReplay = contains('Replay'); // || !(contains('Best of') || contains('Press') || contains('Highlights') || contains('Zeroing') || contains('of the Week') || contains('Interview') || contains('Throwback') || contains('This Week in') || contains('Target ') || contains('Ultimate Roommate') || contains('Being back') || contains('Last Time in') || contains('wins'));
    const isHighlights = contains('Highlights');
    return {
        id,
        name,
        frame_url,
        date,
        isReplay,
        isHighlights,
    };
}
const filterChild = (level: number, data: MainNode): MainNode | null => {
    const { id, name, startdate } = data;
    const contains = (needle: string) => {
        return (name || '').indexOf(needle) >= 0;
    }
    // if (level == 1) {
    //     if (contains('Youth') || contains('Junior') || contains('Summer')) {
    //         return null;
    //     }
    //     if (!contains('World') && !contains('Olympic')) {
    //         return null;
    //     }
    //     if (!contains('2021') && !contains('2022')) {
    //         return null;
    //     }
    // }
    const children = (data.children || []).map(i => filterChild(level + 1, i)).filter(Boolean).map(i => i as MainNode).sort((a,b) => (b.latestdate ?? 0)-(a.latestdate ?? 0));
    const vod = (data.vod || []).map(filterVod).filter(Boolean) as VodNode[];
    const latestdate = max(children.map(i => i.latestdate).concat(vod.map(i => i.date ? parseInt(i.date) : undefined)).concat([startdate ? parseInt(startdate) : undefined]).filter(Boolean));
    return {
        id,
        name,
        startdate,
        latestdate,
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
    const rawData = JSON.parse(uncompressedString);
    const filteredData = filterChild(0, rawData as MainNode) as MainNode;
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
    const [ expanded, setExpanded ] = useState(level === 0);
    const toggleExpanded = useCallback(() => setExpanded(v => !v), [ setExpanded ]);

    const [ highlightsExpanded, setHighlightsExpanded ] = useState(false);
    const toggleHighlightsExpanded = useCallback(() => setHighlightsExpanded(v => !v), [ setHighlightsExpanded ]);

    const [ otherExpanded, setOtherExpanded ] = useState(false);
    const toggleOtherExpanded = useCallback(() => setOtherExpanded(v => !v), [ setOtherExpanded ]);

    if (!node) {
        return null;
    }

    let replays = node.vod.filter(i => i.isReplay);
    let highlights = node.vod.filter(i => i.isHighlights);
    let otherVod = node.vod.filter(i => !i.isReplay && !i.isHighlights);

    // if there are _only_ other VODs, just use them as the main thing
    if(!replays.length && otherVod.length) {
        replays = otherVod;
        otherVod = [];
    }

    return (
        <div>
            {level > 0 && <p className="expandable" onClick={toggleExpanded}>
                {node.name}
                {node.startdate && (
                    <> - {new Date(parseInt(node.startdate) * 1000).toLocaleString()}</>
                )}
                {node.latestdate && (
                    <> - {new Date(node.latestdate * 1000).toLocaleString()}</>
                )}
            </p> }
            <ul className={ expanded ? 'collapsible' : 'collapsed'}>
                {node.children.map(i => <li key={i.id}><RenderMain node={i} level={level+1}/></li>)}
                {replays.map(i => <li key={i.id}><RenderVod node={i}/></li>)}
                { !!highlights.length && (<>
                    <li>
                        <span className="expandable" onClick={toggleHighlightsExpanded}>Highlights {highlights.length} videos &gt;</span>
                        <div>
                            <ul className={ highlightsExpanded ? 'collapsible' : 'collapsed'}>
                                {highlights.map(i => <li key={i.id}><RenderVod node={i}/></li>)}
                            </ul>
                        </div>
                    </li>                
                </>)}
                { !!otherVod.length && (<>
                    <li>
                        <span className="expandable" onClick={toggleOtherExpanded}>Other {otherVod.length} videos &gt;</span>
                        <div>
                            <ul className={ otherExpanded ? 'collapsible' : 'collapsed'}>
                                {otherVod.map(i => <li key={i.id}><RenderVod node={i}/></li>)}
                            </ul>
                        </div>
                    </li>                
                </>)}
            </ul>
        </div>
    )
}

export default () => {
    const data = useLoaderData<Awaited<ReturnType<typeof loader>>>();
    return <RenderMain node={data} level={0}/>;
}