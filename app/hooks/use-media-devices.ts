import { useState, useEffect } from 'react';

export interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

export interface UseMediaDevicesResult {
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  loading: boolean;
  permissionDenied: boolean;
  refresh: () => Promise<void>;
}

export function useMediaDevices(): UseMediaDevicesResult {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setPermissionDenied(false);

    try {
      // Request permission so browsers reveal device labels
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // If denied, we still try to enumerate (labels will be empty)
      setPermissionDenied(true);
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));

      const microphones = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${i + 1}`,
        }));

      setCameras(cams);
      setMics(microphones);
    } catch {
      setCameras([]);
      setMics([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // Re-enumerate when devices change (plugged in/out)
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, []);

  return { cameras, mics, loading, permissionDenied, refresh };
}
