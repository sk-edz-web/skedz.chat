import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, Group, User, Phone, Video, Lock, Unlock, Users, 
  MessageCircle, Settings, LogOut, Copy, RefreshCw, Key, 
  Trash2, Send, PlusCircle, Search, Laptop, Smartphone, HelpCircle, 
  Upload, Loader, Clock, HelpCircle as HelpIcon, Hash, X, Home, ClipboardList 
} from "lucide-react";

// Config & components
import { auth, db } from "./config/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { 
  ref, onValue, set, push, get, remove, update, off, onChildAdded 
} from "firebase/database";

import { Room, Message, UserProfile, CallStatus, Feedback } from "./types";
import { uploadToCloudinary, isCloudinaryConfigured } from "./utils/cloudinary";

import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { Dialer } from "./components/Dialer";
import { CallUI } from "./components/CallUI";
import { Feedbacks } from "./components/Feedbacks";
import { Profile } from "./components/Profile";

export default function App() {
  // Device mode & global layouts
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Auth User states
  const [user, setUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile>({ name: "User", img: "", contactNo: "" });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [authError, setAuthError] = useState("");

  // System navigation tabs
  // Tabs: 'home' | 'chats' | 'dialer' | 'feedbacks' | 'profile'
  const [selectedTab, setSelectedTab] = useState<string>("home");
  const [activeChat, setActiveChat] = useState<Room | null>(null);

  // Group creation states (Cloudinary-enabled!)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomIcon, setNewRoomIcon] = useState("");
  const [newRoomType, setNewRoomType] = useState<"public" | "private">("public");
  const [newRoomPass, setNewRoomPass] = useState("");
  const [isUploadingGroupIcon, setIsUploadingGroupIcon] = useState(false);
  const groupIconRef = useRef<HTMLInputElement>(null);

  // Join Room forms & custom password modal
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinRoomPass, setJoinRoomPass] = useState("");
  const [pendingJoinRoom, setPendingJoinRoom] = useState<Room | null>(null);
  const [customPassInput, setCustomPassInput] = useState("");

  // Datastore sync lists
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [myDirectChats, setMyDirectChats] = useState<Array<{ room: Room; otherUser: { name: string; img: string; contactNo: string } }>>([]);
  const [publicRooms, setPublicRooms] = useState<Room[]>([]);
  const [activeChatMessages, setActiveChatMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);

  // WebRTC & Audio Calling Signatures
  const [incomingCall, setIncomingCall] = useState<CallStatus | null>(null);
  const [activeCall, setActiveCall] = useState<CallStatus | null>(null);
  const [isCallMuted, setIsCallMuted] = useState<boolean>(false);
  const [isVideoTrackEnabled, setIsVideoTrackEnabled] = useState<boolean>(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const incomingCallRef = useRef<CallStatus | null>(null);
  const activeCallRef = useRef<CallStatus | null>(null);
  const activeChatRef = useRef<Room | null>(null);

  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const offerUnsubRef = useRef<(() => void) | null>(null);

  // 1. Responsive Screen Inspector
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Live greeting iOS Clock state
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(clockTimer);
    };
  }, []);

  // 2. Sound card effects / local audio player
  useEffect(() => {
    ringtoneRef.current = new Audio("https://assets.mixkit.io/sfx/preview/mixkit-phone-ring-1354.mp3");
    if (ringtoneRef.current) {
      ringtoneRef.current.loop = true;
    }
  }, []);

  // 3. Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (chkUser) => {
      if (chkUser) {
        setUser(chkUser);
        setAuthEmail(chkUser.email || "");
        
        // Load personal profile info (name, image, secret contact)
        const snap = await get(ref(db, `users/${chkUser.uid}`));
        if (snap.exists()) {
          const prof = snap.val();
          // Generate key contact format if not exists (Tamil: "git ignore pane api verify")
          if (!prof.contactNo) {
            const assignedNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
            prof.contactNo = assignedNo;
            await update(ref(db, `users/${chkUser.uid}`), { contactNo: assignedNo });
            await set(ref(db, `user_contacts/${assignedNo}`), chkUser.uid);
          }
          setCurrentProfile(prof);
        } else {
          // Initialize fresh user database schema
          const assignedNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
          const fallbackProfile = {
            name: chkUser.email?.split("@")[0] || "User",
            img: `https://ui-avatars.com/api/?name=${chkUser.email?.split("@")[0] || "User"}&background=random`,
            contactNo: assignedNo
          };
          await set(ref(db, `users/${chkUser.uid}`), fallbackProfile);
          await set(ref(db, `user_contacts/${assignedNo}`), chkUser.uid);
          setCurrentProfile(fallbackProfile);
        }
      } else {
        setUser(null);
        setActiveChat(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 4. Synchronization Feeds: Inbox & Community Directories
  useEffect(() => {
    if (!user) return;

    // Listen to personal chat groups joined
    const userChatsRef = ref(db, `user_chats/${user.uid}`);
    const unsubscribeUserChats = onValue(userChatsRef, async (snap) => {
      if (snap.exists()) {
        const chatsList = Object.keys(snap.val());
        const tempRooms: Room[] = [];
        const tempDirects: typeof myDirectChats = [];

        for (const rId of chatsList) {
          const roomSnap = await get(ref(db, `rooms/${rId}`));
          if (roomSnap.exists()) {
            const lobby = roomSnap.val() as Room;
            if (lobby.type === "direct") {
              const buddyUid = Object.keys(lobby.users || {}).find(uid => uid !== user.uid);
              if (buddyUid) {
                const buddySnap = await get(ref(db, `users/${buddyUid}`));
                if (buddySnap.exists()) {
                  tempDirects.push({ room: lobby, otherUser: buddySnap.val() });
                }
              }
            } else {
              tempRooms.push(lobby);
            }
          }
        }
        setMyRooms(tempRooms);
        setMyDirectChats(tempDirects);
      } else {
        setMyRooms([]);
        setMyDirectChats([]);
      }
    });

    // Listen to all public lobbies dynamically (Tamil: "Communities")
    const publicLobbiesRef = ref(db, "rooms");
    const unsubscribePublicLobbies = onValue(publicLobbiesRef, (snap) => {
      if (snap.exists()) {
        const directory: Room[] = [];
        snap.forEach((child) => {
          const lobby = child.val() as Room;
          if (lobby.type === "public") {
            directory.push(lobby);
          }
        });
        setPublicRooms(directory);
      } else {
        setPublicRooms([]);
      }
    });

    return () => {
      unsubscribeUserChats();
      unsubscribePublicLobbies();
    };
  }, [user]);

  // 4b. Dedicated secure calling status listener (isolated, leak-free, thread-safe)
  useEffect(() => {
    if (!user) return;
    const roomIds = [
      ...myRooms.map(r => r.id),
      ...myDirectChats.map(d => d.room.id)
    ];

    const unsubscribers: (() => void)[] = [];

    roomIds.forEach(rId => {
      const callStatusRef = ref(db, `calls/${rId}/status`);
      const unsub = onValue(callStatusRef, (callSnap) => {
        const status = callSnap.val() as CallStatus | null;
        
        if (!status || status.ended) {
          console.log("Call ended or not found. Cleaning up for room:", rId);
          setIncomingCall(curr => {
            if (curr && curr.roomId === rId) return null;
            return curr;
          });
          
          if (
            (activeCallRef.current && activeCallRef.current.roomId === rId) ||
            (incomingCallRef.current && incomingCallRef.current.roomId === rId)
          ) {
            console.log("Active call ended remotely for room:", rId);
            terminateWebRTCCall(rId);
          }
          try { ringtoneRef.current?.pause(); } catch(e){}
          return;
        }

        // Handle active non-ringing / ringing state updates
        if (!status.isRinging) {
          // If status says isRinging = false, clear any active ringing overlay for this room
          setIncomingCall(curr => {
            if (curr && curr.roomId === rId) return null;
            return curr;
          });
          try { ringtoneRef.current?.pause(); } catch(e){}

          // If we had an active call that was ringing, transition it to active connected call
          if (activeCallRef.current && activeCallRef.current.roomId === rId) {
            setActiveCall(status);
            // If we are callee and activeCall is set but connection hasn't started, answerIncomingCall or startWebRTCConnection handles it.
            // But if caller, this lets us know callee answered!
          }
        } else if (status.callerId !== user.uid) {
          // It's ringing and initiated by someone else: trigger ringing popup
          setIncomingCall(status);
          try {
            ringtoneRef.current?.play().catch(() => {});
          } catch(e){}
        }
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user, myRooms, myDirectChats]);

  // 4c. Solid isolated listener to catch remote disconnection / hangup immediately
  useEffect(() => {
    if (!user || !activeCall || !activeCall.roomId) return;
    const rId = activeCall.roomId;
    console.log("Isolated listener active for call in room:", rId);

    const callStatusRef = ref(db, `calls/${rId}/status`);
    const unsub = onValue(callStatusRef, (snap) => {
      const status = snap.val() as CallStatus | null;
      if (!status || status.ended) {
        console.log("Dedicated listener caught Call Ending or Deletion for room:", rId);
        terminateWebRTCCall(rId);
      }
    });

    return () => {
      console.log("Tearing down isolated active call status listener for room:", rId);
      unsub();
    };
  }, [user, activeCall?.roomId]);

  // 5. Active Chat Conversation Listeners
  useEffect(() => {
    if (!user || !activeChat) {
      setActiveChatMessages([]);
      setTypingUsers([]);
      setReplyingTo(null);
      return;
    }

    const messagesRef = ref(db, `messages/${activeChat.id}`);
    const unsubscribeMessages = onValue(messagesRef, (snap) => {
      if (snap.exists()) {
        const msgList: Message[] = [];
        snap.forEach((child) => {
          const m = child.val() as Message;
          const mId = child.key as string;
          msgList.push({ id: mId, ...m });

          // Mark message viewed (Tamil: "✓✓ ticks seen status")
          if (m.senderId !== user.uid && (!m.seenBy || !m.seenBy[user.uid])) {
            update(ref(db, `messages/${activeChat.id}/${mId}/seenBy`), { [user.uid]: true });
          }
        });
        setActiveChatMessages(msgList);
      } else {
        setActiveChatMessages([]);
      }
    });

    // Sync typing signals
    const typingRef = ref(db, `typing/${activeChat.id}`);
    const unsubscribeTyping = onValue(typingRef, (snap) => {
      if (snap.exists()) {
        const signals: string[] = [];
        snap.forEach((child) => {
          if (child.key !== user.uid) {
            signals.push(child.val() as string);
          }
        });
        setTypingUsers(signals);
      } else {
        setTypingUsers([]);
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [user, activeChat]);

  // 6. User Action: Authentication Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim()) {
      return setAuthError("Fill in all credentials.");
    }

    try {
      if (isSignupMode) {
        if (!authName.trim()) return setAuthError("Input dynamic name.");
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        const assignedNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        const prof = {
          name: authName.trim(),
          img: `https://ui-avatars.com/api/?name=${authName.trim()}&background=random`,
          contactNo: assignedNo
        };
        await set(ref(db, `users/${cred.user.uid}`), prof);
        await set(ref(db, `user_contacts/${assignedNo}`), cred.user.uid);
        setCurrentProfile(prof);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err: any) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      
      const snap = await get(ref(db, `users/${cred.user.uid}`));
      if (!snap.exists()) {
        const assignedNo = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        const prof = {
          name: cred.user.displayName || cred.user.email?.split("@")[0] || "User",
          img: cred.user.photoURL || `https://ui-avatars.com/api/?name=${cred.user.displayName || "User"}&background=random`,
          contactNo: assignedNo,
          mail: cred.user.email || "",
          mobile: "",
          links: "",
          bio: "",
          namePublic: true,
          bioPublic: true,
          mailPublic: true,
          mobilePublic: false,
          linksPublic: false
        };
        await set(ref(db, `users/${cred.user.uid}`), prof);
        await set(ref(db, `user_contacts/${assignedNo}`), cred.user.uid);
        setCurrentProfile(prof);
      } else {
        setCurrentProfile(snap.val());
      }
    } catch (err: any) {
      setAuthError(err.message.replace("Firebase: ", ""));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch(e) {}
  };

  const handleSaveIdentity = async (newNameOrUpdates: string | Partial<UserProfile>, optImg?: string) => {
    if (!user) return;
    if (typeof newNameOrUpdates === "string") {
      const updates = { name: newNameOrUpdates, img: optImg || "" };
      await update(ref(db, `users/${user.uid}`), updates);
      setCurrentProfile(prev => ({ ...prev, ...updates }));
    } else {
      await update(ref(db, `users/${user.uid}`), newNameOrUpdates);
      setCurrentProfile(prev => ({ ...prev, ...newNameOrUpdates }));
    }
  };

  // 7. Dynamic Group Icon upload helper (integrated with Cloudinary!)
  const handleGroupIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isCloudinaryConfigured()) {
      alert("Cloudinary name preset is missing. Register valid credentials in settings to unlock photo uploads.");
      return;
    }

    setIsUploadingGroupIcon(true);
    try {
      const url = await uploadToCloudinary(file);
      setNewRoomIcon(url);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUploadingGroupIcon(false);
    }
  };

  // 8. Custom Workspace creation and registration
  const handleCreateLobby = async () => {
    if (!newRoomName.trim()) return alert("Room name is empty!");
    const lobbyRef = push(ref(db, "rooms"));
    const lobbyId = lobbyRef.key as string;

    const metadata: Room = {
      id: lobbyId,
      name: newRoomName.trim(),
      icon: newRoomIcon.trim() || `https://ui-avatars.com/api/?name=${newRoomName.trim()}&background=random`,
      type: newRoomType,
      pass: newRoomPass.trim(),
      adminId: user.uid
    };

    try {
      await set(lobbyRef, metadata);
      await set(ref(db, `room_members/${lobbyId}/${user.uid}`), { role: "admin" });
      await set(ref(db, `user_chats/${user.uid}/${lobbyId}`), { joinedAt: Date.now() });

      // Clean inputs
      setNewRoomName("");
      setNewRoomIcon("");
      setNewRoomPass("");
      setNewRoomType("public");
      setIsCreatingRoom(false);

      // Open new channel
      setActiveChat(metadata);
      if (isMobile) {
        setSelectedTab("chats");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // 9. Custom Workspace joins with security locks
  const handleJoinLobby = async (lobby: Room) => {
    // Check if membership is already active
    const ucSnap = await get(ref(db, `user_chats/${user.uid}/${lobby.id}`));
    if (ucSnap.exists()) {
      setActiveChat(lobby);
      if (isMobile) {
        setSelectedTab("chats");
      }
      return;
    }

    // Checking private security codes
    if (lobby.pass && lobby.pass.trim() !== "") {
      setPendingJoinRoom(lobby);
      setCustomPassInput("");
      return; // Direct execution suspends until pass evaluated.
    }

    await finalizeWorkspaceJoin(lobby);
  };

  const handleCustomPassSubmit = async () => {
    if (!pendingJoinRoom) return;
    if (pendingJoinRoom.pass !== customPassInput.trim()) {
      return alert("password wrong");
    }

    const targetRoom = pendingJoinRoom;
    setPendingJoinRoom(null);
    await finalizeWorkspaceJoin(targetRoom);
  };

  const finalizeWorkspaceJoin = async (lobby: Room) => {
    try {
      await set(ref(db, `room_members/${lobby.id}/${user.uid}`), { role: "member" });
      await set(ref(db, `user_chats/${user.uid}/${lobby.id}`), { joinedAt: Date.now() });
      setActiveChat(lobby);
      alert(`Successfully registered in: ${lobby.name}`);
      if (isMobile) {
        setSelectedTab("chats");
      }
    } catch(e: any) {
      alert("Join failure: " + e.message);
    }
  };

  // 10. Direct Dialer Launcher operations
  const handleDialerAction = async (num: string, action: "audio" | "video" | "chat") => {
    if (num === currentProfile.contactNo) {
      return alert("Bro, cannot initialize secure links with yourself!");
    }

    try {
      const snap = await get(ref(db, `user_contacts/${num}`));
      if (!snap.exists()) {
        return alert("Dialed identity target number not found.");
      }

      const buddyUid = snap.val();
      const directId = [user.uid, buddyUid].sort().join("_");

      const roomRef = ref(db, `rooms/${directId}`);
      const roomSnap = await get(roomRef);

      const directLobby: Room = {
        id: directId,
        name: "Private Chat",
        icon: "",
        type: "direct",
        users: {
          [user.uid]: true,
          [buddyUid]: true
        }
      };

      if (!roomSnap.exists()) {
        await set(roomRef, directLobby);
        await set(ref(db, `user_chats/${user.uid}/${directId}`), { joinedAt: Date.now() });
        await set(ref(db, `user_chats/${buddyUid}/${directId}`), { joinedAt: Date.now() });
      }

      setActiveChat(directLobby);

      if (action === "chat") {
        if (isMobile) {
          setSelectedTab("chats");
        }
      } else {
        // Triggers calling immediately after setup without relying on async state update
        initiateWebRTCCall(action, false, directLobby);
      }
    } catch (err: any) {
      alert("Sync error: " + err.message);
    }
  };

  // 11. Kick & Delete features
  const handleKickMember = async (targetUid: string) => {
    if (!activeChat) return;
    try {
      await remove(ref(db, `room_members/${activeChat.id}/${targetUid}`));
      await remove(ref(db, `user_chats/${targetUid}/${activeChat.id}`));
    } catch (e) {}
  };

  const handleDeleteRoom = async () => {
    if (!activeChat) return;
    try {
      const memSnap = await get(ref(db, `room_members/${activeChat.id}`));
      if (memSnap.exists()) {
        for (const uid of Object.keys(memSnap.val())) {
          await remove(ref(db, `user_chats/${uid}/${activeChat.id}`));
        }
      }
      await remove(ref(db, `messages/${activeChat.id}`));
      await remove(ref(db, `room_members/${activeChat.id}`));
      await remove(ref(db, `typing/${activeChat.id}`));
      await remove(ref(db, `rooms/${activeChat.id}`));
      setActiveChat(null);
    } catch (e) {}
  };


  // =========================================================================
  // 12. WebRTC SIGNALING ENGINE HANDLERS
  // =========================================================================
  const initiateWebRTCCall = async (type: "audio" | "video", isJoinButton?: boolean, targetRoomOverride?: Room) => {
    const targetRoom = targetRoomOverride || activeChat;
    if (!targetRoom) {
      alert("No active secure channel found to dial.");
      return;
    }
    const rId = targetRoom.id;

    // Check if there is an active incoming call from someone else for this room first
    const currentIncoming = incomingCall || incomingCallRef.current;
    if (currentIncoming && currentIncoming.roomId === rId && currentIncoming.callerId !== user.uid) {
      console.log("Local metadata confirms incoming call is active in this room. Redirecting to answerIncomingCall.");
      await answerIncomingCall();
      return;
    }

    // Check if an active call exists in this room first to join as callee
    try {
      const callStatusSnap = await get(ref(db, `calls/${rId}/status`));
      const existingStatus = callStatusSnap.val() as CallStatus | null;

      if (existingStatus && !existingStatus.ended) {
        // An active call exists! Safely rejoin / connect to it
        const isCallerCurrentUser = existingStatus.callerId === user.uid;
        console.log("Active calling session detected. Connecting as...", isCallerCurrentUser ? "caller" : "callee");
        const updatedStatus = { ...existingStatus, isRinging: false };
        
        try { ringtoneRef.current?.pause(); } catch(e){}
        setIncomingCall(null);
        setActiveCall(updatedStatus);
        
        if (!isCallerCurrentUser) {
          try {
            await update(ref(db, `calls/${rId}/status`), { isRinging: false });
          } catch (e) {}
        }

        // Ensure we enter that active chat room
        try {
          const roomSnap = await get(ref(db, `rooms/${rId}`));
          if (roomSnap.exists()) {
            setActiveChat(roomSnap.val());
            setSelectedTab("chats");
          }
        } catch (e) {}

        await startWebRTCConnection(isCallerCurrentUser, existingStatus.type, rId);
        return;
      }
    } catch (err) {
      console.warn("Failed to check active call presence:", err);
    }

    // IF we are a "Join" button click but no active call is present, DO NOT create a new call!
    if (isJoinButton) {
      alert("No active secure connection found on this link. The call session may have ended.");
      return;
    }

    // Create call invite log item in messages feed
    await push(ref(db, `messages/${rId}`), {
      text: "Secure call initialized",
      type: "call_invite",
      callType: type,
      senderId: user.uid,
      senderName: currentProfile.name || "User",
      senderImg: currentProfile.img || "https://ui-avatars.com/api/?name=User",
      timestamp: Date.now()
    });

    // Write signaling status block
    const status: CallStatus = {
      isRinging: true,
      type: type,
      callerId: user.uid,
      callerName: currentProfile.name,
      callerImg: currentProfile.img,
      callerNumber: currentProfile.contactNo,
      ended: false,
      roomId: rId
    };

    setIncomingCall(null);
    setActiveCall(status);
    await set(ref(db, `calls/${rId}/status`), status);

    await startWebRTCConnection(true, type, rId);
  };

  const answerIncomingCall = async () => {
    const currentIncoming = incomingCall || incomingCallRef.current;
    if (!currentIncoming) {
      console.warn("No incoming call in metadata to answer.");
      return;
    }
    const rId = currentIncoming.roomId;
    if (!rId) return;

    try { ringtoneRef.current?.pause(); } catch(e){}
    setIncomingCall(null);

    const updatedStatus = { ...currentIncoming, isRinging: false };
    setActiveCall(updatedStatus);

    try {
      await update(ref(db, `calls/${rId}/status`), { isRinging: false });
    } catch (e) {
      console.warn("Could not update call ringing status:", e);
    }

    // Make sure we enter that active chat room 
    try {
      const roomSnap = await get(ref(db, `rooms/${rId}`));
      if (roomSnap.exists()) {
        setActiveChat(roomSnap.val());
        setSelectedTab("chats");
      }
    } catch (e) {
      console.warn("Could not load current room snapping details:", e);
    }

    await startWebRTCConnection(false, currentIncoming.type, rId);
  };

  const terminateWebRTCCall = async (rIdParam?: string | React.MouseEvent) => {
    const rawId = (typeof rIdParam === "string") ? rIdParam : undefined;
    const rId = rawId || 
                incomingCall?.roomId || 
                incomingCallRef.current?.roomId || 
                activeCall?.roomId || 
                activeCallRef.current?.roomId || 
                activeChat?.id || 
                activeChatRef.current?.id;
    if (!rId) return;

    try { ringtoneRef.current?.pause(); } catch(e){}

    if (offerUnsubRef.current) {
      try { offerUnsubRef.current(); } catch(e){}
      offerUnsubRef.current = null;
    }

    // Update signaling database
    try {
      await update(ref(db, `calls/${rId}/status`), { ended: true });
    } catch(e){}

    // Tear down Peer Connection & Media Track elements
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setIncomingCall(null);
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);

    // Wipe calls reference in DB only if the call session is actually marked as ended in DB
    setTimeout(async () => {
      try {
        const snap = await get(ref(db, `calls/${rId}/status`));
        if (snap.exists() && snap.val()?.ended === true) {
          await remove(ref(db, `calls/${rId}`));
        }
      } catch(e){}
    }, 1200);

    // Unsubscribe signal refs
    try {
      off(ref(db, `calls/${rId}/answer`));
      off(ref(db, `calls/${rId}/calleeCandidates`));
      off(ref(db, `calls/${rId}/callerCandidates`));
    } catch(e){}
  };

  const startWebRTCConnection = async (isCaller: boolean, type: "audio" | "video", rIdParam?: string) => {
    const rId = rIdParam || activeChatRef.current?.id;
    if (!rId) {
      alert("No active communication link target available.");
      terminateWebRTCCall();
      return;
    }

    const iceServers = {
      iceServers: [
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:global.stun.twilio.com:3478" }
      ]
    };

    pcRef.current = new RTCPeerConnection(iceServers);
    const remoteStreamObj = new MediaStream();
    setRemoteStream(remoteStreamObj);

    // Capture Local Camera feeds with audio fallback for desktop/PC setups
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera/Microphone capture is not supported or is blocked on this browser/context (ensure HTTPS is being used).");
        terminateWebRTCCall();
        return;
      }

      let stream: MediaStream;
      try {
        const constraints = { audio: true, video: type === "video" };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (mediaError) {
        if (type === "video") {
          console.warn("Camera failed or not detected, falling back to audio-only stream for PC compatibility:", mediaError);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } else {
          throw mediaError;
        }
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      // Add tracks
      stream.getTracks().forEach((track) => {
        if (pcRef.current && localStreamRef.current) {
          pcRef.current.addTrack(track, localStreamRef.current);
        }
      });
    } catch (e) {
      alert("Mic & Video permissions required to call!");
      terminateWebRTCCall();
      return;
    }

    // Connect remote tracks
    pcRef.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStreamObj.addTrack(track);
      });
      // Set wrapper MediaStream to trigger React state reactivity
      setRemoteStream(new MediaStream(remoteStreamObj.getTracks()));
    };

    // Candidate handling to DB paths
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate && rId) {
        const node = isCaller ? "callerCandidates" : "calleeCandidates";
        push(ref(db, `calls/${rId}/${node}`), event.candidate.toJSON());
      }
    };

    if (isCaller) {
      const offerDescription = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type
      };

      await set(ref(db, `calls/${rId}/offer`), offer);

      // Listen for Callee Candidates
      const calleeCandidatesQueue: any[] = [];
      const calleeCandidatesRef = ref(db, `calls/${rId}/calleeCandidates`);
      
      // Listen for answer
      onValue(ref(db, `calls/${rId}/answer`), async (snap) => {
        const data = snap.val();
        if (pcRef.current && !pcRef.current.currentRemoteDescription && data) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
            // Process any queued candidates now that remote description is set
            while (calleeCandidatesQueue.length > 0) {
              const candidateInit = calleeCandidatesQueue.shift();
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(err => {
                console.warn("Failed to add callee candidate from queue:", err);
              });
            }
          } catch (err) {
            console.error("Error setting remote description on caller:", err);
          }
        }
      });

      onChildAdded(calleeCandidatesRef, (snap) => {
        const candidateData = snap.val();
        if (candidateData && pcRef.current) {
          if (pcRef.current.remoteDescription) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(candidateData)).catch(err => {
              console.warn("Failed to add callee candidate immediately:", err);
            });
          } else {
            calleeCandidatesQueue.push(candidateData);
          }
        }
      });

    } else {
      // Is Callee
      const callerCandidatesQueue: any[] = [];
      const callerCandidatesRef = ref(db, `calls/${rId}/callerCandidates`);

      onChildAdded(callerCandidatesRef, (snap) => {
        const candidateData = snap.val();
        if (candidateData && pcRef.current) {
          if (pcRef.current.remoteDescription) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(candidateData)).catch(err => {
              console.warn("Failed to add caller candidate immediately:", err);
            });
          } else {
            callerCandidatesQueue.push(candidateData);
          }
        }
      });

      const offerRef = ref(db, `calls/${rId}/offer`);
      const unsubscribeOffer = onValue(offerRef, async (offerSnap) => {
        const offerData = offerSnap.val();
        if (offerData && pcRef.current && !pcRef.current.currentRemoteDescription) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(offerData));

            const answerDescription = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answerDescription);

            const answer = {
              sdp: answerDescription.sdp,
              type: answerDescription.type
            };

            await set(ref(db, `calls/${rId}/answer`), answer);

            // Process queued caller candidates
            while (callerCandidatesQueue.length > 0) {
              const candidateInit = callerCandidatesQueue.shift();
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(err => {
                console.warn("Failed to add caller candidate from queue:", err);
              });
            }
          } catch (err) {
            console.error("Error setting up signaling on callee:", err);
            terminateWebRTCCall();
          }
        }
      });

      offerUnsubRef.current = unsubscribeOffer;
    }
  };

  const toggleCallMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsCallMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCallCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoTrackEnabled(videoTrack.enabled);
      }
    }
  };

  return (
    <div className="w-screen h-dvh bg-[#f3f4f6] text-neutral-900 overflow-hidden flex flex-col font-sans select-none antialiased">
      <h1 className="sr-only">SK Secure Chat</h1>

      {/* Primary Calling Audio & Video WebRTC alerts overlays */}
      <CallUI
        incomingCall={incomingCall}
        activeCallStatus={activeCall}
        localStream={localStream}
        remoteStream={remoteStream}
        isMuted={isCallMuted}
        isVideoTrackEnabled={isVideoTrackEnabled}
        onAnswer={answerIncomingCall}
        onReject={terminateWebRTCCall}
        onHangup={terminateWebRTCCall}
        onToggleMic={toggleCallMic}
        onToggleCam={toggleCallCam}
      />

      {/* Stage A: Authentication Cover Screen */}
      <AnimatePresence mode="wait">
        {isAuthLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#f3f4f6] flex flex-col items-center justify-center p-6 z-[9999]"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping blur-sm" />
              <div className="w-16 h-16 rounded-[22px] bg-black text-white flex items-center justify-center text-xl font-extrabold shadow-lg relative z-10">
                SK
              </div>
            </div>
            <p className="text-xs text-neutral-400 font-extrabold uppercase tracking-widest animate-pulse mt-2">
              Syncing Secure Channels...
            </p>
          </motion.div>
        ) : !user ? (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#f3f4f6] flex items-center justify-center p-4 z-[9999] overflow-y-auto"
          >
            <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl border border-neutral-200/50 p-8 rounded-[36px] shadow-2xl text-center relative overflow-hidden">
              {/* Glassmorphic decor bubbles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />

              <div className="w-12 h-12 rounded-[18px] bg-[#000000] text-white flex items-center justify-center text-sm font-black mx-auto mb-4 tracking-tight shadow">
                SK
              </div>

              <h2 className="text-xl font-extrabold tracking-tight text-neutral-950 leading-tight">
                {isSignupMode ? "Create Secure Account" : "SK Secure Chatting"}
              </h2>
              <p className="text-[11px] text-neutral-400 font-medium tracking-wide leading-relaxed mt-1 mb-6 max-w-[240px] mx-auto">
                {isSignupMode
                  ? "Initialize your personal secure signature to connect."
                  : "Welcome back! Access your encrypted channels."}
              </p>

              {authError && (
                <div className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl py-2 px-3 mb-4 font-bold text-left leading-relaxed">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
                {isSignupMode && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-800 tracking-wide uppercase pl-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-black/20 text-xs font-semibold focus:outline-none bg-neutral-50/50 focus:bg-white transition"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="e.g. Sarathi"
                      required
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-800 tracking-wide uppercase pl-1">
                    Your Address Email
                  </label>
                  <input
                    type="email"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-black/20 text-xs font-semibold focus:outline-none bg-neutral-50/50 focus:bg-white transition"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="mail@example.com"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-800 tracking-wide uppercase pl-1">
                    Sign Secret Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-black/20 text-xs font-semibold focus:outline-none bg-neutral-50/50 focus:bg-white transition"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  className="w-full py-3 bg-neutral-950 border border-neutral-950 hover:bg-[#111] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer transition-colors mt-2"
                >
                  {isSignupMode ? "Complete Registration" : "Authorize Session"}
                </motion.button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-neutral-200"></div>
                  <span className="flex-shrink mx-3 text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest select-none">Or</span>
                  <div className="flex-grow border-t border-neutral-200"></div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-xs font-extrabold rounded-xl shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 15.02 1 12 1 7.37 1 3.4 3.61 1.45 7.43l3.87 3C6.27 7.15 8.9 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.43 3.58v3h3.91c2.28-2.11 3.55-5.21 3.55-8.73z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.32 14.57c-.24-.71-.38-1.48-.38-2.27s.14-1.56.38-2.27V7.03H1.45A11.967 11.967 0 0 0 0 12c0 1.83.41 3.57 1.15 5.14l4.17-2.57z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.91-3c-1.08.73-2.48 1.16-4.05 1.16-3.1 0-5.73-2.11-6.67-4.96l-3.87 3C3.4 20.39 7.37 23 12 23z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </motion.button>
              </form>

              <div className="mt-6 pt-3 border-t border-neutral-100 flex items-center justify-center gap-1.5">
                <span className="text-[10px] font-semibold text-neutral-400">
                  {isSignupMode ? "Have an account?" : "New to secure channels?"}
                </span>
                <button
                  onClick={() => {
                    setIsSignupMode(!isSignupMode);
                    setAuthError("");
                  }}
                  className="text-[10px] font-black text-blue-500 hover:underline cursor-pointer"
                >
                  {isSignupMode ? "Sign In Instead" : "Create Account"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Stage B: Active Full Application layout */}
      {user && (
        <div className="flex-1 flex overflow-hidden w-full h-full relative">
          {/* 1. Desktop Left Pane (Sidebar) */}
          <section className="hidden md:flex flex-col w-[350px] lg:w-[380px] h-full flex-shrink-0 z-10 border-r border-neutral-200/50">
            {/* Header branding & tabs bar */}
            <div className="h-16 px-4 bg-white border-b border-neutral-200/30 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm tracking-tight">
                <div className="w-7 h-7 rounded-[9px] bg-black text-white flex items-center justify-center text-xs font-black">
                  SK
                </div>
                SK Secure Chat
              </div>

              {/* Action indicators shortcuts */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setSelectedTab("home"); setActiveChat(null); }}
                  className={`p-2 rounded-full transition cursor-pointer ${selectedTab === "home" ? "bg-neutral-100 text-black" : "text-neutral-400 hover:text-black"}`}
                  title="Workspace Manager"
                >
                  <Home className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => { setSelectedTab("dialer"); setActiveChat(null); }}
                  className={`p-2 rounded-full transition cursor-pointer ${selectedTab === "dialer" ? "bg-neutral-100 text-black" : "text-neutral-400 hover:text-black"}`}
                  title="Launcher Dialer"
                >
                  <Phone className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => { setSelectedTab("feedbacks"); setActiveChat(null); }}
                  className={`p-2 rounded-full transition cursor-pointer ${selectedTab === "feedbacks" ? "bg-neutral-100 text-black" : "text-neutral-400 hover:text-black"}`}
                  title="Portal Feedbacks"
                >
                  <ClipboardList className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => { setSelectedTab("profile"); setActiveChat(null); }}
                  className={`p-2 rounded-full transition cursor-pointer ${selectedTab === "profile" ? "bg-neutral-100 text-black" : "text-neutral-400 hover:text-black"}`}
                  title="Settings Dashboard"
                >
                  <User className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            <Sidebar
              rooms={myRooms}
              directChats={myDirectChats}
              publicRooms={publicRooms}
              currentChatId={activeChat?.id || null}
              onSelectChat={(lobby) => {
                setActiveChat(lobby);
                setSelectedTab("chats");
              }}
              onJoinPublicRoom={handleJoinLobby}
              currentUserUid={user.uid}
            />
          </section>

          {/* 2. Main content flex panels */}
          <section className="flex-1 flex flex-col h-full overflow-hidden relative">
            {isMobile ? (
              /* Mobile View Layout (uses slide displays) */
              <div className="flex-1 flex flex-col h-full overflow-hidden relative pb-[64px]">
                {/* Embedded Active Chat sliding Sheet */}
                <AnimatePresence>
                  {activeChat && (
                    <motion.div
                      initial={{ x: "100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "100%" }}
                      className="absolute inset-0 z-50 bg-white"
                    >
                      <ChatWindow
                        room={activeChat}
                        messages={activeChatMessages}
                        currentUserId={user.uid}
                        currentProfile={currentProfile}
                        onBack={() => setActiveChat(null)}
                        onInitiateCall={initiateWebRTCCall}
                        typingUsers={typingUsers}
                        onSetReplying={setReplyingTo}
                        replyingTo={replyingTo}
                        onKickMember={handleKickMember}
                        onDeleteRoom={handleDeleteRoom}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile View Switches */}
                <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
                  {selectedTab === "home" && (
                    <div className="space-y-4">
                      {/* Brand Welcome Card */}
                      <div className="p-6 bg-white/75 backdrop-blur rounded-[28px] border border-neutral-200/50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-3 py-1 flex items-center gap-1.5 rounded-full text-[10px] font-bold">
                          <Shield className="w-3.5 h-3.5" /> SECURE LINK ON
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 mt-2">
                          Encrypted Channels
                        </h2>
                        <p className="text-xs text-neutral-450 mt-1 mb-4 leading-relaxed">
                          Initialize group rooms or dial secure contact numbers directly below.
                        </p>

                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <button
                            onClick={() => setIsCreatingRoom(true)}
                            className="p-3 bg-neutral-900 border border-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-2xl cursor-pointer transition shadow-sm text-center flex items-center justify-center gap-2"
                          >
                            <PlusCircle className="w-4 h-4" /> Create Group
                          </button>
                          <button
                            onClick={() => setIsJoiningRoom(true)}
                            className="p-3 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs font-semibold rounded-2xl cursor-pointer transition shadow-sm text-center flex items-center justify-center gap-2"
                          >
                            <Hash className="w-4 h-4 text-neutral-500" /> Join Room ID
                          </button>
                        </div>
                      </div>

                      {/* Communities Index */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-extrabold tracking-wider uppercase text-neutral-400">
                          Public Workspaces ({publicRooms.length})
                        </h3>

                        {publicRooms.length === 0 ? (
                          <div className="bg-white/60 p-8 text-center rounded-3xl border border-dashed border-neutral-200 text-sm text-neutral-400">
                            No channels listed.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {publicRooms.map((room) => (
                              <div
                                key={room.id}
                                className="bg-white flex items-center gap-3 p-3 border border-neutral-200/50 rounded-2xl"
                              >
                                <img
                                  src={room.icon}
                                  alt={room.name}
                                  className="w-10 h-10 rounded-2xl object-cover bg-neutral-100 flex-shrink-0"
                                />
                                <div className="flex-grow min-w-0">
                                  <h4 className="text-xs font-bold truncate">{room.name}</h4>
                                  <span className="text-[9px] text-neutral-400 mt-0.5 block font-mono">
                                    ID: {room.id}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleJoinLobby(room)}
                                  className="py-1 px-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-[10px] font-bold cursor-pointer shadow-sm transition"
                                >
                                  Join
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTab === "chats" && (
                    <div className="space-y-1">
                      <div className="mb-4">
                        <h2 className="text-lg font-black text-[#111827]">Encrypted Inbox</h2>
                        <p className="text-[10px] text-neutral-400">Secure private conversations.</p>
                      </div>
                      <Sidebar
                        rooms={myRooms}
                        directChats={myDirectChats}
                        publicRooms={publicRooms}
                        currentChatId={activeChat?.id || null}
                        onSelectChat={(lobby) => setActiveChat(lobby)}
                        onJoinPublicRoom={handleJoinLobby}
                        currentUserUid={user.uid}
                      />
                    </div>
                  )}

                  {selectedTab === "dialer" && (
                    <Dialer onDialAction={handleDialerAction} />
                  )}

                  {selectedTab === "feedbacks" && (
                    <Feedbacks
                      currentUserId={user.uid}
                      userEmail={authEmail}
                      userName={currentProfile.name}
                      isAdmin={currentProfile.name === "Admin" || currentProfile.name.toLowerCase().includes("support") || currentProfile.contactNo.endsWith("7")}
                      onBackToHome={() => setSelectedTab("home")}
                      userContactNo={currentProfile.contactNo || ""}
                    />
                  )}

                  {selectedTab === "profile" && (
                    <Profile
                      currentProfile={currentProfile}
                      onSaveProfile={handleSaveIdentity}
                      onSignOut={handleSignOut}
                      isAdmin={currentProfile.name === "Admin" || currentProfile.name.toLowerCase().includes("support")}
                      onToggleAdmin={() => {
                        const nextName = currentProfile.name === "Admin" ? "User" : "Admin";
                        handleSaveIdentity(nextName, currentProfile.img);
                      }}
                    />
                  )}
                </div>

                {/* Mobile Bottom Navigation Bar */}
                <nav className="fixed bottom-0 inset-x-0 h-[64px] bg-white/95 backdrop-blur border-t border-neutral-200/50 flex items-center justify-around z-40 px-3 flex-row pointer-events-auto">
                  <button
                    onClick={() => { setSelectedTab("home"); setActiveChat(null); }}
                    className={`flex-1 flex flex-col items-center justify-center py-2 relative cursor-pointer ${
                      selectedTab === "home" ? "text-neutral-900 border-t-2 border-black" : "text-neutral-400"
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-wider leading-none mt-1">Home</span>
                  </button>

                  <button
                    onClick={() => { setSelectedTab("chats"); setActiveChat(null); }}
                    className={`flex-1 flex flex-col items-center justify-center py-2 relative cursor-pointer ${
                      selectedTab === "chats" ? "text-neutral-900 border-t-2 border-black" : "text-neutral-400"
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-wider leading-none mt-1">Chats</span>
                  </button>

                  <button
                    onClick={() => { setSelectedTab("dialer"); setActiveChat(null); }}
                    className={`flex-1 flex flex-col items-center justify-center py-2 relative cursor-pointer ${
                      selectedTab === "dialer" ? "text-[#000] border-t-2 border-black" : "text-neutral-400"
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-wider leading-none mt-1">Dialer</span>
                  </button>

                  <button
                    onClick={() => { setSelectedTab("feedbacks"); setActiveChat(null); }}
                    className={`flex-1 flex flex-col items-center justify-center py-2 relative cursor-pointer ${
                      selectedTab === "feedbacks" ? "text-[#000] border-t-2 border-black" : "text-neutral-400"
                    }`}
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-wider leading-none mt-1">Portal</span>
                  </button>

                  <button
                    onClick={() => { setSelectedTab("profile"); setActiveChat(null); }}
                    className={`flex-1 flex flex-col items-center justify-center py-2 relative cursor-pointer ${
                      selectedTab === "profile" ? "text-[#000] border-t-2 border-black" : "text-neutral-400"
                    }`}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-wider leading-none mt-1">Profile</span>
                  </button>
                </nav>
              </div>
            ) : (
              /* Desktop Screen Layout (Center Panels) */
              <div className="flex-grow h-full flex overflow-hidden">
                <main className="flex-grow h-full overflow-hidden flex flex-col bg-neutral-50 relative">
                  {/* Embedded active chat window panel */}
                  {activeChat ? (
                    <ChatWindow
                      room={activeChat}
                      messages={activeChatMessages}
                      currentUserId={user.uid}
                      currentProfile={currentProfile}
                      onBack={() => setActiveChat(null)}
                      onInitiateCall={initiateWebRTCCall}
                      typingUsers={typingUsers}
                      onSetReplying={setReplyingTo}
                      replyingTo={replyingTo}
                      onKickMember={handleKickMember}
                      onDeleteRoom={handleDeleteRoom}
                    />
                  ) : (
                    /* General dashboard workspace modules */
                    <div className="flex-grow overflow-y-auto px-6 py-6 scrollbar-thin">
                      {selectedTab === "home" && (
                        <div className="space-y-6">
                          {/* Desktop Greeting Backdrop */}
                          <div className="bg-[#ffffff] border border-neutral-200/50 rounded-[32px] p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden select-none">
                            <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                            <div className="space-y-2">
                              <div className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 px-3 py-1 font-bold rounded-full text-[10px] tracking-wider uppercase inline-flex items-center gap-1.5 max-w-max">
                                <Shield className="w-3.5 h-3.5" /> Encrypted Link Online
                              </div>
                              <h2 className="text-3xl font-black tracking-tight text-[#111827]">
                                Welcome, {currentProfile.name || "Member"}
                              </h2>
                              <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
                                You are signed in to SK Secure Chat. Initiate secure group workspaces or dial contact channels directly.
                              </p>
                              
                              <div className="flex gap-4 pt-2 pb-1">
                                <button
                                  onClick={() => setIsCreatingRoom(true)}
                                  className="py-2.5 px-6 rounded-2xl bg-black hover:bg-neutral-900 text-white text-xs font-bold shadow-md shadow-neutral-100 cursor-pointer transition flex items-center gap-1.5"
                                >
                                  <PlusCircle className="w-4 h-4" /> Create Group Workspace
                                </button>
                                <button
                                  onClick={() => setIsJoiningRoom(true)}
                                  className="py-2.5 px-6 rounded-2xl bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs font-bold shadow-sm cursor-pointer transition flex items-center gap-1.5"
                                >
                                  <Hash className="w-4 h-4 text-neutral-500 animate-pulse" /> Join Room ID
                                </button>
                              </div>
                            </div>

                            {/* Digital clock widget */}
                            <div className="bg-neutral-100 border border-neutral-200/50 p-6 rounded-[24px] text-center min-w-[150px] shadow-sm">
                              <span className="text-neutral-400 text-[10px] font-bold tracking-widest uppercase">
                                System Frame
                              </span>
                              <div className="text-4xl font-mono font-extrabold text-[#111827] flex items-center justify-center gap-1 my-1">
                                <Clock className="w-5 h-5 text-neutral-400" /> {currentTime}
                              </div>
                              <span className="text-[10px] text-neutral-500 font-bold tracking-wide">
                                Connection secure
                              </span>
                            </div>
                          </div>

                          {/* Desktop directory index grids */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-[28px] border border-neutral-200/50 p-6 shadow-sm">
                              <h3 className="font-extrabold text-[#111827] text-sm flex items-center gap-1.5 border-b pb-3 mb-4">
                                <Users className="w-4 h-4 text-neutral-500" /> Active Communities ({publicRooms.length})
                              </h3>
                              
                              {publicRooms.length === 0 ? (
                                <p className="text-center text-xs text-neutral-400 py-10">No public channels listed.</p>
                              ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {publicRooms.map((room) => (
                                    <div
                                      key={room.id}
                                      className="flex justify-between items-center bg-neutral-50 p-3 rounded-2xl border border-neutral-100 hover:border-neutral-250 transition"
                                    >
                                      <div className="flex items-center gap-3">
                                        <img
                                          src={room.icon}
                                          alt={room.name}
                                          className="w-10 h-10 rounded-2xl object-cover bg-neutral-100"
                                        />
                                        <div className="min-w-0">
                                          <h4 className="text-xs font-bold text-neutral-900 leading-none mb-1">
                                            {room.name}
                                          </h4>
                                          <span className="text-[9px] font-mono text-neutral-450 uppercase leading-none">
                                            ID: {room.id}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => handleJoinLobby(room)}
                                        className="py-1 px-4 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] uppercase shadow-sm cursor-pointer transition"
                                      >
                                        Join Community
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Help Desk Dashboard info */}
                            <div className="bg-white rounded-[28px] border border-neutral-200/50 p-6 shadow-sm select-none">
                              <h3 className="font-extrabold text-[#111827] text-sm flex items-center gap-1.5 border-b pb-3 mb-4">
                                <HelpIcon className="w-4 h-4 text-neutral-500" /> Channel Quick Start
                              </h3>
                              <div className="space-y-4 text-xs font-semibold text-neutral-500 leading-relaxed">
                                <p>
                                  1. <strong>Direct Connection:</strong> Dial a buddy's secret 10-digit number inside the <strong>Dialer page</strong> to immediately spin up text chats, audio calls, or crystal-clear video streams in 1 click!
                                </p>
                                <p>
                                  2. <strong>Secure Workspaces:</strong> Create secure rooms with optional entry passwords, and share the copied Room ID with any users. 
                                </p>
                                <p>
                                  3. <strong>Micro Records:</strong> Hold or click the Microphone inside active chat windows to capture and transmit real-time voice notes effortlessly.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedTab === "dialer" && (
                        <Dialer onDialAction={handleDialerAction} />
                      )}

                      {selectedTab === "feedbacks" && (
                        <Feedbacks
                          currentUserId={user.uid}
                          userEmail={authEmail}
                          userName={currentProfile.name}
                          isAdmin={currentProfile.name === "Admin" || currentProfile.name.toLowerCase().includes("support") || currentProfile.contactNo.endsWith("7")}
                          onBackToHome={() => setSelectedTab("home")}
                          userContactNo={currentProfile.contactNo || ""}
                        />
                      )}

                      {selectedTab === "profile" && (
                        <Profile
                          currentProfile={currentProfile}
                          onSaveProfile={handleSaveIdentity}
                          onSignOut={handleSignOut}
                          isAdmin={currentProfile.name === "Admin" || currentProfile.name.toLowerCase().includes("support")}
                          onToggleAdmin={() => {
                            const nextName = currentProfile.name === "Admin" ? "User" : "Admin";
                            handleSaveIdentity(nextName, currentProfile.img);
                          }}
                        />
                      )}
                    </div>
                  )}
                </main>
              </div>
            )}
          </section>
        </div>
      )}

      {/* CREATE WORKSPACE MODAL OVERLAY (Cloudinary-enabled!) */}
      <AnimatePresence>
        {isCreatingRoom && (
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
              className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative flex flex-col"
            >
              <div className="flex items-center justify-between border-b pb-2.5 mb-4">
                <h3 className="font-extrabold text-sm text-[#111827]">
                  Create Secure Workspace
                </h3>
                <button
                  onClick={() => setIsCreatingRoom(false)}
                  className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <input
                ref={groupIconRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGroupIconUpload}
              />

              <div className="space-y-4">
                {/* Custom Avatar Group Picker */}
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="relative group cursor-pointer" onClick={() => groupIconRef.current?.click()}>
                    <img
                      src={newRoomIcon || "https://avatar.iran.liara.run/public/61"}
                      alt="Group Icon"
                      className="w-16 h-16 rounded-2xl object-cover border bg-neutral-50 shadow-sm"
                    />
                    <div className="absolute inset-0 bg-black/40 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <Upload className="w-4 h-4" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => groupIconRef.current?.click()}
                    disabled={isUploadingGroupIcon}
                    className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1 cursor-pointer"
                  >
                    {isUploadingGroupIcon ? (
                      <>
                        <Loader className="w-3 h-3 animate-spin" /> Uploading Icon...
                      </>
                    ) : (
                      "Upload Custom Icon"
                    )}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-800">Workspace name</label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
                    placeholder="e.g. Design Team"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5 pb-1">
                  <label className="text-xs font-bold text-neutral-800 font-semibold mb-1">Visibility settings</label>
                  <div className="flex p-0.5 bg-neutral-100 rounded-xl border">
                    <button
                      type="button"
                      onClick={() => setNewRoomType("public")}
                      className={`flex-1 py-1 px-3 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                        newRoomType === "public" ? "bg-white text-black shadow-sm" : "text-neutral-500"
                      }`}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoomType("private")}
                      className={`flex-1 py-1 px-3 text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer ${
                        newRoomType === "private" ? "bg-white text-black shadow-sm" : "text-neutral-500"
                      }`}
                    >
                      Private Group
                    </button>
                  </div>
                </div>

                {newRoomType === "private" && (
                  <div className="flex flex-col gap-1.5 animate-fade-in">
                    <label className="text-xs font-bold text-neutral-800">Workspace Password</label>
                    <input
                      type="password"
                      className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
                      placeholder="Required to join"
                      value={newRoomPass}
                      onChange={(e) => setNewRoomPass(e.target.value)}
                    />
                  </div>
                )}

                <button
                  onClick={handleCreateLobby}
                  className="w-full py-2.5 bg-neutral-900 border border-neutral-900 text-white rounded-xl text-xs font-extrabold hover:bg-black transition cursor-pointer mt-4 shadow-sm"
                >
                  Register Workspace
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JOIN ROOM BY ID MODAL OVERLAY */}
      <AnimatePresence>
        {isJoiningRoom && (
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
              className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative flex flex-col"
            >
              <div className="flex items-center justify-between border-b pb-2.5 mb-4">
                <h3 className="font-extrabold text-sm text-[#111827]">
                  Join Workspace Room
                </h3>
                <button
                  onClick={() => setIsJoiningRoom(false)}
                  className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer text-neutral-400"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-800">Workspace Room ID</label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50 font-mono"
                    placeholder="e.g. -NwZ_8Sj7F_9..."
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-neutral-800">Entry Password (if private)</label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
                    placeholder="Set only if private lobby"
                    value={joinRoomPass}
                    onChange={(e) => setJoinRoomPass(e.target.value)}
                  />
                </div>

                <button
                  onClick={async () => {
                    const snap = await get(ref(db, `rooms/${joinRoomId.trim()}`));
                    if (!snap.exists()) {
                      return alert("Lobby not found!");
                    }
                    const data = snap.val() as Room;
                    if (data.pass && data.pass !== joinRoomPass.trim()) {
                      return alert("Incorrect secure credentials!");
                    }
                    setIsJoiningRoom(false);
                    setJoinRoomId("");
                    setJoinRoomPass("");
                    await finalizeWorkspaceJoin(data);
                  }}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-extrabold rounded-xl transition cursor-pointer mt-4"
                >
                  Connect to Workspace
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOM SECURE PASSWORD OVERLAY DIALOG */}
      <AnimatePresence>
        {pendingJoinRoom && (
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
              className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl relative"
            >
              <h3 className="font-black text-neutral-950 text-sm mb-1.5">
                🔒 Security Locked Workspace
              </h3>
              <p className="text-[11px] text-neutral-400 leading-relaxed mb-4">
                The group room: "{pendingJoinRoom.name}" requires entering a security password key to finalize enrollment.
              </p>

              <input
                type="password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 placeholder-neutral-400 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-neutral-50/50"
                placeholder="Enter Entry Password"
                value={customPassInput}
                onChange={(e) => setCustomPassInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomPassSubmit()}
                autoFocus
              />

              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => setPendingJoinRoom(null)}
                  className="py-2 px-4 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomPassSubmit}
                  className="py-2 px-5 bg-blue-500 hover:bg-blue-600 border border-blue-500 text-xs font-extrabold text-white rounded-xl shadow cursor-pointer transition"
                >
                  Unlock & Join
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
