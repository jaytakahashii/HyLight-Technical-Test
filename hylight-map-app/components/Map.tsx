'use client';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import type { PhotoInsert } from '@/lib/types/database';
import type { Database } from '@/lib/types/database.types';
import exifr from 'exifr';
import type { CircleLayer, GeoJSONSource, SymbolLayer } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MapMouseEvent, MapRef } from 'react-map-gl/mapbox';
import MapboxMap, { Layer, Source } from 'react-map-gl/mapbox';

type PhotoComment = Database['public']['Tables']['comments']['Row'];

type PhotoMarker = Database['public']['Tables']['photos']['Row'] & { publicUrl: string };

const INITIAL_VIEW_STATE = {
  longitude: 139.767,
  latitude: 35.6812,
  zoom: 11,
};

// --- Mapbox Layer Styles ---
const clusterLayer: CircleLayer = {
  id: 'clusters',
  type: 'circle',
  source: 'photos',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': ['step', ['get', 'point_count'], '#06b6d4', 10, '#3b82f6', 50, '#6366f1'],
    'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 50, 40],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#fff',
  },
};

const clusterCountLayer: SymbolLayer = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'photos',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
    'text-size': 14,
  },
  paint: {
    'text-color': '#ffffff',
  },
};

const unclusteredPointLayer: CircleLayer = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'photos',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': '#06b6d4',
    'circle-radius': 10,
    'circle-stroke-width': 3,
    'circle-stroke-color': '#fff',
  },
};

export default function Map() {
  const supabase = useMemo(() => createClient(), []);
  return <MapShell supabase={supabase} />;
}

function MapShell({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const mapRef = useRef<MapRef>(null);
  const [markers, setMarkers] = useState<PhotoMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // State for the currently selected photo to show in the modal
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoMarker | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMarkers = useCallback(async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const nextMarkers: PhotoMarker[] = (data || []).map((photo) => ({
      ...photo,
      publicUrl: supabase.storage.from('photos').getPublicUrl(photo.storage_path).data.publicUrl,
    }));

    setMarkers(nextMarkers);
  }, [supabase]);

  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!isActive) return;

        setCurrentUserId(userData.user?.id ?? null);
        setCurrentUserEmail(userData.user?.email ?? null);

        if (!userData.user) {
          setMarkers([]);
          setStatusMessage('Sign in to upload photos and load your private feed.');
          return;
        }

        await loadMarkers();

        if (isActive) setStatusMessage(null);
      } catch (error) {
        console.error('Error loading photos:', error);
        if (isActive) setStatusMessage('Unable to load photos right now.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    initialize();

    return () => {
      isActive = false;
    };
  }, [loadMarkers, supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
      setStatusMessage('Failed to sign out. Please try again.');
    }
  };

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!currentUserId) {
        setStatusMessage('You need to sign in before uploading a photo.');
        if (fileInputRef.current) fileInputRef.current.value = '';
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
          .upload(filePath, file, { contentType: file.type, upsert: false });

        if (uploadError) throw uploadError;

        const photoInsert: PhotoInsert = {
          user_id: currentUserId,
          storage_path: filePath,
          latitude,
          longitude,
        };

        const { data: savedPhoto, error: dbError } = await supabase
          .from('photos')
          .insert(photoInsert)
          .select('*')
          .single();

        if (dbError) throw dbError;

        const publicUrl = supabase.storage.from('photos').getPublicUrl(savedPhoto.storage_path)
          .data.publicUrl;

        const newMarker: PhotoMarker = {
          ...savedPhoto,
          publicUrl,
        };

        setMarkers((previousMarkers) => [newMarker, ...previousMarkers]);
        setStatusMessage('Photo uploaded successfully.');
      } catch (error) {
        console.error('Error uploading photo:', error);
        setStatusMessage('Failed to upload photo.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [currentUserId, supabase]
  );

  // --- GeoJSON Data Processing ---
  const geoJsonData = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: markers.map((marker) => ({
        type: 'Feature' as const,
        properties: {
          markerId: marker.id,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [marker.longitude, marker.latitude],
        },
      })),
    };
  }, [markers]);

  // --- Map Interaction Handlers ---
  const onMapClick = useCallback(
    (event: MapMouseEvent) => {
      const features = event.features;
      if (!features || features.length === 0) return;

      const feature = features[0];

      if (feature.layer?.id === 'clusters') {
        const clusterId = feature.properties?.cluster_id;

        const mapboxSource = mapRef.current?.getSource('photos') as GeoJSONSource;

        if (mapboxSource && mapboxSource.getClusterExpansionZoom) {
          mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            // ▼ zoom が null または undefined の場合は処理を抜ける（型エラーを解消）
            if (typeof zoom !== 'number') return;

            const geometry = feature.geometry as { type: 'Point'; coordinates: [number, number] };

            mapRef.current?.easeTo({
              center: geometry.coordinates,
              zoom,
              duration: 500,
            });
          });
        }
      } else if (feature.layer?.id === 'unclustered-point') {
        const markerId = feature.properties?.markerId;
        const clickedPhoto = markers.find((m) => m.id === markerId);
        if (clickedPhoto) {
          setSelectedPhoto(clickedPhoto);
        }
      }
    },
    [markers]
  );

  const onMouseEnter = useCallback(() => (document.body.style.cursor = 'pointer'), []);
  const onMouseLeave = useCallback(() => (document.body.style.cursor = ''), []);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <div className="h-full w-full">
        <MapboxMap
          ref={mapRef}
          initialViewState={INITIAL_VIEW_STATE}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
          style={{ width: '100%', height: '100%' }}
          interactiveLayerIds={['clusters', 'unclustered-point']}
          onClick={onMapClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {/* GeoJSON Source for Clustering */}
          <Source
            id="photos"
            type="geojson"
            data={geoJsonData}
            cluster={true}
            clusterMaxZoom={14}
            clusterRadius={50}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...unclusteredPointLayer} />
          </Source>
        </MapboxMap>
      </div>

      {/* Info overlay */}
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
          ) : (
            <button
              onClick={handleSignOut}
              className="pointer-events-auto text-amber-400 hover:text-amber-300 hover:underline"
            >
              Sign out
            </button>
          )}
        </div>
        {statusMessage ? <p className="mt-3 text-sm text-amber-300">{statusMessage}</p> : null}
      </div>

      {/* Upload button */}
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

      {/* Photo Modal Overlay */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          currentUserId={currentUserId}
          currentUserEmail={currentUserEmail}
          supabase={supabase}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Modal Component for viewing the image and adding comments
// ----------------------------------------------------------------------
function PhotoModal({
  photo,
  currentUserId,
  currentUserEmail,
  supabase,
  onClose,
}: {
  photo: PhotoMarker;
  currentUserId: string | null;
  currentUserEmail: string | null;
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  // Fetch comments for this specific photo
  useEffect(() => {
    let isActive = true;

    const fetchComments = async () => {
      setIsLoadingComments(true);
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('photo_id', photo.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
      } else if (isActive && data) {
        setComments(data as PhotoComment[]);
      }

      if (isActive) setIsLoadingComments(false);
    };

    fetchComments();

    return () => {
      isActive = false;
    };
  }, [photo.id, supabase]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId || !currentUserEmail) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          photo_id: photo.id,
          user_id: currentUserId,
          user_email: currentUserEmail,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistically add the new comment to the UI
      if (data) {
        setComments((prev) => [...prev, data as PhotoComment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm md:p-8">
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-slate-900 shadow-2xl md:flex-row">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/80 md:bg-transparent md:text-slate-400 md:hover:bg-slate-800 md:hover:text-white"
          aria-label="Close modal"
        >
          ✕
        </button>

        {/* Left Side: Image Viewer */}
        <div className="relative flex h-1/2 w-full items-center justify-center bg-black md:h-full md:w-2/3">
          <Image
            src={photo.publicUrl}
            alt={photo.ai_description || 'Expanded photo view'}
            fill
            className="object-contain"
            unoptimized={process.env.NODE_ENV === 'development'}
          />
        </div>

        {/* Right Side: Comments Section */}
        <div className="flex h-1/2 w-full flex-col border-t border-slate-800 bg-slate-900 p-6 md:h-full md:w-1/3 md:border-t-0 md:border-l">
          <h3 className="mb-4 text-lg font-semibold text-white">Comments</h3>

          {/* Comments List */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
            {isLoadingComments ? (
              <p className="text-sm text-slate-400">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No comments yet. Be the first!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-slate-800/50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-cyan-400">
                      {comment.user_id === currentUserId
                        ? 'You'
                        : comment.user_email
                          ? comment.user_email.split('@')[0]
                          : 'User'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm break-words text-slate-200">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment Form */}
          <div className="mt-4 border-t border-slate-800 pt-4">
            {!currentUserId ? (
              <p className="text-center text-sm text-slate-400">
                <Link href="/login" className="text-cyan-400 hover:underline">
                  Sign in
                </Link>{' '}
                to add a comment.
              </p>
            ) : (
              <form onSubmit={handleAddComment} className="flex flex-col gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full resize-none rounded-lg bg-slate-800 p-3 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  rows={3}
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="self-end rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
