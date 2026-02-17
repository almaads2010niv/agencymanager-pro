import React, { useState } from 'react';
import { Mic, Square, Pause, Play, X } from 'lucide-react';
import { Button } from './ui/Button';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface VoiceRecorderButtonProps {
  entityType: 'client' | 'lead';
  entityId: string;
  entityName: string;
  businessName: string;
  onTranscriptionComplete?: () => void;
  disabled?: boolean;
}

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const VoiceRecorderButton: React.FC<VoiceRecorderButtonProps> = ({
  entityType, entityId, entityName, businessName,
  onTranscriptionComplete, disabled,
}) => {
  const { uploadRecording, addCallTranscript, addClientNote, addLeadNote } = useData();
  const { user, displayName } = useAuth();
  const {
    isRecording, isPaused, recordingTime, audioLevel,
    startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording,
    error: recorderError,
  } = useVoiceRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  const handleStop = async () => {
    if (!user) return;
    const file = await stopRecording();
    if (!file) return;

    setIsProcessing(true);
    setProcessError(null);

    try {
      // 1. Upload to storage
      const uploadResult = await uploadRecording(entityType, entityId, file);
      if (!uploadResult) {
        setProcessError('שגיאה בהעלאת ההקלטה');
        return;
      }

      // 2. Call transcribe Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setProcessError('שגיאת אימות');
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: uploadResult.signedUrl,
          entityName,
          businessName: businessName || entityName,
          mimeType: file.type || 'audio/webm',
        }),
      });

      let result;
      try { result = await res.json(); } catch {
        setProcessError(`שגיאת שרת (${res.status})`);
        return;
      }
      if (!res.ok || !result.success) {
        setProcessError(result.error || 'שגיאה בתמלול');
        return;
      }

      // 3. Save CallTranscript
      const transcriptId = `t_${Date.now()}`;
      const transcriptData: Parameters<typeof addCallTranscript>[0] = {
        callDate: new Date().toISOString().split('T')[0],
        participants: `${displayName}, ${entityName}`,
        transcript: result.transcript,
        summary: result.summary,
        createdBy: user.id,
        createdByName: displayName,
      };
      if (entityType === 'client') {
        transcriptData.clientId = entityId;
      } else {
        transcriptData.leadId = entityId;
      }
      await addCallTranscript(transcriptData);

      // 4. Auto-generate AI summary (fire and forget)
      if (result.summary || result.transcript) {
        try {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          const sBody: Record<string, string> = {
            summaryType: 'transcript_summary',
            entityName: businessName || entityName,
            additionalContext: '',
          };
          if (result.summary) sBody.transcriptSummary = result.summary;
          sBody.transcript = result.transcript || '';
          const sRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-summary`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${s2?.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(sBody),
          });
          const sResult = await sRes.json();
          if (sResult.success && sResult.summary) {
            if (entityType === 'client') {
              await addClientNote(entityId, sResult.summary, user.id, displayName, 'transcript_summary', transcriptId);
            } else {
              await addLeadNote(entityId, sResult.summary, user.id, displayName, 'transcript_summary', transcriptId);
            }
          }
        } catch { /* silent */ }
      }

      onTranscriptionComplete?.();
    } catch (err) {
      setProcessError('שגיאה בהעלאה או בתמלול');
    } finally {
      setIsProcessing(false);
    }
  };

  const displayError = recorderError || processError;

  // Processing state
  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-sm text-blue-300">מתמלל הקלטה... (2-5 דקות)</span>
      </div>
    );
  }

  // Recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
        {/* Pulsing red dot */}
        <div className={`w-3 h-3 rounded-full bg-red-500 ${isPaused ? '' : 'animate-pulse'}`} />

        {/* Timer */}
        <span className="text-sm font-mono text-red-300 min-w-[50px]">{formatTime(recordingTime)}</span>

        {/* Audio level bars */}
        <div className="flex items-end gap-0.5 h-4">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
            <div
              key={i}
              className="w-1 rounded-full transition-all duration-100"
              style={{
                height: `${Math.max(4, (isPaused ? 4 : audioLevel > threshold ? 16 : 4))}px`,
                backgroundColor: audioLevel > threshold ? '#ef4444' : '#374151',
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-1 ms-2">
          {isPaused ? (
            <button onClick={resumeRecording} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-green-400" title="המשך">
              <Play size={14} />
            </button>
          ) : (
            <button onClick={pauseRecording} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-yellow-400" title="השהה">
              <Pause size={14} />
            </button>
          )}
          <button onClick={handleStop} className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400" title="עצור ותמלל">
            <Square size={14} />
          </button>
          <button onClick={cancelRecording} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400" title="בטל">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Idle state
  return (
    <div>
      <Button
        onClick={startRecording}
        disabled={disabled}
        variant="ghost"
        icon={<Mic size={16} />}
      >
        הקלט שיחה
      </Button>
      {displayError && (
        <div className="text-xs text-red-400 mt-1">{displayError}</div>
      )}
    </div>
  );
};

export default VoiceRecorderButton;
