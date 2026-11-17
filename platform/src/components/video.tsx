"use client";

import { useState } from "react";

// A lesson's video. Nothing is fetched from YouTube until the student presses play,
// so opening a lesson costs no extra data and the lesson still reads well offline.
export function LessonVideo({ embedUrl, watchUrl, title }: { embedUrl: string; watchUrl: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="video">
      {playing ? (
        <iframe
          src={embedUrl} title={`Video: ${title}`} loading="lazy" allowFullScreen
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="video-start" onClick={() => setPlaying(true)}>
          <span className="video-play" aria-hidden="true" />
          <strong>Play the video</strong>
          <span className="small">It starts when you press play and uses mobile data.</span>
        </button>
      )}
      <p className="small muted">Video not playing? <a href={watchUrl} target="_blank" rel="noopener noreferrer">Open it on YouTube</a>. Videos need a connection, even when the lesson is saved for offline.</p>
    </div>
  );
}
