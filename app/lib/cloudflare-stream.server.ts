const CF_API = 'https://api.cloudflare.com/client/v4';

export interface LiveInputResult {
  uid: string;
  rtmpUrl: string;   // rtmp://live.cloudflare.com/live/
  rtmpKey: string;   // stream key
  rtmpsUrl: string;  // rtmps://live.cloudflare.com/live/
  rtmpsKey: string;  // stream key (same value)
  hlsUrl: string;    // HLS manifest URL (contains customer subdomain)
  embedUrl: string;  // iframe embed URL
}

export async function createLiveInput(
  accountId: string,
  token: string,
  name: string,
): Promise<LiveInputResult> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/stream/live_inputs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ meta: { name } }),
  });

  const json: any = await res.json();
  if (!json.success) {
    throw new Error(json.errors?.[0]?.message ?? 'Cloudflare Stream API error');
  }

  const r = json.result;
  const hlsUrl: string = r.hlsManifest ?? '';
  const embedUrl = hlsUrl.replace('/manifest/video.m3u8', '/iframe');

  return {
    uid: r.uid,
    rtmpUrl: r.rtmp.url,
    rtmpKey: r.rtmp.streamKey,
    rtmpsUrl: r.rtmps.url,
    rtmpsKey: r.rtmps.streamKey,
    hlsUrl,
    embedUrl,
  };
}

export async function deleteLiveInput(
  accountId: string,
  token: string,
  uid: string,
): Promise<void> {
  await fetch(`${CF_API}/accounts/${accountId}/stream/live_inputs/${uid}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
}
