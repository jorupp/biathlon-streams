import { LoaderFunction } from "remix";
import { userAgent } from "~/constants";

const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': userAgent,
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Connection': 'keep-alive',
}

export async function loader({ params }: Parameters<LoaderFunction>[0]) {
    const { embedKey } = params;
    if (embedKey){
        const referer = `https://ebu-emp.ebu.ch/embed/${embedKey}?shareLink=https%3A%2F%2Fwww.eurovisionsports.tv%2Fibu%23${embedKey}`
        const playUrl = `https://ebu-emp.ebu.ch/play/${embedKey}?_=${new Date().getTime()}`;

        const playData = await (await fetch(playUrl, {
            headers: {
                ...headers,
                Referer: referer,
            }
        })).json();

        if (playData && playData.url) {
            // TODO: investigate whether we could just send all of what we're doing here to node-hls-downloader as header parameters and ditch all this code...
            //       I _think_ we'd have to keep the part to this point and pass playData.url to node-hls-downloader w/ the user-agent header
                
            const masterUrl = playData.url;
            const masterData = await (await fetch(masterUrl, {
                headers: {
                    ...headers,
                    Referer: referer,
                }
            })).text();

            const streams = [];
            let stream: null | { bandwidth?: number, url?: string } = null;
            const masterDataRows = masterData.split(/[\r\n]/);
            // TODO: we're ignoring the EXT-X-I-FRAME-STREAM-INF entries here - based on https://github.com/grafov/m3u8/issues/91 they appear to be a seek index, which we don't need
            for(const row of masterDataRows) {
                if (row.indexOf("BANDWIDTH") >= 0) {
                    if (stream) {
                        streams.push(stream);
                    }
                    stream = {};
                    const metadata = Object.fromEntries(row.split(',').map(i => i.split('=')));
                    // console.log(JSON.stringify(metadata, null, 2));
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

            // console.log(streams);

            if (streams.length > 0) {
                // use masterUrl as the base here - it has a ~1d expiration, while playData.url has a ~1m expiration
                const streamUrl = new URL(streams[0].url!, masterUrl).href;
                const streamData = await (await fetch(streamUrl, {
                    headers: {
                        ...headers,
                        Referer: referer,
                    }
                })).text();

                // rewrite the URLs to be absolute
                const prefix = new URL('.', streamUrl).href;
                // console.log({ referer, playUrl, masterUrl, streamUrl, prefix });
                const outputStreamData = [];
                for(const streamLine of streamData.split('\n')) {
                    if (streamLine.startsWith('#')) {
                        outputStreamData.push(streamLine);
                    } else if (streamLine) {
                        outputStreamData.push(prefix + streamLine);
                    }
                }
                
                return new Response(outputStreamData.join('\n'), {
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