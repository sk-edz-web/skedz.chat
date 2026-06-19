import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, Phone, Video, Settings, Smile, Image as ImageIcon, 
  Send, Trash2, Shield, X, Mic, CheckCheck, Plus, Loader, Mail, Link2,
  Download
} from "lucide-react";
import { Room, Message, UserProfile, QuotedMessage } from "../types";
import { db } from "../config/firebase";
import { ref, push, set, get, remove } from "firebase/database";
import { uploadToCloudinary, isCloudinaryConfigured } from "../utils/cloudinary";
import { AudioPlayer } from "./AudioPlayer";

interface ChatWindowProps {
  room: Room;
  messages: Message[];
  currentUserId: string;
  currentProfile: UserProfile;
  onBack: () => void;
  onInitiateCall: (type: "audio" | "video", isJoinButton?: boolean) => void;
  typingUsers: string[];
  onSetReplying: (msg: QuotedMessage | null) => void;
  replyingTo: QuotedMessage | null;
  onKickMember: (uid: string) => void;
  onDeleteRoom: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  room,
  messages,
  currentUserId,
  currentProfile,
  onBack,
  onInitiateCall,
  typingUsers,
  onSetReplying,
  replyingTo,
  onKickMember,
  onDeleteRoom,
}) => {
  const [inputText, setInputText] = useState("");
  const [chatBg, setChatBg] = useState<string>("");
  const [otherUser, setOtherUser] = useState<any>(null);

  // Settings modals
  const [isCogOpen, setIsCogOpen] = useState(false);
  const [isBGPickerOpen, setIsBGPickerOpen] = useState(false);
  const [isCallTypePickerOpen, setIsCallTypePickerOpen] = useState(false);
  const [roomMembers, setRoomMembers] = useState<Array<{ uid: string; name: string; img: string }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Giphy states
  const [isGiphyOpen, setIsGiphyOpen] = useState(false);
  const [giphyQuery, setGiphyQuery] = useState("");
  const [gifs, setGifs] = useState<string[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  // Voice note recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // Attachment upload states (Cloudinary)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const bgUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // For long press or selecting a message context (emoji reactions & quoting)
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);

  // User Profile Inspector States
  const [inspectedUser, setInspectedUser] = useState<UserProfile | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  const inspectUserProfile = async (userId: string) => {
    try {
      const snap = await get(ref(db, `users/${userId}`));
      if (snap.exists()) {
        setInspectedUser(snap.val());
        setIsInspecting(true);
      } else {
        alert("User details are not found in the secure registry!");
      }
    } catch (err: any) {
      alert("Failed to retrieve user: " + err.message);
    }
  };

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Load chat theme from local preference
  useEffect(() => {
    const savedTheme = localStorage.getItem(`chat_bg_${room.id}`) || "";
    setChatBg(savedTheme);
  }, [room.id]);

  // Fetch direct other user context
  useEffect(() => {
    if (room.type === "direct") {
      const otherUid = Object.keys(room.users || {}).find((id) => id !== currentUserId);
      if (otherUid) {
        get(ref(db, `users/${otherUid}`)).then((snap) => {
          if (snap.exists()) {
            setOtherUser({ uid: otherUid, ...snap.val() });
          }
        });
      }
    } else {
      setOtherUser(null);
    }
  }, [room, currentUserId]);

  const copyRoomId = () => {
    const idToCopy = room.type === 'direct' && otherUser ? otherUser.contactNo : room.id;
    navigator.clipboard.writeText(idToCopy).then(() => {
      alert("ID copied to clipboard successfully!");
    });
  };

  const handleDownloadMedia = async (url: string, filename: string) => {
    if (!url) return;
    try {
      // Dynamic cross-origin blob attachment initializer
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback to seamless standard tab download activation anchor
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Typing indicators
  const handleInputUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    set(ref(db, `typing/${room.id}/${currentUserId}`), currentProfile.name || "User");
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      remove(ref(db, `typing/${room.id}/${currentUserId}`));
    }, 2000);
    return () => clearTimeout(timeout);
  }, [inputText, room.id, currentUserId]);

  // Message Send actions
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    const body = inputText.trim();
    setInputText("");
    remove(ref(db, `typing/${room.id}/${currentUserId}`));

    try {
      await push(ref(db, `messages/${room.id}`), {
        text: body,
        type: "text",
        senderId: currentUserId,
        senderName: currentProfile.name || "User",
        senderImg: currentProfile.img || "https://ui-avatars.com/api/?name=User",
        timestamp: Date.now(),
        replyTo: replyingTo || null,
      });
      onSetReplying(null);
    } catch (e: any) {
      alert("Error sending message: " + e.message);
    }
  };

  // Upload attachment via Cloudinary
  const handleAttachmentClick = () => {
    if (!isCloudinaryConfigured()) {
      alert("Cloudinary stands unconfigured. Please configure Cloud Name and Upload Preset in Profile Settings to send images.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const url = await uploadToCloudinary(file);
      const isVideoFile = file.type.startsWith("video/");
      await push(ref(db, `messages/${room.id}`), {
        text: url,
        type: isVideoFile ? "video" : "gif", // Mark video custom-types correctly
        senderId: currentUserId,
        senderName: currentProfile.name || "User",
        senderImg: currentProfile.img || "https://ui-avatars.com/api/?name=User",
        timestamp: Date.now(),
        replyTo: replyingTo || null,
      });
      onSetReplying(null);
    } catch (err: any) {
      alert("Cloudy Upload failure: " + err.message);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Fetch GIFs (Giphy engine)
  const fetchGifs = async (query: string) => {
    setIsLoadingGifs(true);
    const GIPHY_KEY = "1biyrq5KYubzbzxbwkQnwh0jhvc6GWJI";
    let url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${query || "trending"}&limit=12&rating=g`;
    if (!query) {
      url = `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      const urls = (data.data || []).map((gif: any) => gif.images.fixed_height.url);
      setGifs(urls);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const openGiphy = () => {
    setIsGiphyOpen(true);
    setGiphyQuery("");
    fetchGifs("");
  };

  const sendGif = async (url: string) => {
    try {
      await push(ref(db, `messages/${room.id}`), {
        text: url,
        type: "gif",
        senderId: currentUserId,
        senderName: currentProfile.name || "User",
        senderImg: currentProfile.img || "https://ui-avatars.com/api/?name=User",
        timestamp: Date.now(),
        replyTo: replyingTo || null,
      });
      setIsGiphyOpen(false);
      onSetReplying(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Voice note recordings
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Microphone capture or media devices are not supported or are blocked on this browser/context (ensure HTTPS is being used).");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recordType = MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType: recordType });

      setAudioStream(stream);
      setMediaRecorder(recorder);
      audioChunksRef.current = [];
      setIsRecording(true);
      setRecordSeconds(0);

      recordingTimer.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start();
    } catch (e) {
      alert("Microphone connection denied.");
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorder || !isRecording) return;
    setIsRecording(false);
    if (recordingTimer.current) clearInterval(recordingTimer.current);

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Str = reader.result as string;
        try {
          await push(ref(db, `messages/${room.id}`), {
            text: base64Str,
            type: "audio",
            mimeType: mediaRecorder.mimeType || "audio/webm",
            senderId: currentUserId,
            senderName: currentProfile.name || "User",
            senderImg: currentProfile.img || "https://ui-avatars.com/api/?name=User",
            timestamp: Date.now(),
            replyTo: replyingTo || null,
          });
          onSetReplying(null);
        } catch (e: any) {
          alert("Error delivering voice card: " + e.message);
        }
      };

      // Keep stream tracks terminated
      audioStream?.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.stop();
  };

  const cancelRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    mediaRecorder?.stop();
    audioStream?.getTracks().forEach((track) => track.stop());
    audioChunksRef.current = [];
  };

  // Members list loading for Workspace settings page
  const openCogSettings = async () => {
    setIsCogOpen(true);
    setIsLoadingMembers(true);
    try {
      const snap = await get(ref(db, `room_members/${room.id}`));
      if (snap.exists()) {
        const uids = Object.keys(snap.val());
        const membersList: typeof roomMembers = [];
        for (const uid of uids) {
          const uSnap = await get(ref(db, `users/${uid}`));
          if (uSnap.exists()) {
            membersList.push({ uid, name: uSnap.val().name, img: uSnap.val().img });
          }
        }
        setRoomMembers(membersList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const changeWallpaper = (url: string) => {
    localStorage.setItem(`chat_bg_${room.id}`, url);
    setChatBg(url);
    setIsBGPickerOpen(false);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isCloudinaryConfigured()) {
      alert("Cloudinary stands unconfigured. Please configure Cloud Name and Upload Preset in Profile Settings to unlock uploading.");
      return;
    }

    setIsUploadingBg(true);
    try {
      const url = await uploadToCloudinary(file);
      changeWallpaper(url);
    } catch (err: any) {
      alert("Failed to upload background: " + err.message);
    } finally {
      setIsUploadingBg(false);
      if (bgUploadRef.current) bgUploadRef.current.value = "";
    }
  };

  // Reactions logic
  const handleAddReaction = async (msgId: string, emoji: string) => {
    await set(ref(db, `messages/${room.id}/${msgId}/reactions/${currentUserId}`), emoji);
    setActiveReactionPickerMessageId(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#f0f2f5] overflow-hidden select-none relative">
      {/* 1. Header Toolbar */}
      <div className="h-16 px-4 bg-white/95 backdrop-blur border-b border-neutral-200/50 flex items-center justify-between z-40 shadow-sm relative">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1 px-1.5 hover:bg-neutral-100 rounded-xl text-neutral-600 transition flex-shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <img
            src={room.type === "direct" && otherUser ? otherUser.img : room.icon}
            alt={room.name}
            onClick={() => room.type === "direct" && otherUser && inspectUserProfile(otherUser.uid)}
            className={`w-10 h-10 object-cover bg-neutral-100 flex-shrink-0 border border-neutral-100 shadow-sm transition ${
              room.type === "direct" ? "rounded-full cursor-pointer hover:opacity-85" : "rounded-2xl"
            }`}
          />

          <div className="min-w-0 flex-1 pr-2">
            <h3 
              onClick={() => room.type === "direct" && otherUser && inspectUserProfile(otherUser.uid)}
              className={`text-xs font-black truncate text-neutral-950 leading-tight ${
                room.type === "direct" ? "cursor-pointer hover:underline" : ""
              }`}
            >
              {room.type === "direct" && otherUser ? otherUser.name : room.name}
            </h3>
            <span
              onClick={copyRoomId}
              className="text-[9px] font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded leading-none flex-[0_0_auto] cursor-pointer select-none inline-block mt-0.5"
              title="Copy Room ID Reference"
            >
              {room.type === "direct" && otherUser ? `No: ${otherUser.contactNo}` : `ID: ${room.id}`}
            </span>
          </div>
        </div>

        {/* Trigger call overlays / settings */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Unified Call Trigger with Popover Dropdown Selection */}
          <div className="relative">
            <button
              onClick={() => setIsCallTypePickerOpen((prev) => !prev)}
              className="p-2.5 hover:bg-neutral-100 rounded-full text-neutral-600 transition cursor-pointer flex items-center justify-center bg-transparent"
              title="Secure Communications"
              id="call-dropdown-btn"
            >
              <Phone className="w-4 h-4 fill-current animate-pulse-slow text-neutral-700" />
            </button>

            {/* Selection menu overlay dropdown */}
            <AnimatePresence>
              {isCallTypePickerOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsCallTypePickerOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white border border-neutral-200/80 rounded-2xl shadow-xl p-1.5 z-50 flex flex-col gap-1 text-left"
                  >
                    <div className="px-3 py-1.5 text-[9px] font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-100 mb-1 select-none">
                      Secure Link Call
                    </div>
                    
                    <button
                      onClick={() => {
                        setIsCallTypePickerOpen(false);
                        onInitiateCall("audio");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-neutral-50 text-neutral-700 font-bold cursor-pointer text-left transition"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500 fill-current" />
                      <span>Audio Call</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsCallTypePickerOpen(false);
                        onInitiateCall("video");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-neutral-50 text-neutral-700 font-bold cursor-pointer text-left transition"
                    >
                      <Video className="w-3.5 h-3.5 text-blue-500 fill-current" />
                      <span>Video Call</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Wallpaper picker */}
          <button
            onClick={() => setIsBGPickerOpen(true)}
            className="p-2.5 hover:bg-neutral-100 rounded-full text-neutral-600 transition cursor-pointer"
            title="Wallpaper Decor"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Workspaces cog settings */}
          {room.type !== "direct" && (
            <button
              onClick={openCogSettings}
              className="p-2.5 hover:bg-neutral-100 rounded-full text-neutral-600 transition cursor-pointer"
              title="Room Members"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Panel Container */}
      <div
        ref={messagesContainerRef}
        style={{
          backgroundImage: chatBg ? `url(${chatBg})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 relative flex flex-col transition-all bg-[#efeae2]"
      >
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUserId;
          const isAdminMsg = msg.senderId === "ADMIN";
          const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          if (msg.type === 'call_invite') {
            return (
              <div key={index} className="flex justify-center my-3 select-none">
                <div className="bg-white/80 backdrop-blur-xl border border-blue-500/20 text-[#111827] px-6 py-4 rounded-[24px] text-center max-w-sm shadow-md">
                  <span className="text-xl inline-block mb-1">
                    {msg.callType === 'video' ? '📹' : '🎧'}
                  </span>
                  <p className="text-xs font-bold leading-relaxed">
                    {msg.callType?.toUpperCase()} CALL INITIALIZED BY {msg.senderName}
                  </p>
                  <p className="text-[10px] text-neutral-400 mt-1 mb-3">Room Session Active</p>
                  <button
                    onClick={() => onInitiateCall(msg.callType || 'video', true)}
                    className="py-1.5 px-6 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] uppercase shadow-sm cursor-pointer transition active:scale-95"
                  >
                    Tap to Join
                  </button>
                </div>
              </div>
            );
          }

          if (isAdminMsg) {
            return (
              <div key={index} className="flex justify-center my-3 select-none">
                <span className="bg-black/10 border border-neutral-400/20 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold text-neutral-600 uppercase tracking-widest leading-none">
                  🔧 System: {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div
              key={index}
              className={`flex items-end gap-2 max-w-[85%] relative ${
                isMe ? "self-end flex-row-reverse" : "self-start"
              }`}
            >
              {/* Other Sender avatar profile */}
              {!isMe && room.type !== "direct" && (
                <img
                  src={msg.senderImg || "https://via.placeholder.com/100"}
                  alt={msg.senderName}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                  onClick={() => inspectUserProfile(msg.senderId)}
                />
              )}

              <div className="flex flex-col relative group">
                {/* Header sender tag */}
                {!isMe && room.type !== "direct" && (
                  <span 
                    className="text-[10px] font-extrabold text-neutral-500 mb-0.5 ml-1 select-none cursor-pointer hover:underline transition"
                    onClick={() => inspectUserProfile(msg.senderId)}
                  >
                    {msg.senderName}
                  </span>
                )}

                {/* Message Interactive Bubble with Swipe/Drag to Reply */}
                <div className="relative">
                  {/* Pull-to-reply background indicator */}
                  <div className={`absolute top-1/2 -translate-y-1/2 transition pointer-events-none opacity-0 group-hover:opacity-60 flex items-center ${
                    isMe ? "-left-8" : "-right-8"
                  }`}>
                    <span className="text-xs bg-neutral-100/90 text-neutral-700 w-6 h-6 rounded-full flex items-center justify-center shadow-xs border border-neutral-200 animate-pulse">
                      ↩
                    </span>
                  </div>

                  <motion.div
                    drag="x"
                    dragDirectionLock
                    dragConstraints={{ left: isMe ? -120 : 0, right: isMe ? 0 : 120 }}
                    dragElastic={{ left: isMe ? 0.5 : 0, right: isMe ? 0 : 0.5 }}
                    dragSnapToOrigin={true}
                    onDragEnd={(event, info) => {
                      const threshold = 55;
                      const isTriggered = isMe ? (info.offset.x < -threshold) : (info.offset.x > threshold);
                      if (isTriggered) {
                        onSetReplying({
                          msgId: msg.id || `${index}`,
                          senderName: msg.senderName,
                          text: msg.type === "audio" ? "Voice Note" : msg.text,
                          type: msg.type,
                        });
                        if (navigator.vibrate) {
                          navigator.vibrate(35); // Premium haptic reply vibration
                        }
                      }
                    }}
                    onDoubleClick={() => setActiveReactionPickerMessageId(msg.id || `${index}`)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setActiveReactionPickerMessageId(msg.id || `${index}`);
                    }}
                    className={`p-3 rounded-2xl relative shadow-sm inline-block select-text max-w-full cursor-grab active:cursor-grabbing touch-pan-y ${
                      isMe
                        ? "bg-neutral-900 border border-neutral-900 text-white rounded-br-sm"
                        : "bg-white border border-neutral-250 text-[#111827] rounded-bl-sm"
                    }`}
                  >
                    {/* Quoting context */}
                    {msg.replyTo && (
                      <div
                        className={`text-xs p-2 rounded-xl mb-2 italic border-l-2 leading-relaxed opacity-90 overflow-hidden line-clamp-2 max-w-[200px] select-none ${
                          isMe
                            ? "bg-white/10 border-white/40 text-neutral-100"
                            : "bg-neutral-50 border-neutral-300 text-neutral-500"
                        }`}
                      >
                        <strong className="block text-[10px] font-black uppercase not-italic">
                          {msg.replyTo.senderName}
                        </strong>
                        {(msg.replyTo.type === "audio" || msg.replyTo.text?.includes("audio-note")) ? "🎤 Voice Card" : (msg.replyTo.type === "video" || msg.replyTo.text?.startsWith("data:video/") || msg.replyTo.text?.includes(".mp4")) ? "🎥 Video Card" : (msg.replyTo.type === "gif" || msg.replyTo.text?.startsWith("data:image/") || msg.replyTo.text?.includes("cloudinary.com")) ? "🖼️ Media Image" : msg.replyTo.text}
                      </div>
                    )}

                    {/* Rendering standard types */}
                    {msg.type === "audio" ? (
                      <AudioPlayer src={msg.text} isMe={isMe} />
                    ) : (msg.type === "video" || (typeof msg.text === "string" && (msg.text.startsWith("data:video/") || msg.text.includes(".mp4") || msg.text.includes(".mov") || msg.text.includes(".webm") || msg.text.includes(".avi")))) ? (
                      <div className="relative group/media max-w-[240px] rounded-xl overflow-hidden bg-neutral-950 border border-neutral-900 shadow-sm flex flex-col mt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadMedia(msg.text, `video_${msg.timestamp || Date.now()}.mp4`);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full transition z-20 cursor-pointer flex items-center justify-center shadow border border-neutral-800"
                          title="Download Video"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <video
                          src={msg.text}
                          controls
                          className="w-full max-h-[280px] rounded-xl object-contain bg-black"
                        />
                      </div>
                    ) : (msg.type === "gif" || msg.type === "image" || (typeof msg.text === "string" && (msg.text.startsWith("data:image/") || msg.text.startsWith("http") && (msg.text.includes(".gif") || msg.text.includes("cloudinary.com") || msg.text.includes(".jpg") || msg.text.includes(".jpeg") || msg.text.includes(".png") || msg.text.includes(".webp") || msg.text.includes("/image"))))) ? (
                      <div className="relative group/media max-w-[240px] rounded-xl overflow-hidden bg-neutral-50 border border-neutral-150 shadow-xs flex flex-col mt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadMedia(msg.text, `image_${msg.timestamp || Date.now()}.jpg`);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition z-20 cursor-pointer flex items-center justify-center shadow border border-white/20"
                          title="Download Image"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <img
                          src={msg.text}
                          alt="Media Attached"
                          className="w-full max-h-[280px] rounded-xl object-contain bg-neutral-100"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap break-words pr-2">
                        {msg.text}
                      </p>
                    )}

                    {/* Bubble subdetails */}
                    <div className="flex items-center justify-end gap-1 mt-1.5 text-[8px] font-bold tracking-wider uppercase opacity-80 select-none">
                      <span className={isMe ? "text-neutral-300" : "text-neutral-400"}>
                        {formattedTime}
                      </span>
                      {isMe && (
                        <CheckCheck
                          className={`w-3 h-3 ${
                            (msg.seenBy ? Object.keys(msg.seenBy).length : 0) > 0
                              ? "text-blue-400"
                              : "text-neutral-400"
                          }`}
                        />
                      )}
                    </div>

                    {/* Display floating reaction counts */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="absolute -bottom-2 right-2 bg-white/95 backdrop-blur border border-neutral-200 shadow-sm rounded-full py-0.5 px-2 flex items-center gap-0.5 text-[10px] select-none scale-90">
                        {Object.values(msg.reactions).slice(0, 3).map((emoji, i) => (
                          <span key={i}>{emoji}</span>
                        ))}
                        {Object.keys(msg.reactions).length > 1 && (
                          <span className="text-[8px] font-black text-neutral-500 pl-0.5">
                            {Object.keys(msg.reactions).length}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Micro hovering reply trigger */}
                <div className={`opacity-0 group-hover:opacity-100 absolute top-1/2 -translate-y-1/2 transition select-none flex items-center ${
                  isMe ? "right-[calc(100%+8px)] flex-row-reverse" : "left-[calc(100%+8px)]"
                }`}>
                  <button
                    onClick={() =>
                      onSetReplying({
                        msgId: msg.id || `${index}`,
                        senderName: msg.senderName,
                        text: msg.type === "audio" ? "Voice Note" : msg.text,
                        type: msg.type,
                      })
                    }
                    className="p-1.5 bg-white border border-neutral-200 rounded-full shadow hover:bg-neutral-50 text-neutral-400 text-[10px] font-bold cursor-pointer transition leading-none pr-2 flex items-center gap-1"
                  >
                    <span>💬</span> Reply
                  </button>
                </div>
              </div>

              {/* Float Reaction picker panel */}
              {activeReactionPickerMessageId === (msg.id || `${index}`) && (
                <div
                  className={`absolute bottom-full mb-1 z-50 bg-white/95 backdrop-blur border border-neutral-250 shadow-xl rounded-full py-2 px-3 flex gap-2.5 animate-bounce-slow ${
                    isMe ? "right-0" : "left-0"
                  }`}
                >
                  {["😂", "😃", "😁", "🤧", "💖", "🤔", "👎"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleAddReaction(msg.id || `${index}`, emoji)}
                      className="text-lg hover:scale-125 hover:rotate-6 cursor-pointer transform transition"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveReactionPickerMessageId(null)}
                    className="text-[9px] font-extrabold text-neutral-400 px-1 border-l hover:text-black cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Syncing typing text lines */}
        {typingUsers.length > 0 && (
          <div className="self-start flex items-center gap-1 bg-white/70 backdrop-blur border border-neutral-200/50 px-4 py-2 rounded-full shadow-sm">
            <span className="text-[10px] font-black text-neutral-500 animate-pulse uppercase tracking-wider">
              {typingUsers.join(", ")} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Replying Preview Bar */}
      {replyingTo && (
        <div className="bg-white px-5 py-2 flex items-center justify-between border-t border-neutral-100 border-l-4 border-blue-500 select-none">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase text-blue-500 select-none">
              Quoting {replyingTo.senderName}
            </span>
            <p className="text-xs text-neutral-405 truncate font-semibold leading-relaxed">
              {replyingTo.text}
            </p>
          </div>
          <button
            onClick={() => onSetReplying(null)}
            className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400 hover:text-black transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5. Footer Attachments / Texts Inputs / Recording Bar */}
      <div className="p-4 bg-white border-t border-neutral-200/50 flex gap-2 items-center z-45">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {isRecording ? (
          /* Mic record UI Panel */
          <div className="flex-1 flex gap-2.5 items-center bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-2xl text-red-500">
            <button
              onClick={cancelRecording}
              className="p-1 px-2.5 bg-red-500 text-white hover:bg-red-600 rounded-full font-extrabold text-[10px] uppercase shadow-sm cursor-pointer transition active:scale-95 flex-shrink-0"
            >
              Cancel Rec
            </button>
            <div className="flex-1 flex items-center justify-center gap-1.5 px-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping flex-shrink-0" />
              <span className="text-xs font-mono font-bold">
                Recording ({Math.floor(recordSeconds / 60)}:
                {(recordSeconds % 60).toString().padStart(2, "0")})
              </span>
            </div>
            <button
              onClick={stopAndSendRecording}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full text-white cursor-pointer transition shadow-sm hover:scale-105 active:scale-95 flex-shrink-0"
              title="Transmit Voice Card"
            >
              <Send className="w-4 h-4 fill-current" />
            </button>
          </div>
        ) : (
          /* Input text layout */
          <>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Attachment trigger */}
              <button
                disabled={isUploadingFile}
                onClick={handleAttachmentClick}
                className="p-2 hover:bg-neutral-100 text-neutral-500 hover:text-black rounded-full transition cursor-pointer"
                title="Send Photo"
              >
                {isUploadingFile ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>

              {/* Tenor / Giphy toggle */}
              <button
                onClick={openGiphy}
                className="py-1 px-2.5 hover:bg-neutral-100 text-[10px] font-black tracking-widest text-[#111] hover:text-black rounded transition leading-none select-none border border-neutral-300 pointer-events-auto cursor-pointer"
                title="Send Gifs"
              >
                GIF
              </button>
            </div>

            <input
              type="text"
              className="flex-1 px-4 py-2.5 rounded-full bg-neutral-100 border border-transparent focus:bg-white focus:border-black/10 focus:outline-none text-xs text-[#111827] placeholder-neutral-400 font-medium transition"
              placeholder="Start private conversation..."
              value={inputText}
              onChange={handleInputUpdate}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />

            <div className="flex-shrink-0">
              {inputText.trim() ? (
                <button
                  onClick={handleSendMessage}
                  className="p-3 bg-neutral-900 border border-neutral-900 text-white rounded-full transition cursor-pointer shadow-sm hover:scale-105 hover:bg-black active:scale-95"
                  title="Send Message"
                >
                  <Send className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-3 bg-red-500 border border-red-500 text-white rounded-full transition cursor-pointer shadow-sm hover:scale-105 hover:bg-red-600 active:scale-95"
                  title="Record Secure Speech Card"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 6. Embedded BG Picker Panel */}
      <AnimatePresence>
        {isBGPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl p-6 border border-neutral-100 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between border-b pb-2 mb-4">
                <h4 className="font-bold text-xs text-[#111827]">Decor Gallery Backgrounds</h4>
                <button
                  onClick={() => setIsBGPickerOpen(false)}
                  className="p-1 hover:bg-neutral-150 rounded-full cursor-pointer text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                ref={bgUploadRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBgUpload}
              />

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  "https://external-preview.redd.it/got-bored-made-some-security-focused-chat-backgrounds-v0-tGqyYypz281IbaiOKNG_ru6lvTze1HhAYYXCRpw9CO8.jpg?width=1080&crop=smart&auto=webp&s=d843efa2e978376f1138aab01d5dc92afa9e3ada",
                  "https://www.shutterstock.com/image-vector/social-media-sketch-vector-seamless-600nw-1660950727.jpg",
                  "https://t3.ftcdn.net/jpg/17/22/39/96/360_F_1722399617_CZisd8RhP8Hm77t3sNDRxen8JomcZLLM.jpg",
                ].map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt="Theme"
                    className="w-full h-24 object-cover rounded-xl cursor-pointer border hover:border-blue-500 hover:scale-105 transition"
                    onClick={() => changeWallpaper(url)}
                  />
                ))}
                <button
                  onClick={() => bgUploadRef.current?.click()}
                  disabled={isUploadingBg}
                  className="w-full h-24 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl cursor-pointer border border-blue-200 hover:scale-105 flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-wider transition"
                >
                  {isUploadingBg ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin text-blue-500 mb-1" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-blue-500 mb-1" />
                      Upload BG
                    </>
                  )}
                </button>
                <button
                  onClick={() => changeWallpaper("")}
                  className="w-full h-24 col-span-2 bg-neutral-100 rounded-xl cursor-pointer border hover:border-black/5 flex items-center justify-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest hover:bg-neutral-200 transition"
                >
                  Clean Slate
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 7. Embedded Room Settings Modal */}
      <AnimatePresence>
        {isCogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl p-6 border border-neutral-100 max-w-sm w-full shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b pb-2.5 mb-4">
                <h4 className="font-bold text-sm text-[#111827]">Workspace directory</h4>
                <button
                  onClick={() => setIsCogOpen(false)}
                  className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Members listings Scroll Area */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 scrollbar-thin">
                {isLoadingMembers ? (
                  <p className="text-center text-[11px] text-neutral-400 py-10">Syncing member directory...</p>
                ) : (
                  roomMembers.map((member) => (
                    <div
                      key={member.uid}
                      className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-100"
                    >
                      <div 
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => inspectUserProfile(member.uid)}
                      >
                        <img
                          src={member.img || `https://ui-avatars.com/api/?name=${member.name}`}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover group-hover:opacity-85 transition"
                        />
                        <span className="text-xs font-bold leading-none group-hover:underline transition">{member.name}</span>
                      </div>
                      {member.uid !== currentUserId ? (
                        room.adminId === currentUserId && (
                          <button
                            onClick={() => {
                              if (confirm(`Kick ${member.name}?`)) {
                                onKickMember(member.uid);
                                setRoomMembers((m) => m.filter((x) => x.uid !== member.uid));
                              }
                            }}
                            className="text-[10px] font-bold text-red-500 bg-red-100 px-3 py-1 rounded-full cursor-pointer hover:bg-red-200/50"
                          >
                            Kick User
                          </button>
                        )
                      ) : (
                        <span className="text-[9px] font-bold text-blue-500 bg-blue-100 px-2.5 py-1 rounded-full uppercase scale-90 leading-none">
                          You
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Delete Workspace Button (if admin) */}
              {room.adminId === currentUserId && (
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to permanently delete this secure workspace?")) {
                      onDeleteRoom();
                      setIsCogOpen(false);
                    }
                  }}
                  className="w-full py-2.5 mt-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                >
                  Permanently Terminate Workspace
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. Tenor/Giphy Search Modal Overlay */}
      <AnimatePresence>
        {isGiphyOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-3xl p-5 border border-neutral-100 max-w-sm w-full shadow-2xl flex flex-col max-h-[75vh]"
            >
              <div className="flex items-center justify-between pb-3 border-b mb-3.5">
                <h4 className="font-extrabold text-sm text-[#111] flex items-center gap-1">
                  <span>🖼️</span> GIF Directory Search
                </h4>
                <button
                  onClick={() => setIsGiphyOpen(false)}
                  className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                className="w-full px-4 py-2.5 bg-neutral-100 border border-transparent rounded-full focus:outline-none focus:ring-1 focus:ring-neutral-200 text-xs text-[#111] placeholder-neutral-400 font-medium mb-3"
                placeholder="Search Tenor/Giphy tags..."
                value={giphyQuery}
                onChange={(e) => {
                  setGiphyQuery(e.target.value);
                  fetchGifs(e.target.value);
                }}
              />

              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 pr-0.5 scrollbar-thin">
                {isLoadingGifs ? (
                  <p className="text-center text-[10px] text-neutral-400 py-10 grid-column-span-full">
                    Scanning active directories...
                  </p>
                ) : gifs.length === 0 ? (
                  <p className="text-center text-[11px] text-neutral-400 py-10 grid-column-span-full select-none">
                    No matching GIFs found.
                  </p>
                ) : (
                  gifs.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt="Giphy Preview"
                      className="w-full h-24 object-cover rounded-xl cursor-pointer hover:opacity-90 shadow-sm hover:scale-[1.02] transition"
                      onClick={() => sendGif(url)}
                    />
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9. USER PROFILE INSPECTOR MODAL */}
      <AnimatePresence>
        {isInspecting && inspectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in font-sans"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-neutral-300 flex flex-col"
            >
              <button
                onClick={() => {
                  setIsInspecting(false);
                  setInspectedUser(null);
                }}
                className="absolute top-4 right-4 p-1.5 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400 transition z-55"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center mt-3 w-full pb-10">
                <img
                  src={inspectedUser.img || `https://ui-avatars.com/api/?name=${inspectedUser.name || 'User'}`}
                  alt={inspectedUser.name}
                  className="w-20 h-20 rounded-full object-cover border-4 border-neutral-150/30 shadow-md bg-neutral-100"
                />
                
                <h3 className="font-extrabold text-[15px] text-[#111] mt-3 text-center">
                  {inspectedUser.namePublic !== false ? inspectedUser.name : "Encrypted Username"}
                </h3>
                
                <span className="text-[9px] font-mono font-black text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full mt-1.5 select-all uppercase text-center">
                  No: {inspectedUser.contactNo}
                </span>

                <div className="w-full border-t border-neutral-100 my-4"></div>

                <div className="w-full text-left space-y-3.5">
                  {/* General Email details with lock safety check */}
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-neutral-100 rounded-lg text-neutral-500">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-neutral-400 block leading-none">Email Address</span>
                      <span className="text-xs font-semibold text-neutral-700 truncate block">
                        {inspectedUser.mailPublic !== false ? (inspectedUser.mail || "Not set") : "•••••••• (Encrypted)"}
                      </span>
                    </div>
                  </div>

                  {/* General Mobile details with lock safety check */}
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-neutral-100 rounded-lg text-neutral-500">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-neutral-400 block leading-none">Mobile Number</span>
                      <span className="text-xs font-semibold text-neutral-700 truncate block">
                        {inspectedUser.mobilePublic === true ? (inspectedUser.mobile || "Not set") : "•••••••• (Encrypted)"}
                      </span>
                    </div>
                  </div>

                  {/* General Links details with lock safety check */}
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-neutral-100 rounded-lg text-neutral-500">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold text-neutral-400 block leading-none">Social Link Defaults</span>
                      {inspectedUser.linksPublic === true && inspectedUser.links ? (
                        <a 
                          href={inspectedUser.links.startsWith("http") ? inspectedUser.links : `https://${inspectedUser.links}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-extrabold text-blue-500 hover:underline truncate block"
                        >
                          {inspectedUser.links}
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-neutral-700 block">
                          {inspectedUser.linksPublic === true ? "Not set" : "•••••••• (Encrypted)"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* General Bio details with lock safety check */}
                  <div className="flex flex-col gap-1 bg-neutral-50 border border-neutral-100 p-3 rounded-2xl">
                    <span className="text-[9px] font-bold text-neutral-400 tracking-wider uppercase">User Bio Notes</span>
                    <p className="text-xs text-neutral-600 leading-relaxed italic whitespace-pre-wrap">
                      {inspectedUser.bioPublic !== false ? (inspectedUser.bio || "No status bio notes configured.") : "Status bio encrypted for privacy."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
