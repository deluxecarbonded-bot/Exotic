import { useRef, useCallback, useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MediaSourceType } from '~/types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    // Free TURN servers for NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

// ─── Host WebRTC Hook ───
export function useWebRTCHost(
  streamId: string | undefined,
  userId: string | undefined,
  enabled: boolean = true,
) {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Viewers who joined before capture started — process once host-ready
  const pendingViewersRef = useRef<string[]>([]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);

  // ── Create or re-create peer connection for a viewer ──
  const createPeerForViewer = useCallback(
    async (viewerId: string) => {
      if (!localStreamRef.current || !channelRef.current) {
        // Host not ready yet — queue viewer
        if (!pendingViewersRef.current.includes(viewerId)) {
          pendingViewersRef.current.push(viewerId);
        }
        return;
      }

      peersRef.current.get(viewerId)?.close();

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peersRef.current.set(viewerId, pc);

      // Buffer ICE candidates from viewer before answer is received
      const pendingCandidates: RTCIceCandidateInit[] = [];
      let remoteSet = false;

      // Store flusher so we can call it after setRemoteDescription
      const flushCandidates = async () => {
        for (const c of pendingCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (e) {
            console.warn('[host] Failed to add buffered ICE candidate:', e);
          }
        }
        pendingCandidates.length = 0;
      };

      // Add all local tracks to the peer connection
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { candidate: e.candidate.toJSON(), from: userId, to: viewerId },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[host] Peer ${viewerId} state: ${pc.connectionState}`);
      };

      // Store per-peer candidate buffer in a closure via a custom property
      (pc as any)._pendingCandidates = pendingCandidates;
      (pc as any)._remoteSet = () => remoteSet;
      (pc as any)._setRemoteDone = async () => {
        remoteSet = true;
        await flushCandidates();
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channelRef.current.send({
        type: 'broadcast',
        event: 'offer',
        payload: { sdp: pc.localDescription, from: userId, to: viewerId },
      });
    },
    [userId],
  );

  // ── Capture media ──
  const startCapture = useCallback(
    async (
      mediaType: MediaSourceType,
      videoDeviceId?: string,
      audioDeviceId?: string,
    ) => {
      if (mediaType === 'none') return;
      setError('');
      setCapturing(true);

      try {
        let screen: MediaStream | undefined;
        let camera: MediaStream | undefined;
        let browser: MediaStream | undefined;
        let micStream: MediaStream | undefined;

        const videoConstraints: MediaTrackConstraints = videoDeviceId
          ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };

        const micConstraints: MediaTrackConstraints | boolean = audioDeviceId
          ? { deviceId: { exact: audioDeviceId } }
          : true;

        if (mediaType === 'screen' || mediaType === 'both') {
          screen = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 30 } },
            audio: !audioDeviceId,
          });
          setScreenStream(screen);
          screen.getVideoTracks()[0]?.addEventListener('ended', () => setScreenStream(null));
        }

        if (mediaType === 'browser' || mediaType === 'browser_camera') {
          browser = await navigator.mediaDevices.getDisplayMedia({
            video: {
              // @ts-ignore
              displaySurface: 'browser',
              frameRate: { ideal: 30 },
            },
            audio: !audioDeviceId,
            // @ts-ignore
            preferCurrentTab: false,
          });
          setScreenStream(browser);
          browser.getVideoTracks()[0]?.addEventListener('ended', () => setScreenStream(null));
        }

        if (mediaType === 'camera' || mediaType === 'both' || mediaType === 'browser_camera') {
          camera = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: mediaType === 'camera' ? micConstraints : false,
          });
          setCameraStream(camera);
        }

        if (audioDeviceId && (mediaType === 'screen' || mediaType === 'browser' || mediaType === 'both' || mediaType === 'browser_camera')) {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
            video: false,
          });
        }

        const combined = new MediaStream();

        if (mediaType === 'screen' && screen) {
          screen.getVideoTracks().forEach((t) => combined.addTrack(t));
          (micStream ?? screen).getAudioTracks().forEach((t) => combined.addTrack(t));
        } else if (mediaType === 'camera' && camera) {
          camera.getTracks().forEach((t) => combined.addTrack(t));
        } else if (mediaType === 'both') {
          if (screen) screen.getVideoTracks().forEach((t) => combined.addTrack(t));
          if (camera) camera.getVideoTracks().forEach((t) => combined.addTrack(t));
          (micStream ?? screen ?? camera)?.getAudioTracks().forEach((t) => combined.addTrack(t));
        } else if (mediaType === 'browser' && browser) {
          browser.getVideoTracks().forEach((t) => combined.addTrack(t));
          (micStream ?? browser).getAudioTracks().forEach((t) => combined.addTrack(t));
        } else if (mediaType === 'browser_camera') {
          if (browser) browser.getVideoTracks().forEach((t) => combined.addTrack(t));
          if (camera) camera.getVideoTracks().forEach((t) => combined.addTrack(t));
          (micStream ?? browser ?? camera)?.getAudioTracks().forEach((t) => combined.addTrack(t));
        }

        localStreamRef.current = combined;
        setLocalStream(combined);
        setCapturing(false);

        // ── Notify all waiting viewers that host is ready ──
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'host-ready',
            payload: { hostId: userId },
          });
        }

        // ── Process viewers who joined before capture started ──
        const pending = [...pendingViewersRef.current];
        pendingViewersRef.current = [];
        for (const viewerId of pending) {
          await createPeerForViewer(viewerId);
        }
      } catch (e: any) {
        console.error('[host] startCapture failed:', e);
        // Translate browser error names into friendly messages
        let msg: string;
        if (e?.name === 'NotAllowedError' || e?.message?.toLowerCase().includes('permission')) {
          msg = 'permission-denied';
        } else if (e?.name === 'NotFoundError') {
          msg = 'No camera or microphone found. Please connect a device and try again.';
        } else if (e?.name === 'NotReadableError') {
          msg = 'Your camera or microphone is already in use by another app. Close it and try again.';
        } else if (e?.name === 'OverconstrainedError') {
          msg = 'The selected device is no longer available. Try a different one.';
        } else {
          msg = e?.message ?? 'Failed to start capture';
        }
        setError(msg);
        setCapturing(false);
      }
    },
    [userId, createPeerForViewer],
  );

  // ── Signaling channel — host role ──
  useEffect(() => {
    if (!streamId || !userId || !enabled) return;

    const channelName = `webrtc-signal-${streamId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'viewer-join' }, ({ payload }) => {
        if (payload.viewerId && payload.viewerId !== userId) {
          createPeerForViewer(payload.viewerId);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        if (!pc || !payload.sdp) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          // Flush buffered ICE candidates now that remote description is set
          await (pc as any)._setRemoteDone?.();
        } catch (e) {
          console.error('[host] Failed to set remote description:', e);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        if (!pc || !payload.candidate) return;
        if ((pc as any)._remoteSet?.()) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('[host] Failed to add ICE candidate:', e);
          }
        } else {
          // Buffer candidate until remote description is set
          (pc as any)._pendingCandidates?.push(payload.candidate);
        }
      })
      .subscribe((status) => {
        console.log(`[host] Channel ${channelName} status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [streamId, userId, enabled, createPeerForViewer]);

  const stopCapture = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setCameraStream(null);
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    pendingViewersRef.current = [];
  }, []);

  return { localStream, screenStream, cameraStream, error, capturing, startCapture, stopCapture };
}

// ─── Viewer WebRTC Hook ───
export function useWebRTCViewer(
  streamId: string | undefined,
  userId: string | undefined,
  hostId: string | undefined,
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const sendJoin = useCallback(() => {
    if (!channelRef.current || !userId) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'viewer-join',
      payload: { viewerId: userId },
    });
    setConnecting(true);
  }, [userId]);

  const connect = useCallback(() => {
    if (!channelRef.current || !userId || !hostId || connecting || connected) return;
    sendJoin();
  }, [userId, hostId, connecting, connected, sendJoin]);

  // ── Signaling channel — viewer role ──
  useEffect(() => {
    if (!streamId || !userId || !hostId || userId === hostId) return;

    let destroyed = false;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    pendingCandidatesRef.current = [];
    remoteSetRef.current = false;

    const remoteMediaStream = new MediaStream();

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((track) => {
        if (!remoteMediaStream.getTrackById(track.id)) {
          remoteMediaStream.addTrack(track);
        }
      });
      if (!destroyed) {
        setRemoteStream(new MediaStream(remoteMediaStream.getTracks()));
        setConnected(true);
        setConnecting(false);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: e.candidate.toJSON(), from: userId, to: hostId },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[viewer] Connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (!destroyed) {
          setConnected(false);
          setConnecting(false);
          // Auto-retry after 2 seconds
          retryTimerRef.current = setTimeout(() => {
            if (!destroyed) sendJoin();
          }, 2000);
        }
      }
    };

    const channelName = `webrtc-signal-${streamId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          remoteSetRef.current = true;

          // Flush buffered ICE candidates
          for (const c of pendingCandidatesRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) {
              console.warn('[viewer] Failed to add buffered ICE candidate:', e);
            }
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { sdp: pc.localDescription, from: userId, to: payload.from },
          });
        } catch (e) {
          console.error('[viewer] Failed to handle offer:', e);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        if (!payload.candidate) return;
        if (remoteSetRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('[viewer] Failed to add ICE candidate:', e);
          }
        } else {
          // Buffer until remote description is set
          pendingCandidatesRef.current.push(payload.candidate);
        }
      })
      .on('broadcast', { event: 'host-ready' }, () => {
        // Host just started capturing — re-join to trigger offer
        if (!connected && !destroyed) {
          console.log('[viewer] Host is ready, sending viewer-join');
          sendJoin();
        }
      })
      .subscribe((status) => {
        console.log(`[viewer] Channel ${channelName} status: ${status}`);
        // Once subscribed, send join to notify host
        if (status === 'SUBSCRIBED') {
          sendJoin();
        }
      });

    channelRef.current = channel;

    return () => {
      destroyed = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      pc.close();
      pcRef.current = null;
      supabase.removeChannel(channel);
      channelRef.current = null;
      setRemoteStream(null);
      setConnected(false);
      setConnecting(false);
    };
  }, [streamId, userId, hostId]);

  return { remoteStream, connected, connecting, connect };
}
