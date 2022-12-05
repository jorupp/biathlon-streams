// keep this up to date with Chrome releases to avoid 403s when using node-hls-downloader
export const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36';
// parallel downloads for node-hls-downloader - this needs to be relatively high to get them all downloaded before the token times out
export const parallelStreams = 200;