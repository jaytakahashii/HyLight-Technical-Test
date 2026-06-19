'use client';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type { PhotoInsert } from '@/lib/types/database';
import exifr from 'exifr';
import 'mapbox-gl/dist/mapbox-gl.css';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapboxMap, { Marker } from 'react-map-gl/mapbox';

type PhotoMarker = {
  id: string;
  storagePath: string;
  latitude: number;
  longitude: number;
  publicUrl: string;
};

const INITIAL_VIEW_STATE = {
  longitude: 139.767,
  latitude: 35.6812,
  zoom: 11,
};

export default function Map() {
  const supabase = useMemo(() => createClient(), []);

  return <MapShell supabase={supabase} />;
}

function MapShell({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMarkers = useCallback(async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('id, storage_path, latitude, longitude')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const nextMarkers = data.map((photo) => ({
      id: photo.id,
      storagePath: photo.storage_path,
      latitude: photo.latitude,
      longitude: photo.longitude,
      publicUrl: supabase.storage.from('photos').getPublicUrl(photo.storage_path).data.publicUrl,
    }));

    setMarkers(nextMarkers);
  }, [supabase]);

  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!isActive) {
          return;
        }

        setCurrentUserId(userData.user?.id ?? null);

        if (!userData.user) {
          setMarkers([]);
          setStatusMessage('Sign in to upload photos and load your private feed.');
          return;
        }

        await loadMarkers();

        if (isActive) {
          setStatusMessage(null);
        }
      } catch (error) {
        console.error('Error loading photos:', error);

        if (isActive) {
          setStatusMessage('Unable to load photos right now.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isActive = false;
    };
  }, [loadMarkers, supabase]);

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      if (!currentUserId) {
        setStatusMessage('You need to sign in before uploading a photo.');

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        return;
      }

      setIsUploading(true);
      setStatusMessage(null);

      try {
        const gpsData = await exifr.gps(file);
        const latitude = gpsData?.latitude;
        const longitude = gpsData?.longitude;

        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          setStatusMessage('No GPS data found in this image. Please upload a geotagged photo.');
          return;
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${currentUserId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const photoInsert: PhotoInsert = {
          user_id: currentUserId,
          storage_path: filePath,
          latitude,
          longitude,
        };

        const { data: savedPhoto, error: dbError } = await supabase
          .from('photos')
          .insert(photoInsert)
          .select('id, storage_path, latitude, longitude')
          .single();

        if (dbError) {
          throw dbError;
        }

        const publicUrl = supabase.storage.from('photos').getPublicUrl(savedPhoto.storage_path)
          .data.publicUrl;

        setMarkers((previousMarkers) => [
          {
            id: savedPhoto.id,
            storagePath: savedPhoto.storage_path,
            latitude: savedPhoto.latitude,
            longitude: savedPhoto.longitude,
            publicUrl,
          },
          ...previousMarkers,
        ]);

        setStatusMessage('Photo uploaded successfully.');
      } catch (error) {
        console.error('Error uploading photo:', error);
        setStatusMessage('Failed to upload photo.');
      } finally {
        setIsUploading(false);

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [currentUserId, supabase]
  );

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <div className="h-full w-full">
        <MapboxMap
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
          style={{ width: '100%', height: '100%' }}
        >
          {markers.map((marker) => (
            <Marker
              anchor="bottom"
              key={marker.id}
              latitude={marker.latitude}
              longitude={marker.longitude}
            >
              <div className="group relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/90 shadow-xl ring-2 ring-slate-950/20 transition-transform duration-200 hover:scale-110">
                <Image
                  alt="Geotagged photo marker"
                  className="object-cover"
                  fill
                  src={marker.publicUrl}
                  unoptimized // TODO: For local development, remove this in production and ensure the image is optimized
                />
              </div>
            </Marker>
          ))}
        </MapboxMap>
      </div>

      <div className="pointer-events-none absolute top-4 left-4 z-10 max-w-sm rounded-2xl bg-slate-950/80 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <p className="text-xs font-semibold tracking-[0.35em] text-cyan-300 uppercase">
          HyLight Map
        </p>
        <p className="mt-2 text-sm text-slate-200">
          Upload geotagged photos and pin them directly to the map.
        </p>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-300">
          <span>
            {isLoading
              ? 'Loading map...'
              : `${markers.length} photo${markers.length === 1 ? '' : 's'} on the map`}
          </span>
          {!currentUserId ? (
            <Link href="/login" className="pointer-events-auto text-cyan-300 hover:text-cyan-200">
              Sign in
            </Link>
          ) : null}
        </div>
        {statusMessage ? <p className="mt-3 text-sm text-amber-300">{statusMessage}</p> : null}
      </div>

      <div className="absolute right-6 bottom-6 z-10">
        <input
          ref={fileInputRef}
          accept="image/jpeg, image/png, image/webp"
          className="hidden"
          disabled={isUploading || !currentUserId}
          type="file"
          onChange={handleFileUpload}
        />
        <button
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isUploading || !currentUserId}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? 'Uploading...' : currentUserId ? 'Upload Photo' : 'Sign in to upload'}
        </button>
      </div>
    </div>
  );
}
