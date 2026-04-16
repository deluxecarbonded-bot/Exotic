import { useRef, useCallback, useEffect, useState } from 'react';
import { supabase } from '~/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MediaSourceType } from '~/types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ─── Host WebRTC Hook ───
export function useWebRTCHost(streamId: string | undefined, userId: string | undefined, enabled: boolean = true) {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);

  const startCapture = useCallback(async (mediaType: MediaSourceType) => {
    if (mediaType === 'none') return;
    setError('');
    setCapturing(true);

    try {
      let screen: MediaStream | undefined;
      let camera: MediaStream | undefined;

      if (mediaType === 'screen' || mediaType === 'both') {
        screen = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true,
        });
        setScreenStream(screen);
        screen.getVideoTracks()[0]?.addEventListener('ended', () => {
          setScreenStream(null);
        });
      }

      if (mediaType === 'camera' || mediaType === 'both') {
        camera = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: mediaType === 'camera',
        });
        setCameraStream(camera);
      }

      const combined = new MediaStream();
      if (mediaType === 'screen' && screen) {
        screen.getTracks().forEach((t) => combined.addTrack(t));
      } else if (mediaType === 'camera' && camera) {
        camera.getTracks().forEach((t) => combined.addTrack(t));
      } else if (mediaType === 'both') {
        if (screen) screen.getVideoTracks().forEach((t) => combined.addTrack(t));
        if (camera) camera.getVideoTracks().forEach((t) => combined.addTrack(t));
        const audioTracks = screen?.getAudioTracks().length
          ? screen.getAudioTracks()
          : camera?.getAudioTracks() ?? [];
        audioTracks.forEach((t) => combined.addTrack(t));
      }

      localStreamRef.current = combined;
      setLocalStream(combined);
      setCapturing(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start capture');
      setCapturing(false);
    }
  }, []);

  const createPeerForViewer = useCallback(async (viewerId: string) => {
    if (!localStreamRef.current || !channelRef.current) return;

    peersRef.current.get(viewerId)?.close();

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current.set(viewerId, pc);

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

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channelRef.current.send({
      type: 'broadcast',
      event: 'offer',
      payload: { sdp: pc.localDescription, from: userId, to: viewerId },
    });
  }, [userId]);

  // Signaling channel — host role
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
        if (pc && payload.sdp) {
          try { await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch {}
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peersRef.current.get(payload.from);
        if (pc && payload.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
        }
      })
      .subscribe();

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
  }, []);

  return { localStream, screenStream, cameraStream, error, capturing, startCapture, stopCapture };
}

// ─── Viewer WebRTC Hook ───
export function useWebRTCViewer(streamId: string | undefined, userId: string | undefined, hostId: string | undefined) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(() => {
    if (!channelRef.current || !userId || !hostId || connecting || connected) return;
    setConnecting(true);
    channelRef.current.send({
      type: 'broadcast',
      event: 'viewer-join',
      payload: { viewerId: userId },
    });
  }, [userId, hostId, connecting, connected]);

  // Signaling channel — viewer role
  useEffect(() => {
    // Don't set up viewer WebRTC if this user is the host
    if (!streamId || !userId || !hostId || userId === hostId) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    const stream = new MediaStream();

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((track) => {
        stream.addTrack(track);
      });
      setRemoteStream(new MediaStream(stream.getTracks()));
      setConnected(true);
      setConnecting(false);
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
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnected(false);
        setConnecting(false);
      }
    };

    // Use a viewer-specific channel that broadcasts to the same stream topic
    // The host listens on `webrtc-signal-${streamId}` and viewer sends to it
    const channelName = `webrtc-signal-${streamId}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { sdp: pc.localDescription, from: userId, to: payload.from },
          });
        } catch {}
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== userId) return;
        if (payload.candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {}
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Auto-request connection after channel is ready
    const timer = setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'viewer-join',
        payload: { viewerId: userId },
      });
      setConnecting(true);
    }, 800);

    return () => {
      clearTimeout(timer);
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
