import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, Shield } from "lucide-react";
import { CallStatus } from "../types";

interface CallUIProps {
  incomingCall: CallStatus | null;
  activeCallStatus: CallStatus | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoTrackEnabled: boolean;
  onAnswer: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  isCallFromActiveChat?: boolean;
}

export const CallUI: React.FC<CallUIProps> = ({
  incomingCall,
  activeCallStatus,
  localStream,
  remoteStream,
  isMuted,
  isVideoTrackEnabled,
  onAnswer,
  onReject,
  onHangup,
  onToggleMic,
  onToggleCam,
  isCallFromActiveChat = false,
}) => {
  const [callDuration, setCallDuration] = useState<number>(0);

  const localMediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const remoteMediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    if (localMediaRef.current) {
      localMediaRef.current.srcObject = localStream || null;
    }
  }, [localStream, activeCallStatus]);

  useEffect(() => {
    if (remoteMediaRef.current) {
      remoteMediaRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream, activeCallStatus]);

  // Call duration counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeCallStatus && !activeCallStatus.ended) {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCallStatus]);

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* 1. WhatsApp-Style Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && !activeCallStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#09090b]/95 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 h-screen w-screen"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0, transition: { type: "spring", damping: 25 } }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 text-white w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Subtle pulsing secure emblem background */}
              <div className="absolute top-4 right-4 text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-full text-xs font-semibold">
                <Shield className="w-3.5 h-3.5 animate-pulse" /> SECURE LINK
              </div>

              <div className="text-neutral-400 text-xs tracking-widest uppercase font-semibold mt-4 mb-6">
                Incoming {incomingCall.type.toUpperCase()} Call
              </div>

              {/* Pulsing Avatar */}
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping" />
                <div className="absolute -inset-2 rounded-full border-2 border-emerald-500/20 animate-pulse" />
                <img
                  src={incomingCall.callerImg || `https://ui-avatars.com/api/?name=${incomingCall.callerName || "User"}&background=random`}
                  alt="Caller"
                  className="w-full h-full rounded-full object-cover border-4 border-neutral-800 shadow-xl relative z-10"
                />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                {incomingCall.callerName}
              </h2>
              <p className="text-neutral-400 text-sm font-medium mb-8">
                {incomingCall.callerNumber ? `+91 ${incomingCall.callerNumber}` : "Direct Connection"}
              </p>

              {/* Action Buttons */}
              <div className="flex justify-around items-center gap-6 px-4">
                <button
                  onClick={onReject}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    onReject();
                  }}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 cursor-pointer transition-colors duration-150"
                  title="Decline Call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>

                <button
                  onClick={onAnswer}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    onAnswer();
                  }}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 cursor-pointer transition-colors duration-150"
                  title="Accept Call"
                >
                  <Phone className="w-7 h-7" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Active WebRTC Call Screen Overlay */}
      <AnimatePresence>
        {activeCallStatus && !activeCallStatus.ended && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[9995] flex flex-col h-dvh w-screen overflow-hidden"
          >
            {/* Ambient Background Blur for Audio Call */}
            {activeCallStatus.type === "audio" && (
              <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center p-6 z-10 text-center">
                {/* Mount hidden media tags so WebRTC audio plays safely */}
                <audio ref={remoteMediaRef} autoPlay playsInline className="hidden" />
                <audio ref={localMediaRef} autoPlay playsInline muted className="hidden" />
                
                <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-blue-500/10 to-transparent blur-3xl pointer-events-none" />
                
                <motion.div 
                  animate={{ scale: [1, 1.05, 1], filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="relative mb-6"
                >
                  <div className="absolute -inset-4 rounded-full bg-blue-500/10 blur-md animate-pulse" />
                  <img
                    src={activeCallStatus.callerImg || "https://via.placeholder.com/150"}
                    alt="Active User"
                    className="w-36 h-36 rounded-full object-cover border-4 border-blue-500 relative z-10 shadow-2xl"
                  />
                </motion.div>

                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  {activeCallStatus.callerName}
                </h2>
                <div className="text-blue-400 font-semibold tracking-wide text-xs mb-1 flex items-center gap-1.5 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  SECURE VOICE ROOM
                </div>
                <div className="text-neutral-400 text-sm font-mono tracking-wider mt-4">
                  {formatDuration(callDuration)}
                </div>
              </div>
            )}

            {/* Video Grid for Video Call */}
            {activeCallStatus.type === "video" && (
              <div className="relative flex-1 bg-neutral-900 overflow-hidden">
                {/* 1. Remote Fullscreen Video */}
                <video
                  ref={remoteMediaRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* 2. Floating Small Local Picture-in-Picture Video */}
                <motion.div
                  drag
                  dragConstraints={{ left: 10, right: window.innerWidth - 130, top: 10, bottom: window.innerHeight - 200 }}
                  className="absolute bottom-24 right-4 w-28 h-40 md:w-36 md:h-52 object-cover rounded-2xl border-2 border-white shadow-2xl overflow-hidden bg-neutral-950 z-30 touch-none"
                >
                  <video
                    ref={localMediaRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                </motion.div>

                {/* Overhead caller details */}
                <div className="absolute top-6 left-6 z-20 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-white flex items-center gap-3">
                  <img
                    src={activeCallStatus.callerImg}
                    alt="User"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="text-sm font-bold">{activeCallStatus.callerName}</h4>
                    <span className="text-[10px] text-neutral-300 font-mono">
                      {formatDuration(callDuration)}
                    </span>
                  </div>
                </div>

                <div className="absolute top-6 right-6 z-20 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md">
                  <Shield className="w-3 h-3" /> SECURE LINK ACTIVE
                </div>
              </div>
            )}

            {/* Controller dock at the bottom */}
            <div className="absolute bottom-0 inset-x-0 z-50 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-8 md:pb-10 flex flex-col items-center gap-4 px-6">
              <div className="flex items-center justify-center gap-6">
                {/* Mic Mutepand */}
                <button
                  onClick={onToggleMic}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer ${
                    isMuted
                      ? "bg-red-500 shadow-lg shadow-red-500/20"
                      : "bg-white/20 hover:bg-white/30 border border-white/10"
                  }`}
                  title={isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* End Call Button */}
                <button
                  onClick={onHangup}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-xl shadow-red-600/30 font-bold text-2xl transition hover:rotate-12 cursor-pointer"
                  title="Hang Up Call"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>

                {/* Cam Toggle Button - Only available/functional for Video Call */}
                {activeCallStatus.type === "video" && (
                  <button
                    onClick={onToggleCam}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer ${
                      !isVideoTrackEnabled
                        ? "bg-red-500 shadow-lg shadow-red-500/20"
                        : "bg-white/20 hover:bg-white/30 border border-white/10"
                    }`}
                    title={isVideoTrackEnabled ? "Turn Off Video" : "Turn On Video"}
                  >
                    {!isVideoTrackEnabled ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
