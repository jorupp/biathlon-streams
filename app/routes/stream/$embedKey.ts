import { LoaderFunction } from "remix";

const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Connection': 'keep-alive',
}

export async function loader({ params }: Parameters<LoaderFunction>[0]) {
    const { embedKey } = params;
    if (embedKey){
        const referer = `https://ebu-emp.ebu.ch/embed/${embedKey}`
        const playUrl = `https://ebu-emp.ebu.ch/play/${embedKey}?_=${new Date().getTime()}`;

        const playData = await (await fetch(playUrl, {
            headers: {
                ...headers,
                Referer: referer,
            }
        })).json();

        if (playData && playData.url) {
                
            const masterData = await (await fetch(playData.url, {
                headers: {
                    ...headers,
                    Referer: referer,
                }
            })).text();

            const streams = [];
            let stream: null | { bandwidth?: number, url?: string } = null;
            const masterDataRows = masterData.split(/[\r\n]/);
            for(const row of masterDataRows) {
                if (row.indexOf("BANDWIDTH") >= 0) {
                    if (stream) {
                        streams.push(stream);
                    }
                    stream = {};
                    const metadata = Object.fromEntries(row.split(',').map(i => i.split('=')));
                    console.log(JSON.stringify(metadata, null, 2));
                    if (metadata.BANDWIDTH) {
                        stream.bandwidth = parseInt(metadata.BANDWIDTH);
                    }
                } else if (row && row.indexOf('#') != 0) {
                    if (stream) {
                        stream.url = row;
                    }
                }
            }
            if (stream) {
                streams.push(stream);
            }

            streams.sort((a,b) => (a.bandwidth ?? 0) > (b.bandwidth ?? 0) ? -1 : 1);

            if (streams.length > 0) {
                
                const streamData = await (await fetch(streams[0].url!, {
                    headers: {
                        ...headers,
                        Referer: referer,
                    }
                })).text();
                
                return new Response(streamData, {
                    status: 200,
                    headers: {
                        'Content-Type': "application/vnd.apple.mpegurl"
                    }
                });

            } else {
                return new Response("Cannot decode master data: " + JSON.stringify(masterDataRows, null, 2), {
                    status: 500,
                    headers: {
                        'Content-Type': "text/plain"
                    }
                });
            }
        }

        return new Response("Failed to fetch play data", {
            status: 500,
            headers: {
                'Content-Type': "text/plain"
            }
        });
    }
        
    return new Response("Unknown embedKey", {
        status: 500,
        headers: {
            'Content-Type': "text/plain"
        }
    });
}